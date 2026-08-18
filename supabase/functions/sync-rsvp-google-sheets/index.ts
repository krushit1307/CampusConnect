import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { event_id, user_id, status, spreadsheet_id, club_id } = await req.json();

    // 1. Fetch Google integration refresh token
    const { data: integration, error: integrationErr } = await supabaseClient
      .from("google_sheets_integrations")
      .select("refresh_token")
      .eq("club_id", club_id)
      .single();

    if (integrationErr || !integration) {
      throw new Error(`Google Sheets integration not found for club ${club_id}`);
    }

    // 2. Fetch User Profile
    const { data: profile, error: profileErr } = await supabaseClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", user_id)
      .single();

    if (profileErr || !profile) {
      throw new Error(`User profile not found for user ${user_id}`);
    }

    // 3. Exchange refresh_token for a fresh access_token
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: integration.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Google token refresh failed: ${await tokenRes.text()}`);
    }

    const { access_token } = await tokenRes.json();

    // 4. Append row to Google Sheet
    const rsvpTime = new Date().toISOString();
    const rowValues = [
      profile.full_name || "Anonymous",
      profile.email || "No Email",
      status || "Unknown",
      rsvpTime,
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/A1:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [rowValues],
        }),
      }
    );

    if (!appendRes.ok) {
      throw new Error(`Google Sheets append failed: ${await appendRes.text()}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
