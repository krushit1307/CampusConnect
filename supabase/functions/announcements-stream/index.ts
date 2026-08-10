import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Announcement {
  id: string;
  content: string;
  created_at: string;
  club_id: string;
  profiles:
    { id: string; full_name: string | null }[] | { id: string; full_name: string | null } | null;
  clubs: { id: string; name: string }[] | { id: string; name: string } | null;
}

const clients = new Map<ReadableStreamDefaultController, undefined>();

function broadcastAnnouncement(announcement: Announcement) {
  const data = `data: ${JSON.stringify(announcement)}\n\n`;
  for (const controller of clients.keys()) {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch (error) {
      clients.delete(controller);
    }
  }
}

async function* heartbeatStream() {
  while (true) {
    yield `: heartbeat\n\n`;
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      clients.set(controller, undefined);

      const heartbeat = heartbeatStream();

      async function pump() {
        try {
          for await (const chunk of heartbeat) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          clients.delete(controller);
        }
      }

      pump();

      supabase
        .channel("announcements-stream")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "posts",
          },
          (payload) => {
            const newPost = payload.new as Announcement;
            broadcastAnnouncement(newPost);
          },
        )
        .subscribe();
    },
    cancel() {
      clients.delete(controller);
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
