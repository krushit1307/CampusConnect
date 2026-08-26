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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response("Missing database configuration", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { event_id: eventId, club_id: clubId, is_nudge: isNudge = false } = await req.json();

    if (!eventId || !clubId) {
      return new Response("Missing event_id or club_id parameter", { status: 400 });
    }

    // Fetch the event, club, and venue details
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select(`
        id, title, start_date, end_date, max_attendees, av_requirements,
        clubs (name),
        venues (id, name, building, capacity, facility_manager_email, is_off_campus)
      `)
      .eq("id", eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return new Response(`Event not found: ${eventErr?.message || ""}`, { status: 404 });
    }

    const venue = event.venues;
    if (!venue) {
      return new Response("Event has no venue assigned", { status: 200 });
    }

    // Bypass off-campus venues
    if (venue.is_off_campus) {
      return new Response("Bypassing room request for off-campus venue", { status: 200 });
    }

    const managerEmail = venue.facility_manager_email || "facilities@campusconnect.test";

    // Check or insert booking request
    let token = crypto.randomUUID();
    const { data: existingRequest } = await supabase
      .from("room_booking_requests")
      .select("token, status")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingRequest) {
      token = existingRequest.token;
      // Update last_pinged_at to track nudge
      await supabase
        .from("room_booking_requests")
        .update({ last_pinged_at: new Date().toISOString() })
        .eq("event_id", eventId);
    } else {
      const { error: insertErr } = await supabase
        .from("room_booking_requests")
        .insert({
          event_id: eventId,
          club_id: clubId,
          venue_id: venue.id,
          token: token,
          status: "pending",
        });

      if (insertErr) {
        return new Response(`Failed to create request: ${insertErr.message}`, { status: 500 });
      }
    }

    // Build Magic Links
    const approveUrl = `${supabaseUrl}/functions/v1/respond-room-booking?token=${token}&action=approve`;
    const rejectUrl = `${supabaseUrl}/functions/v1/respond-room-booking?token=${token}&action=reject`;

    const subject = isNudge
      ? `[Reminder: Room Booking Request] Approval Needed: ${event.title}`
      : `[Room Booking Request] New Request: ${event.title} by ${event.clubs?.name}`;

    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 3px solid #000; background: #fff;">
        <h2 style="text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px;">Room Booking Request</h2>
        <p>A club has scheduled an event requiring room approval. Please review the details below:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; width: 150px;">Club Name:</td>
            <td style="padding: 6px 0;">${event.clubs?.name || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Event Title:</td>
            <td style="padding: 6px 0;">${event.title}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Venue:</td>
            <td style="padding: 6px 0;">${venue.name} (${venue.building})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Expected Capacity:</td>
            <td style="padding: 6px 0;">${event.max_attendees || "No Limit"} (Venue Max: ${venue.capacity})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Date & Time:</td>
            <td style="padding: 6px 0;">
              ${new Date(event.start_date).toLocaleString()} to ${new Date(event.end_date).toLocaleString()}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; vertical-align: top;">AV Requirements:</td>
            <td style="padding: 6px 0; font-style: italic; color: #555;">
              ${event.av_requirements || "No specific audio-visual requirements listed."}
            </td>
          </tr>
        </table>
        
        <p style="margin-top: 30px; font-weight: bold;">Please select an action to process this booking request:</p>
        <div style="margin: 20px 0;">
          <a href="${approveUrl}" style="background-color: #22c55e; color: #000; border: 2px solid #000; padding: 12px 24px; text-decoration: none; font-weight: bold; display: inline-block; margin-right: 15px; box-shadow: 3px 3px 0 0 #000;">
            APPROVE BOOKING
          </a>
          <a href="${rejectUrl}" style="background-color: #ef4444; color: #000; border: 2px solid #000; padding: 12px 24px; text-decoration: none; font-weight: bold; display: inline-block; box-shadow: 3px 3px 0 0 #000;">
            REJECT BOOKING
          </a>
        </div>
      </div>
    `;

    if (resendApiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "CampusConnect <approvals@campusconnect.test>",
          to: [managerEmail],
          subject,
          html: htmlBody,
        }),
      });

      if (!res.ok) {
        console.warn("Failed to send room request email via Resend:", await res.text());
      }
    } else {
      console.log(`[ROOM REQUEST EMAIL MOCK] to ${managerEmail}: ${subject}`);
      console.log(`Approve URL: ${approveUrl}`);
      console.log(`Reject URL: ${rejectUrl}`);
    }

    return new Response(JSON.stringify({ success: true, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
