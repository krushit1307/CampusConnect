import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { Redis } from "https://esm.sh/@upstash/redis@1.30.0";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { rsvpIpLimiter, rsvpUserLimiter } from "../_shared/rateLimiter.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { verifyCsrf } from "../_shared/csrf.ts";

const toggleRsvpSchema = z
  .object({
    eventId: z.string().uuid("eventId must be a valid UUID"),
    hasRsvpd: z.boolean().optional(),
    captchaToken: z.string().optional(),
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
};

const IDEMPOTENCY_TTL_SECONDS = 86400;

const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/**
 * Handles RSVP toggling with rate limiting and idempotent duplicate prevention.
 * When the client sends an `Idempotency-Key` header, a Redis SETNX lock
 * guarantees rapid duplicate clicks/retries never touch Postgres twice (#2323).
 * @param {Request} req - The incoming HTTP request.
 * @returns {Promise<Response>} The HTTP response.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (
    req.method === "POST" ||
    req.method === "PUT" ||
    req.method === "PATCH" ||
    req.method === "DELETE"
  ) {
    if (!verifyCsrf(req)) {
      return new Response(
        JSON.stringify({
          error: "Invalid CSRF token",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
  }

  let idempotencyRedisKey: string | null = null;

  try {
    // 1. Pre-auth IP Limiter
    const xForwardedFor = req.headers.get("x-forwarded-for");
    const ip = xForwardedFor ? xForwardedFor.split(",")[0].trim() : "127.0.0.1";

    let ipLimitRes;
    try {
      ipLimitRes = await rsvpIpLimiter.limit(ip);
    } catch (err) {
      console.error("[RateLimiter] IP limit check failed:", err);
      ipLimitRes = { success: true, reset: 0 }; // fail open
    }

    if (!ipLimitRes.success) {
      const retryAfter = Math.max(1, Math.ceil(((ipLimitRes as any).reset - Date.now()) / 1000));
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
          },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Post-auth User Limiter
    let userLimitRes;
    try {
      userLimitRes = await rsvpUserLimiter.limit(user.id);
    } catch (err) {
      console.error("[RateLimiter] User limit check failed:", err);
      userLimitRes = { success: true, reset: 0 }; // fail open
    }

    if (!userLimitRes.success) {
      const retryAfter = Math.max(1, Math.ceil(((userLimitRes as any).reset - Date.now()) / 1000));
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
          },
        },
      );
    }

    const parsed = await parseJsonBody(toggleRsvpSchema, req);
    if (!parsed.ok) return parsed.response;
    const { eventId, hasRsvpd, captchaToken } = parsed.data;

    const siteKey = Deno.env.get("TURNSTILE_SITE_KEY") || Deno.env.get("HCAPTCHA_SITE_KEY");
    const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY") || Deno.env.get("HCAPTCHA_SECRET_KEY");
    const captchaEnabled = Boolean(siteKey && secretKey);

    if (captchaEnabled && typeof captchaToken === "string" && captchaToken.trim()) {
      const provider = Deno.env.get("TURNSTILE_SECRET_KEY") ? "turnstile" : "hcaptcha";
      const verificationUrl =
        provider === "turnstile"
          ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
          : "https://hcaptcha.com/siteverify";

      const verificationResponse = await fetch(verificationUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: secretKey ?? "",
          response: captchaToken,
          remoteip: req.headers.get("x-forwarded-for") ?? "",
        }).toString(),
      });

      const verificationResult = await verificationResponse.json();
      if (!verificationResult?.success) {
        return new Response(JSON.stringify({ error: "CAPTCHA verification failed." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (captchaEnabled) {
      return new Response(JSON.stringify({ error: "CAPTCHA verification required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idempotencyKey = req.headers.get("Idempotency-Key");
    idempotencyRedisKey = idempotencyKey ? `rsvp_idempotency_${idempotencyKey}` : null;

    // Serialize a response and, when an idempotency key is present, cache the
    // final payload so retries replay the exact same result.
    const respond = async (body: unknown, status: number): Promise<Response> => {
      if (idempotencyRedisKey && redis) {
        try {
          await redis.set(idempotencyRedisKey, JSON.stringify({ status, body }), {
            ex: IDEMPOTENCY_TTL_SECONDS,
          });
        } catch (cacheError) {
          console.error("Failed to cache idempotency response:", cacheError);
        }
      }
      return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    // Acquire a Redis lock (SETNX semantics). If the key already exists this
    // request is a duplicate/retry: replay the cached response if one exists,
    // otherwise short-circuit with a safe 202 while the original runs.
    if (idempotencyRedisKey && redis) {
      const acquired = await redis.set(idempotencyRedisKey, "processing", {
        nx: true,
        ex: IDEMPOTENCY_TTL_SECONDS,
      });

      if (acquired === null) {
        const cached = await redis.get<string>(idempotencyRedisKey);
        if (cached && cached !== "processing") {
          try {
            const envelope = JSON.parse(cached) as { status: number; body: unknown };
            return new Response(JSON.stringify(envelope.body), {
              status: envelope.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch {
            return new Response(cached, {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        return new Response(JSON.stringify({ success: true, status: "processing" }), {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (hasRsvpd) {
      // 1. Cancel RSVP: delete from RSVPs and waitlist
      const { error: rsvpErr } = await supabase
        .from("event_rsvps")
        .delete()
        .match({ event_id: eventId, user_id: user.id });

      if (rsvpErr) {
        throw rsvpErr;
      }

      const { error: waitlistErr } = await supabase
        .from("event_waitlist")
        .delete()
        .match({ event_id: eventId, user_id: user.id });

      if (waitlistErr) {
        throw waitlistErr;
      }

      return respond({ success: true, status: "cancelled" }, 200);
    } else {
      // 2. highly concurrent checkout flow utilizing PG advisory locks and backoff retry mechanism
      let attempts = 0;
      const maxAttempts = 5;
      let delay = 50; // initial wait time in milliseconds

      while (attempts < maxAttempts) {
        const { data, error } = await supabase.rpc("secure_event_checkout", {
          p_event_id: eventId,
          p_user_id: user.id,
        });

        if (error) {
          throw error;
        }

        if (data === "SUCCESS") {
          return respond({ success: true, status: "approved" }, 200);
        }

        if (data === "ALREADY_RSVPED") {
          return respond({ error: "You have already RSVPed to this event." }, 400);
        }

        if (data === "FULL") {
          return respond({ error: "Event capacity has been reached." }, 409);
        }

        if (data === "BUSY") {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff multiplier
            continue;
          }
        }
      }

      // Lock acquisition failed after max retries
      return respond({ error: "Server is busy processing checkouts. Please try again." }, 429);
    }
  } catch (error) {
    console.error("Internal RSVP Error:", error);
    // Release the lock so a client retry can re-execute instead of hitting a stale lock
    if (idempotencyRedisKey && redis) {
      try {
        await redis.del(idempotencyRedisKey);
      } catch (cleanupError) {
        console.error("Failed to clean up idempotency lock:", cleanupError);
      }
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: `An unexpected error occurred processing your RSVP: ${errorMsg}` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
