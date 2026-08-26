// =============================================================================
// Edge Function: Scan Receipt OCR
//  Issue: #3545 - Implement 'Automated Post-Event Expense Reconciliation'
//  Description: Triggered when a receipt image is uploaded. Passes the image 
//  to GPT-4o Vision API to extract structured financial data (vendor, total, 
//  date). Calculates the variance against the approved budget and updates the 
//  reconciliation status automatically.
//  =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { expense_id, image_url, approved_budget_cents } = await req.json();
        if (!expense_id || !image_url) throw new Error("Missing expense_id or image_url");

        // 1. Call GPT-4o Vision API
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are an expert receipt OCR system. Extract the vendor name, total amount in cents (integer), and date (YYYY-MM-DD). Return strictly as JSON."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extract the financial data from this receipt image." },
                        { type: "image_url", image_url: { url: image_url } }
                    ]
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 500,
        });

        const content = completion.choices[0].message.content;
        const parsed = JSON.parse(content || "{}");

        const vendor = parsed.vendor || "Unknown Vendor";
        const amountCents = parsed.total_amount_cents || parsed.total_cents || 0;
        const date = parsed.date || null;

        if (amountCents <= 0) throw new Error("Failed to extract a valid total amount from the receipt.");

        // 2. Calculate Variance against approved budget
        let variancePct = 0;
        let reconStatus: 'reconciled' | 'needs_audit' = 'reconciled';

        if (approved_budget_cents && approved_budget_cents > 0) {
            variancePct = ((amountCents - approved_budget_cents) / approved_budget_cents) * 100;
            variancePct = Math.round(variancePct * 100) / 100; // Round to 2 decimal places

            // If variance exceeds 10%, flag for manual audit
            if (Math.abs(variancePct) > 10) {
                reconStatus = 'needs_audit';
            }
        }

        // 3. Update the expense record
        await supabase
            .from("expenses")
            .update({
                ocr_vendor: vendor,
                ocr_amount_cents: amountCents,
                ocr_date: date,
                budget_variance_pct: variancePct,
                reconciliation_status: reconStatus,
                amount_cents: amountCents // Update the actual expense amount
            })
            .eq("id", expense_id);

        return new Response(
            JSON.stringify({
                success: true,
                vendor,
                amount_cents: amountCents,
                variance_pct: variancePct,
                status: reconStatus
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[ScanReceiptOCR] Error:", error);

        // Mark as failed OCR if extraction completely breaks
        if (req.body) {
            try {
                const body = await req.clone().json();
                if (body.expense_id) {
                    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
                    await supabaseAdmin.from("expenses").update({ reconciliation_status: 'failed_ocr' }).eq("id", body.expense_id);
                }
            } catch (e) { /* ignore */ }
        }

        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
