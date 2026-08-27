import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import {
  ImageMagick,
  initialize,
  MagickFormat,
  MagickGeometry,
} from "https://deno.land/x/imagemagick_deno@0.0.31/mod.ts";

await initialize();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_SOURCE_SIZE = 20 * 1024 * 1024; // 20MB limit

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileParam = url.searchParams.get("file");
    const widthParam = url.searchParams.get("width");

    if (!fileParam) {
      return new Response(JSON.stringify({ error: "Missing 'file' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the bucket and path from the file param (e.g. "images/path/to/banner.jpg")
    const parts = fileParam.split("/");
    const bucketId = parts[0];
    const objectPath = parts.slice(1).join("/");

    if (!bucketId || !objectPath) {
      return new Response(
        JSON.stringify({
          error: "Invalid 'file' parameter format. Expected 'bucket/path/to/file'.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Optional constraint on bucket (you can expand this allowlist as needed)
    const ALLOWED_BUCKETS = ["images", "avatars", "banners", "data-exports", "public"];
    if (!ALLOWED_BUCKETS.includes(bucketId)) {
      return new Response(JSON.stringify({ error: "Invalid bucket." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let width = parseInt(widthParam || "", 10);
    if (isNaN(width) || width <= 0) {
      width = 0; // Means we won't resize, just optimize
    } else if (width > 2000) {
      width = 2000; // clamp max width
    } else if (width < 10) {
      width = 10; // clamp min width
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase env vars");
    }

    // We use the service role key to fetch the image.
    // In a stricter setup, we could use the user's Auth header to verify RLS permissions.
    // For now, assuming standard public/private asset delivery where bucket access is allowed.
    // If we wanted to enforce RLS, we'd initialize supabase with `req.headers.get("Authorization")`.

    // We will initialize the client with service role just to download the file since it's an optimization proxy.
    // However, to prevent data exfiltration of private buckets, we should check if it's public.
    // If it's private, we must verify the user token!
    let supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      // If user provided auth, use it to enforce RLS!
      supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: authHeader } },
      });
    } else {
      // If no auth header, just use anon key to enforce public RLS
      supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "");
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(bucketId)
      .download(objectPath);

    if (downloadError) {
      return new Response(
        JSON.stringify({ error: "Image not found or unauthorized", details: downloadError }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (blob.size > MAX_SOURCE_SIZE) {
      return new Response(JSON.stringify({ error: "Image too large to process. Use raw URL." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = blob.type.toLowerCase();

    // Pass through GIFs to avoid heavy CPU processing
    if (contentType === "image/gif") {
      return new Response(blob, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/gif",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Determine target format based on Accept header
    const acceptHeader = req.headers.get("Accept") || "";
    let targetFormat = MagickFormat.Webp;
    let outContentType = "image/webp";

    if (acceptHeader.includes("image/avif")) {
      targetFormat = MagickFormat.Avif;
      outContentType = "image/avif";
    }

    const buffer = new Uint8Array(await blob.arrayBuffer());

    const optimizedBytes = await new Promise<Uint8Array>((resolve, reject) => {
      try {
        ImageMagick.read(buffer, (image) => {
          if (width > 0) {
            const aspect = image.width / image.height;
            const height = Math.round(width / aspect);
            image.resize(new MagickGeometry(width, height));
          }

          image.write(targetFormat, (data) => {
            resolve(new Uint8Array(data));
          });
        });
      } catch (err) {
        reject(err);
      }
    });

    return new Response(optimizedBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": outContentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        Vary: "Accept",
      },
    });
  } catch (error: any) {
    console.error("Optimization error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
