import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { streamId, start, end } = await req.json();

    // 1. Boundary & parameter validation checks
    if (!streamId || start === undefined || end === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required timestamp parameters.' }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const duration = end - start;
    if (duration <= 0 || duration > 60) {
      return new Response(JSON.stringify({ error: 'Clip boundaries must sit between 1 and 60 seconds.' }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Map file output paths
    // In a real environment, sourceHlsManifest would securely point to your media server/CDN
    const sourceHlsManifest = `https://your-media-server.com/${streamId}/index.m3u8`;
    const clipFileName = `clip_${streamId}_${Date.now()}.mp4`;
    
    // In Deno Deploy edge, we must write to a writable temporary directory like /tmp
    // For local environments, this will map to OS temp directory
    const tempDir = await Deno.makeTempDir();
    const finalOutputPath = `${tempDir}/${clipFileName}`;

    // 3. Assemble and execute the FFmpeg slicing operational parameters
    // We use Deno.Command to spawn the ffmpeg process securely
    const command = new Deno.Command("ffmpeg", {
      args: [
        "-ss", start.toString(),
        "-i", sourceHlsManifest,
        "-t", duration.toString(),
        "-c:v", "copy",
        "-c:a", "copy",
        "-bsf:a", "aac_adtstoasc",
        "-movflags", "faststart",
        finalOutputPath
      ],
      stdout: "piped",
      stderr: "piped",
    });

    // Execute the process. 
    // Note: If running on hosted Supabase, 'ffmpeg' MUST be bundled in your custom runtime 
    // or this will gracefully fail.
    const { code, stderr } = await command.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      console.error("FFmpeg error:", errorText);
      throw new Error(`FFmpeg processing failed with exit code ${code}`);
    }

    // 4. In a real scenario, you'd upload 'finalOutputPath' to Supabase Storage here.
    // For now, we simulate the asset link generation for Open Graph tracking (Issue #3176)
    const shareableUrl = `https://campusconnect.app/clips/${clipFileName.replace('.mp4', '')}`;

    return new Response(JSON.stringify({
      success: true,
      fileName: clipFileName,
      shareableUrl: shareableUrl
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error('FFmpeg stream slice operation dropped:', error);
    return new Response(JSON.stringify({ success: false, error: 'Background transcoder engine error.' }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
