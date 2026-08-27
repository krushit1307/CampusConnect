import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.30.0";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { create as createJwt } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const CONCURRENCY_LIMIT = 50; // Max concurrent users admitted at any time

// Helper to sign the Admission Ticket JWT
async function generateAdmissionTicket(eventId: string, userId: string): Promise<string> {
  const secret = Deno.env.get("JWT_SECRET") || "fallback-secret-for-local-testing";
  const keyBuf = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const payload = {
    eventId,
    userId,
    exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes expiration
  };

  return await createJwt({ alg: "HS256", typ: "JWT" }, payload, cryptoKey);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Authenticate user
    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!redis) {
      return new Response(JSON.stringify({ error: "Redis connection not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request body
    const body = await req.json().catch(() => ({}));
    const { eventId, action } = body;

    if (!eventId || !action) {
      return new Response(JSON.stringify({ error: "eventId and action are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queueKey = `queue:event:${eventId}`;
    const admittedPrefix = `admitted:event:${eventId}`;
    const userAdmittedKey = `${admittedPrefix}:${user.id}`;

    // 3. Handle queue status query
    if (action === "status") {
      // Check if user is already admitted
      const isAdmitted = await redis.get<string>(userAdmittedKey);
      if (isAdmitted) {
        const ticket = await generateAdmissionTicket(eventId, user.id);
        return new Response(
          JSON.stringify({ status: "admitted", ticket }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check current active admitted sessions count
      const admittedKeys = await redis.keys(`${admittedPrefix}:*`);
      const activeAdmittedCount = admittedKeys.length;

      // If active slots are open, pop next user from queue and admit them
      if (activeAdmittedCount < CONCURRENCY_LIMIT) {
        // Peek at next in queue or pop it
        const nextUserId = await redis.lpop<string>(queueKey);
        if (nextUserId) {
          const nextAdmittedKey = `${admittedPrefix}:${nextUserId}`;
          await redis.set(nextAdmittedKey, "true", { ex: 300 });

          // If the popped user is the current polling user, they are admitted immediately!
          if (nextUserId === user.id) {
            const ticket = await generateAdmissionTicket(eventId, user.id);
            return new Response(
              JSON.stringify({ status: "admitted", ticket }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      // Otherwise, get user's position in the FIFO queue list
      const queueList = await redis.lrange<string>(queueKey, 0, 1000);
      const position = queueList.indexOf(user.id);

      if (position === -1) {
        // If not in queue, they need to join first
        return new Response(
          JSON.stringify({ status: "not_in_queue" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const queuePosition = position + 1;
      const estimatedWaitTime = queuePosition * 5; // e.g. 5 seconds per person

      return new Response(
        JSON.stringify({
          status: "waiting",
          position: queuePosition,
          total: queueList.length,
          estimatedWaitTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Handle joining the queue
    if (action === "join") {
      // Check if already admitted
      const isAdmitted = await redis.get<string>(userAdmittedKey);
      if (isAdmitted) {
        const ticket = await generateAdmissionTicket(eventId, user.id);
        return new Response(
          JSON.stringify({ status: "admitted", ticket }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already in queue
      const queueList = await redis.lrange<string>(queueKey, 0, 1000);
      const position = queueList.indexOf(user.id);

      if (position !== -1) {
        return new Response(
          JSON.stringify({ status: "waiting", position: position + 1 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Append user to FIFO queue
      await redis.rpush(queueKey, user.id);

      return new Response(
        JSON.stringify({ status: "waiting", position: queueList.length + 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Waiting room edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
