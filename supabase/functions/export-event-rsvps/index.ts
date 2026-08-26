import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://esm.sh/zod@3.24.2";
// @ts-expect-error Deno requires .ts extension
import { parseJsonBody } from "../_shared/validation.ts";

const exportRsvpsSchema = z
  .object({
    eventId: z.string().uuid("eventId must be a valid UUID"),
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate user from Authorization token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request payload parameters
    const parsed = await parseJsonBody(exportRsvpsSchema, req);
    if (!parsed.ok) return parsed.response;
    const { eventId } = parsed.data;

    // 3. Confirm the event exists and the user is the organizer
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, created_by")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Only the event organizer can export RSVPs." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Setup chunk-by-chunk paginated query stream to avoid memory exhaustion
    const rsvpStream = new ReadableStream({
      async start(controller) {
        // Write CSV headers
        controller.enqueue("User Name,Email,RSVP Date,Status\n");

        let offset = 0;
        const limit = 500;

        try {
          while (true) {
            const { data: rsvps, error: rsvpError } = await supabase
              .from("event_rsvps")
              .select("user_id, checked_in, rsvp_at, profiles (full_name)")
              .eq("event_id", eventId)
              .range(offset, offset + limit - 1)
              .order("rsvp_at", { ascending: true });

            if (rsvpError) {
              console.error("[Export Service] Query failure:", rsvpError);
              controller.error(rsvpError);
              return;
            }

            if (!rsvps || rsvps.length === 0) {
              break;
            }

            for (const r of rsvps) {
              const { data: userData } = await supabase.auth.admin.getUserById(r.user_id);
              const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;

              const name = profile?.full_name ?? "";
              const email = userData?.user?.email ?? "";
              const rsvpDate = r.rsvp_at ?? "";
              const status = r.checked_in ? "Checked In" : "Registered";

              const escapeValue = (val: string) => {
                const str = String(val ?? "");
                return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
              };

              const csvLine = `${escapeValue(name)},${escapeValue(email)},${escapeValue(rsvpDate)},${escapeValue(status)}\n`;
              controller.enqueue(csvLine);
            }

            offset += limit;
          }
          controller.close();
        } catch (err) {
          console.error("[Export Service] Stream error:", err);
          controller.error(err);
        }
      },
    });

    // 5. Return the stream directly as a CSV file download
    return new Response(rsvpStream.pipeThrough(new TextEncoderStream()), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="event_${eventId}_rsvps.csv"`,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Export Service] Request handling failed:", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
