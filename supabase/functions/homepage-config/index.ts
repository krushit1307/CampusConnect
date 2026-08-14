import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers so our React frontend can talk to this function securely
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Initialize Supabase client using the auth header from the request
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    // 2. Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // 3. Fetch user data in parallel to keep it blazingly fast
    const [{ data: profile }, { count: subCount }, { count: buddyCount }] = await Promise.all([
      supabase.from("profiles").select("major").eq("id", user.id).single(),
      supabase
        .from("club_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "approved"),
      supabase.from("buddies").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    // 4. Build the dynamic carousel configuration
    const carousels = [];

    // Everyone gets the trending feed
    carousels.push({
      id: "trending",
      title: "Trending on Campus",
      rpc: null,
      fallback: true,
    });

    // If they have a major, give them the Major carousel
    if (profile?.major) {
      carousels.push({
        id: "major",
        title: `Events for ${profile.major} Majors`,
        rpc: "get_events_by_major",
      });
    }

    // If they are subscribed to clubs, give them the Subscriptions carousel
    if (subCount && subCount > 0) {
      carousels.push({
        id: "subscriptions",
        title: "From Your Clubs",
        rpc: "get_events_by_subscriptions",
      });
    }

    // If they have buddies, give them the Network carousel
    if (buddyCount && buddyCount > 0) {
      carousels.push({
        id: "network",
        title: "Trending in Your Network",
        rpc: "get_trending_in_network",
      });
    }

    // 5. COLD START LOGIC: If they have no major, no buddies, and no clubs...
    // Give them a 'Featured' fallback carousel so their page isn't empty!
    if (carousels.length === 1) {
      carousels.push({
        id: "featured",
        title: "Featured Campus Events",
        rpc: null,
        fallback: true,
      });
    }

    // 6. Send the configuration back to the React UI
    return new Response(JSON.stringify({ carousels }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
