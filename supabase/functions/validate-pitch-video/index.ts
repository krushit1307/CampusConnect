// =============================================================================
// Edge Function: Validate Pitch Video (FFMPEG pipeline)
// Issue: #3681 - Build an 'Interactive "Club Pitch" Video Carousel'
// Description: Runs after a pitch video upload. Probes the file with FFmpeg
// (via the configured media worker) to strictly enforce <=15s duration and a
// 9:16 vertical aspect ratio, then publishes the URL onto the clubs table.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_DURATION_S = 15.5;      // small tolerance for encoder rounding
const TARGET_ASPECT = 9 / 16;     // vertical
const ASPECT_TOLERANCE = 0.08;

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { club_id, object_path, public_url } = await req.json();
        if (!club_id || !object_path) throw new Error("Missing club_id or object_path");

        // Mark as processing immediately so the UI can poll
        await supabaseAdmin.from("clubs").update({ pitch_video_status: "processing" }).eq("id", club_id);

        // Probe via the media worker (ffprobe). Command used by the worker:
        //   ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration \
        //           -of default=noprint_wrappers=1 file.mp4
        const probeRes = await fetch(`${Deno.env.get("MEDIA_WORKER_URL")}/probe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bucket: "club-media", path: object_path }),
        });

        if (!probeRes.ok) throw new Error("Media probe failed");
        const probe = await probeRes.json();

        const duration = Number(probe.duration || 0);
        const width = Number(probe.width || 0);
        const height = Number(probe.height || 1);
        const aspect = width / height;

        // Strict validation: duration + vertical orientation
        if (duration > MAX_DURATION_S) {
            await supabaseAdmin.from("clubs").update({ pitch_video_status: "rejected" }).eq("id", club_id);
            throw new Error(`Video is ${duration.toFixed(1)}s. Pitch videos must be ≤ 15 seconds.`);
        }
        if (Math.abs(aspect - TARGET_ASPECT) > ASPECT_TOLERANCE) {
            await supabaseAdmin.from("clubs").update({ pitch_video_status: "rejected" }).eq("id", club_id);
            throw new Error("Pitch videos must be vertical (9:16).");
        }

        // Approve + publish
        const { error: updateError } = await supabaseAdmin
            .from("clubs")
            .update({
                pitch_video_url: public_url,
                pitch_video_status: "approved",
                pitch_video_duration_s: duration,
            })
            .eq("id", club_id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, duration, aspect }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
    } catch (error: any) {
        console.error("[ValidatePitchVideo] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
    }
});
