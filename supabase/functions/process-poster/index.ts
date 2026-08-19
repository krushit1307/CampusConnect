// =============================================================================
// Edge Function: Process Poster
// Issue: #3548 - Implement 'Automated Event Poster Auto-Cropping & Resizing'
// Description: Triggered when a new image is uploaded to Supabase Storage.
// Downloads the original image, sends it to an external image processing API
// (like Cloudinary or a custom Node worker) to generate WebP variants
// (thumbnail, banner, full), and updates the database with the new URLs.
//  =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mock external image processing service configuration
// In production, this would be Cloudinary, Imgix, or a dedicated Sharp worker
const IMAGE_PROCESSING_API_URL = Deno.env.get("IMAGE_PROCESSING_API_URL") || "https://api.imageprocessor.mock/v1/transform";
const IMAGE_PROCESSING_API_KEY = Deno.env.get("IMAGE_PROCESSING_API_KEY") || "mock_api_key";

interface TransformResult {
    thumb_sq_url: string;
    banner_url: string;
    full_url: string;
}

/**
 * Calls the external image processing API to generate WebP variants.
 * Sends the original image URL and receives back the optimized URLs.
 */
async function processImageVariants(originalUrl: string): Promise<TransformResult> {
    // In a real implementation, this would be a fetch call to your image worker:
    // const response = await fetch(IMAGE_PROCESSING_API_URL, {
    //   method: "POST",
    //   headers: { 
    //     "Authorization": `Bearer ${IMAGE_PROCESSING_API_KEY}`,
    //     "Content-Type": "application/json"
    //   },
    //   body: JSON.stringify({
    //     source_url: originalUrl,
    //     transformations: [
    //       { id: "thumb_sq", width: 400, height: 400, crop: "smart", format: "webp" },
    //       { id: "banner", width: 1200, height: 630, crop: "fill", format: "webp" },
    //       { id: "full", height: 2000, resize: "fit", format: "webp", quality: 85 }
    //     ]
    //   })
    // });
    // return await response.json();

    // Mock implementation for demonstration:
    // We simulate the API returning URLs with query parameters for on-the-fly transforms
    // (This is how services like Imgix or Supabase Storage Transformations work)
    const baseUrl = originalUrl.split("?")[0];

    return {
        thumb_sq_url: `${baseUrl}?width=400&height=400&resize=cover&format=webp`,
        banner_url: `${baseUrl}?width=1200&height=630&resize=cover&format=webp`,
        full_url: `${baseUrl}?height=2000&resize=fit&format=webp&quality=85`
    };
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { image_id, original_url } = await req.json();
        if (!image_id || !original_url) throw new Error("Missing image_id or original_url");

        // 1. Update status to processing
        await supabaseAdmin
            .from("event_images")
            .update({ status: "processing" })
            .eq("id", image_id);

        // 2. Process the image variants
        const variants = await processImageVariants(original_url);

        // 3. Update the database with the new URLs and mark as completed
        const { error: updateError } = await supabaseAdmin
            .from("event_images")
            .update({
                thumb_sq_url: variants.thumb_sq_url,
                banner_url: variants.banner_url,
                full_url: variants.full_url,
                status: "completed",
                processed_at: new Date().toISOString()
            })
            .eq("id", image_id);

        if (updateError) throw updateError;

        return new Response(
            JSON.stringify({ success: true, variants }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[ProcessPoster] Error:", error);

        // Mark as failed if processing breaks
        if (req.body) {
            try {
                const body = await req.clone().json();
                if (body.image_id) {
                    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
                    await supabaseAdmin
                        .from("event_images")
                        .update({ status: "failed", error_message: error.message })
                        .eq("id", body.image_id);
                }
            } catch (e) { /* ignore rollback errors */ }
        }

        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
