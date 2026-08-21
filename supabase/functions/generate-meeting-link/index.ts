import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_id, club_id, title, start_date, end_date, virtual_platform } = await req.json();

    if (!event_id || !club_id) {
      return new Response(
        JSON.stringify({ error: "Missing event_id or club_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platform = virtual_platform === "google_meet" ? "google_meet" : "zoom";

    let meeting_url = "";
    let meeting_password = "";
    let provider_id = "";

    if (platform === "zoom") {
      // 1. Fetch club credentials
      const { data: creds, error: dbErr } = await supabase
        .from("club_zoom_integrations")
        .select("zoom_account_id, zoom_client_id, zoom_client_secret")
        .eq("club_id", club_id)
        .maybeSingle();

      const isMockCreds = !creds || 
                          creds.zoom_account_id.includes("mock") || 
                          creds.zoom_client_id.includes("mock") ||
                          creds.zoom_client_secret.includes("mock");

      if (dbErr || isMockCreds) {
        // Fallback to mock Zoom link for local testing/dev
        const mockMeetingId = Math.floor(1000000000 + Math.random() * 9000000000);
        const mockPassword = Math.random().toString(36).substring(2, 8);
        meeting_url = `https://zoom.us/j/${mockMeetingId}?pwd=${mockPassword}`;
        meeting_password = mockPassword;
        provider_id = String(mockMeetingId);
      } else {
        // Real Server-to-Server Zoom OAuth
        const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${creds.zoom_account_id}`;
        const basicAuth = btoa(`${creds.zoom_client_id}:${creds.zoom_client_secret}`);
        
        const tokenRes = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          }
        });

        if (!tokenRes.ok) {
          const errMsg = await tokenRes.text();
          throw new Error(`Failed Zoom token generation: ${errMsg}`);
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // Calculate duration in minutes
        const duration = Math.max(30, Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / 60000));

        // Create Zoom Meeting
        const createMeetingUrl = "https://api.zoom.us/v2/users/me/meetings";
        const meetingRes = await fetch(createMeetingUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            topic: title,
            type: 2, // Scheduled meeting
            start_time: start_date,
            duration,
            settings: {
              join_before_host: true,
              waiting_room: false,
              meeting_authentication: false
            }
          })
        });

        if (!meetingRes.ok) {
          const errMsg = await meetingRes.text();
          throw new Error(`Failed to create Zoom meeting: ${errMsg}`);
        }

        const meetingData = await meetingRes.json();
        meeting_url = meetingData.join_url;
        meeting_password = meetingData.password || "";
        provider_id = String(meetingData.id);
      }
    } else {
      // Platform: Google Meet Mock Generation
      const mockCode1 = Math.random().toString(36).substring(2, 5);
      const mockCode2 = Math.random().toString(36).substring(2, 6);
      const mockCode3 = Math.random().toString(36).substring(2, 5);
      meeting_url = `https://meet.google.com/${mockCode1}-${mockCode2}-${mockCode3}`;
      provider_id = `meet-${mockCode1}${mockCode2}${mockCode3}`;
    }

    // 2. Insert into virtual_meetings table
    const { error: insertErr } = await supabase
      .from("virtual_meetings")
      .insert({
        event_id,
        club_id,
        platform,
        meeting_url,
        meeting_password: meeting_password || null,
        provider_id
      });

    if (insertErr) {
      throw new Error(`Failed to save virtual meeting to DB: ${insertErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        meeting: {
          platform,
          meeting_url,
          meeting_password,
          provider_id
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[generate-meeting-link] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
