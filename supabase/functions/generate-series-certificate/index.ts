// =============================================================================
// Edge Function: Generate Series Certificate
// Issue: #4048 - Implement 'Automated "Event Series" Certificate Generation'
// Description: Triggered when a user hits 100% series completion. Generates 
// a unique hash, creates a PDF via an external rendering service (or mock), 
// uploads it to storage, and records it in the verified_certificates table.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_CRON_SECRET")}` &&
        !authHeader?.startsWith("Bearer eyJ")) { // Allow service role or authenticated user
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { user_id, series_id, series_name, user_name } = await req.json();
        if (!user_id || !series_id || !series_name || !user_name) {
            throw new Error("Missing required fields");
        }

        // 1. Generate unique cryptographic hash
        const rawString = `${user_id}-${series_id}-${Date.now()}`;
        const verificationHash = createHash("sha256").update(rawString).digest("hex");

        // 2. Generate PDF (Mocked: In production, call a Puppeteer/React-PDF microservice)
        const mockPdfBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // "%PDF-1.4"
        const fileName = `certificates/${series_id}/${user_id}_${verificationHash}.pdf`;
        const appUrl = Deno.env.get("APP_URL") || "https://campusconnect.app";
        const verifyUrl = `${appUrl}/verify-certificate?hash=${verificationHash}`;

        // 3. Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from("club-documents")
            .upload(fileName, mockPdfBuffer, {
                contentType: "application/pdf",
                upsert: true,
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from("club-documents")
            .getPublicUrl(fileName);

        // 4. Record in database
        const { error: insertError } = await supabaseAdmin
            .from("verified_certificates")
            .insert({
                user_id,
                series_id,
                series_name,
                user_name,
                completion_date: new Date().toISOString().split('T')[0],
                verification_hash: verificationHash,
                pdf_url: publicUrl,
            });

        if (insertError) throw insertError;

        return new Response(
            JSON.stringify({ success: true, verification_hash: verificationHash, pdf_url: publicUrl, verify_url: verifyUrl }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    } catch (error: any) {
        console.error("[GenerateSeriesCertificate] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
