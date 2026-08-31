import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!clientId || !clientSecret || !supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${url.origin}/functions/v1/spotify-oauth`;

    // 1. INITIATION FLOW
    if (!code) {
      const eventId = url.searchParams.get("event_id");
      const redirectBack = url.searchParams.get("redirect_back") || "";

      if (!eventId) {
        return new Response(JSON.stringify({ error: "Missing event_id parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stateVal = `${eventId}::${encodeURIComponent(redirectBack)}`;
      const spotifyAuthUrl = new URL("https://accounts.spotify.com/authorize");
      spotifyAuthUrl.searchParams.set("client_id", clientId);
      spotifyAuthUrl.searchParams.set("response_type", "code");
      spotifyAuthUrl.searchParams.set("redirect_uri", redirectUri);
      spotifyAuthUrl.searchParams.set(
        "scope",
        "user-modify-playback-state user-read-playback-state user-read-currently-playing playlist-modify-public playlist-modify-private",
      );
      spotifyAuthUrl.searchParams.set("state", stateVal);

      return Response.redirect(spotifyAuthUrl.toString(), 302);
    }

    // 2. CALLBACK FLOW
    if (!state) {
      return new Response(JSON.stringify({ error: "Missing state parameter on callback" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [eventId, encodedRedirectBack] = state.split("::");
    const redirectBack = decodeURIComponent(encodedRedirectBack || "");

    // Exchange code for tokens
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Failed to exchange code for tokens:", errText);
      return new Response(JSON.stringify({ error: "Failed to authenticate with Spotify" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store in public.event_spotify_auth
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { error: upsertError } = await supabase.from("event_spotify_auth").upsert({
      event_id: eventId,
      access_token,
      refresh_token,
      expires_at: expiresAt,
    });

    if (upsertError) {
      console.error("Error saving Spotify credentials:", upsertError);
      return new Response(JSON.stringify({ error: "Database storage error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Redirect user back to the event page
    return Response.redirect(redirectBack || `${url.origin}/events/${eventId}`, 302);
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
