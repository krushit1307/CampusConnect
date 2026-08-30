import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getOrRefreshAccessToken(supabase: any, eventId: string) {
  const { data, error } = await supabase
    .from("event_spotify_auth")
    .select("*")
    .eq("event_id", eventId)
    .single();

  if (error || !data) return null;

  const now = new Date();
  const expiresAt = new Date(data.expires_at);

  if (expiresAt > now) {
    return { accessToken: data.access_token, lastInjectedTrackId: data.last_injected_track_id };
  }

  // Need to refresh token
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error("Spotify credentials missing from environment");
    return null;
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Failed to refresh Spotify token:", await tokenRes.text());
    return null;
  }

  const tokenData = await tokenRes.json();
  const newAccessToken = tokenData.access_token;
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const updateFields: any = {
    access_token: newAccessToken,
    expires_at: newExpiresAt,
  };
  if (tokenData.refresh_token) {
    updateFields.refresh_token = tokenData.refresh_token;
  }

  await supabase.from("event_spotify_auth").update(updateFields).eq("event_id", eventId);

  return { accessToken: newAccessToken, lastInjectedTrackId: data.last_injected_track_id };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { eventId } = await req.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const spotifyAuth = await getOrRefreshAccessToken(supabase, eventId);
    if (!spotifyAuth) {
      return new Response(
        JSON.stringify({ error: "Spotify account not linked or error refreshing token" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { accessToken, lastInjectedTrackId } = spotifyAuth;

    // 1. Fetch currently playing track
    const currentlyPlayingRes = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    let currentTrackId: string | null = null;
    if (currentlyPlayingRes.ok && currentlyPlayingRes.status !== 204) {
      const data = await currentlyPlayingRes.json();
      currentTrackId = data.item?.id || null;
    }

    // 2. Fetch the highest voted unplayed track in the queue
    const { data: queuedTracks, error: fetchErr } = await supabase
      .from("song_requests")
      .select("*")
      .eq("event_id", eventId)
      .eq("played", false)
      .order("upvotes", { ascending: false })
      .order("downvotes", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchErr || !queuedTracks || queuedTracks.length === 0) {
      return new Response(JSON.stringify({ message: "No queued songs to inject" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nextTrack = queuedTracks[0];

    // If a song is currently playing, and it is the same as the last injected song,
    // don't inject the next one yet to avoid overloading the playback queue.
    if (currentTrackId && currentTrackId === lastInjectedTrackId) {
      return new Response(
        JSON.stringify({ message: "Last injected song is currently playing, waiting" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Inject to Spotify playback queue
    const injectRes = await fetch(
      `https://api.spotify.com/v1/me/player/queue?uri=spotify:track:${nextTrack.spotify_track_id}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!injectRes.ok) {
      const errText = await injectRes.text();
      console.error("Failed to inject track to Spotify queue:", errText);
      return new Response(JSON.stringify({ error: "Failed to queue song on Spotify" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Update databases
    await supabase.from("song_requests").update({ played: true }).eq("id", nextTrack.id);

    await supabase
      .from("event_spotify_auth")
      .update({ last_injected_track_id: nextTrack.spotify_track_id })
      .eq("event_id", eventId);

    return new Response(
      JSON.stringify({ success: true, message: `Injected song: ${nextTrack.title}` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in sync-spotify-queue:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
