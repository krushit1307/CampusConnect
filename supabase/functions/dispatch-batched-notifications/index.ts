// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resilience cap (see the "queue backups" edge case): if the cron job
// fails for a while and the queue grows huge, one invocation still only
// processes this many rows and returns. Anything left over is picked up
// by the next run 2 minutes later — nothing is lost, it just aggregates
// into an even bigger single summary next time, never more pushes.
const BATCH_LIMIT = 5000;
const GROUP_CONCURRENCY = 20;

type PendingRow = {
  id: string;
  user_id: string;
  notification_type: string;
  entity_id: string | null;
  actor_name: string | null;
  title: string;
  message: string;
  link: string | null;
  notification_event_key: string;
  attempt_count: number;
};
// Human-readable aggregation phrasing per notification_type. Falls back
// to a generic phrase for any type not listed here, so a new
// notification_type added later degrades gracefully instead of erroring.
const ACTION_PHRASES: Record<string, string> = {
  post_reply: "replied to your post.",
  event_rsvp: "RSVPed to your event.",
  mention: "mentioned you.",
};

function buildAggregatedMessage(rows: PendingRow[]): { title: string; message: string } {
  const latest = rows[rows.length - 1];

  if (rows.length === 1) {
    return { title: latest.title, message: latest.message };
  }

  const primaryActor = latest.actor_name || "Someone";
  const othersCount = rows.length - 1;
  const actionPhrase = ACTION_PHRASES[latest.notification_type] ?? "sent you updates.";
  const plural = othersCount === 1 ? "" : "s";

  return {
    title: latest.title,
    message: `${primaryActor} and ${othersCount} other${plural} ${actionPhrase}`,
  };
}

async function dispatchGroup(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  rows: PendingRow[],
): Promise<void> {
  const { title, message } = buildAggregatedMessage(rows);
  const latest = rows[rows.length - 1];

  // Reuse the existing single-purpose push function rather than
  // duplicating web-push/VAPID logic here — one place owns the actual
  // FCM/APNs/Web Push dispatch mechanics.
  const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ user_id: latest.user_id, title, message, url: latest.link }),
  });

  if (!response.ok) {
    throw new Error(`push dispatch failed with status ${response.status}`);
  }

for (const row of rows) {
  const { data: marked, error } = await supabase.rpc(
    "mark_notification_delivered",
    {
      p_notification_id: row.id,
    },
  );

  if (error) throw error;

  if (!marked) {
    throw new Error(
      `Notification ${row.notification_event_key} was not in processing state`,
    );
  }
}}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

await supabase.rpc("recover_stale_notification_jobs", {
  p_timeout: "10 minutes",
});

const { data: pending, error: fetchError } = await supabase.rpc(
  "claim_pending_notifications",
  {
    p_limit: BATCH_LIMIT,
  },
);

if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ success: true, groups: 0, notifications: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by (user_id, entity_id, notification_type). Different
    // notification_types are NEVER grouped together, by construction —
    // this is what keeps a forum reply and a ticket receipt as
    // distinct pushes even if they land in the same 2-minute window.
    const groups = new Map<string, PendingRow[]>();
    for (const row of pending as PendingRow[]) {
      const key = `${row.user_id}::${row.entity_id ?? "none"}::${row.notification_type}`;
      const existing = groups.get(key);
      if (existing) {
        existing.push(row);
      } else {
        groups.set(key, [row]);
      }
    }

    const groupEntries = Array.from(groups.values());
    let dispatchedGroups = 0;
    let failedGroups = 0;

    // Bounded-concurrency worker pool: fast enough to clear a large
    // backlog quickly, but never fires an unbounded number of parallel
    // requests at the push provider during a spike.
    let cursor = 0;
    async function worker() {
      while (cursor < groupEntries.length) {
        const index = cursor++;
        const rows = groupEntries[index];
        try {
          await dispatchGroup(supabase, supabaseUrl, supabaseServiceKey, rows);
          dispatchedGroups++;
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : String(err);

  console.error("[NotificationWorker] group dispatch failed:", err);

  await Promise.all(
    rows.map(async (row) => {
      const { error } = await supabase.rpc(
        "mark_notification_delivery_failed",
        {
          p_notification_id: row.id,
          p_error: errorMessage,
        },
      );

      if (error) {
        console.error(
          `[NotificationWorker] failed to record retry state for ${row.id}:`,
          error,
        );
      }
    }),
  );

  failedGroups++;
}      }
    }

    await Promise.all(
      Array.from({ length: Math.min(GROUP_CONCURRENCY, groupEntries.length) }, worker),
    );

    return new Response(
      JSON.stringify({
        success: true,
        pending_rows: pending.length,
        groups: groupEntries.length,
        dispatched: dispatchedGroups,
        failed: failedGroups,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[NotificationWorker Error]:", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
