import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Authenticate: Request must carry webhook secret or service role key Bearer token
  const isAuthorized =
    (webhookSecret && authHeader === `Bearer ${webhookSecret}`) ||
    (serviceKey && authHeader === `Bearer ${serviceKey}`);

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment configuration variables.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Identify ghost users: last ping older than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: ghosts, error: fetchError } = await supabaseAdmin
      .from("presence_heartbeats")
      .select("user_id")
      .lt("last_pinged_at", fiveMinutesAgo);

    if (fetchError) {
      throw fetchError;
    }

    const prunedUserIds: string[] = [];

    if (ghosts && ghosts.length > 0) {
      // 1. Remove ghost heartbeats from database
      const ghostIds = ghosts.map((g) => g.user_id);
      const { error: deleteError } = await supabaseAdmin
        .from("presence_heartbeats")
        .delete()
        .in("user_id", ghostIds);

      if (deleteError) {
        throw deleteError;
      }

      // 2. Broadcast a ghost-leave event via Supabase Realtime REST API for each ghost
      for (const ghostId of ghostIds) {
        prunedUserIds.push(ghostId);

        const broadcastRes = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
          method: "POST",
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: "global-presence",
            event: "ghost-leave",
            payload: { userId: ghostId },
          }),
        });

        if (!broadcastRes.ok) {
          console.error(
            `[sweep-presence] Failed to broadcast ghost-leave for user ${ghostId}:`,
            await broadcastRes.text(),
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sweeper completed successfully. Pruned ${prunedUserIds.length} ghost user(s).`,
        prunedUsers: prunedUserIds,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("[sweep-presence] Heartbeat sweep execution error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected execution error occurred.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
