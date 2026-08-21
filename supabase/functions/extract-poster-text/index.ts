// =============================================================================
// Edge Function: Extract Poster Text (OCR Pipeline)
// Issue: #3664 - Implement 'Real-Time "Translation Overlay" for Posters'
// Description: Triggered after a poster upload. Downloads the image, runs OCR
// (Google Cloud Vision TEXT_DETECTION) to extract text AND bounding boxes,
// normalizes the coordinates to 0..1 space, groups words into line blocks and
// persists the JSON map onto the events table.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GCV_KEY = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY") || "";

interface Vertex { x: number; y: number; }
interface RawBlock { text: string; vertices: Vertex[]; confidence: number; }
interface NormalizedBox { x: number; y: number; w: number; h: number; }
interface OcrBlockOut {
    id: string;
    text: string;
    box: NormalizedBox;
    fontSizeRatio: number;
    confidence: number;
}

/**
 * Groups raw word-level annotations into visual line blocks by comparing
 * vertical overlap of their bounding boxes.
 */
function groupWordsIntoLines(words: RawBlock[]): RawBlock[] {
    const lines: RawBlock[] = [];
    for (const word of words) {
        const wordTop = Math.min(...word.vertices.map(v => v.y));
        const wordBottom = Math.max(...word.vertices.map(v => v.y));
        const wordHeight = wordBottom - wordTop;

        // Find an existing line whose vertical range overlaps > 50%
        const line = lines.find(l => {
            const lTop = Math.min(...l.vertices.map(v => v.y));
            const lBottom = Math.max(...l.vertices.map(v => v.y));
            const overlap = Math.min(wordBottom, lBottom) - Math.max(wordTop, lTop);
            return overlap > wordHeight * 0.5;
        });

        if (line) {
            line.text += " " + word.text;
            line.vertices = line.vertices.concat(word.vertices);
            line.confidence = Math.min(line.confidence, word.confidence);
        } else {
            lines.push({ ...word });
        }
    }
    return lines;
}

/**
 * Normalizes absolute pixel vertices into a 0..1 bounding box.
 */
function normalizeBox(vertices: Vertex[], imgW: number, imgH: number): NormalizedBox {
    const xs = vertices.map(v => v.x);
    const ys = vertices.map(v => v.y);
    const minX = Math.min(...xs) / imgW;
    const minY = Math.min(...ys) / imgH;
    const maxX = Math.max(...xs) / imgW;
    const maxY = Math.max(...ys) / imgH;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
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

        const { event_id, image_url } = await req.json();
        if (!event_id || !image_url) throw new Error("Missing event_id or image_url");

        // 1. Download the poster image bytes
        const imgRes = await fetch(image_url);
        if (!imgRes.ok) throw new Error("Failed to download poster image");
        const imageBytes = new Uint8Array(await imgRes.arrayBuffer());

        // 2. Call Google Cloud Vision TEXT_DETECTION
        const gcvRes = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${GCV_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requests: [{
                        image: { content: btoa(String.fromCharCode(...imageBytes)) },
                        features: [{ type: "TEXT_DETECTION" }],
                    }],
                }),
            }
        );
        if (!gcvRes.ok) throw new Error("OCR service failure");
        const gcvJson = await gcvRes.json();

        const annotation = gcvJson.responses?.[0]?.textAnnotations;
        if (!annotation || annotation.length === 0) {
            // No detectable text: store empty payload so the UI skips the overlay
            await supabaseAdmin.from("events")
                .update({ poster_ocr_data: { blocks: [] }, poster_source_language: "en" })
                .eq("id", event_id);
            return new Response(JSON.stringify({ success: true, blocks: 0 }), { headers: corsHeaders });
        }

        // 3. Use full-text annotation for language + page dimensions, and the
        //    paragraph/word level annotations for boxes. We approximate image size
        //    from the first (whole-image) annotation bounds.
        const whole = annotation[0];
        const imgW = Math.max(...whole.vertices.map((v: Vertex) => v.x));
        const imgH = Math.max(...whole.vertices.map((v: Vertex) => v.y));

        // Words arrive as annotation[1..n]; group them into visual lines
        const rawWords: RawBlock[] = annotation.slice(1).map((a: any) => ({
            text: a.description,
            vertices: a.vertices,
            confidence: 0.9,
        }));
        const lines = groupWordsIntoLines(rawWords);

        // 4. Normalize + build output blocks
        const blocks: OcrBlockOut[] = lines.map((line, idx) => {
            const box = normalizeBox(line.vertices, imgW, imgH);
            return {
                id: `blk_${idx}`,
                text: line.text.trim(),
                box,
                // Approximate font size as 80% of the line box height (relative)
                fontSizeRatio: box.h * 0.8,
                confidence: line.confidence,
            };
        });

        // 5. Detect dominant language (GCV returns locale on the first annotation)
        const locale: string = (gcvJson.responses?.[0]?.fullTextAnnotation?.pages?.[0] as any)?.locale || "en";

        // 6. Persist onto the events table
        const { error: updateError } = await supabaseAdmin
            .from("events")
            .update({
                poster_ocr_data: { blocks, width: imgW, height: imgH },
                poster_source_language: locale.toLowerCase().slice(0, 2),
            })
            .eq("id", event_id);

        if (updateError) throw updateError;

        return new Response(
            JSON.stringify({ success: true, blocks: blocks.length, language: locale }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    } catch (error: any) {
        console.error("[ExtractPosterText] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
