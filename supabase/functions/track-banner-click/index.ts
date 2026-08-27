import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const DEBOUNCE_WINDOW_SECONDS = 60;
const DEBOUNCE_RADIUS_PCT = 5.0; // 5% coordinate tolerance for rage clicks

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { banner_id, user_id, x_pct, y_pct, viewport_width } = await req.json();

    if (!banner_id || x_pct === undefined || y_pct === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Filter Rage Clicks: Check if the user clicked nearby on this banner in the last 60s
    if (user_id) {
      const windowStart = new Date(Date.now() - DEBOUNCE_WINDOW_SECONDS * 1000).toISOString();
      
      const { data: recentClicks } = await supabase
        .from("sponsor_banner_clicks")
        .select("x_pct, y_pct")
        .eq("banner_id", banner_id)
        .eq("user_id", user_id)
        .gte("created_at", windowStart);

      if (recentClicks && recentClicks.length > 0) {
        const isRageClick = recentClicks.some((click) => {
          const xDiff = Math.abs(click.x_pct - x_pct);
          const yDiff = Math.abs(click.y_pct - y_pct);
          return xDiff <= DEBOUNCE_RADIUS_PCT && yDiff <= DEBOUNCE_RADIUS_PCT;
        });

        if (isRageClick) {
          // Silently ignore rage clicks to preserve clean analytical data
          return new Response(JSON.stringify({ status: "debounced" }), { status: 200 });
        }
      }
    }

    // Insert valid click event
    const { error } = await supabase.from("sponsor_banner_clicks").insert({
      banner_id,
      user_id: user_id || null,
      x_pct: Math.min(100, Math.max(0, x_pct)),
      y_pct: Math.min(100, Math.max(0, y_pct)),
      viewport_width: viewport_width || 0,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ status: "success" }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
