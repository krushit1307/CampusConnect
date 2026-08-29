import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, StandardFonts, rgb } from "https://cdn.skypack.dev/pdf-lib";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UNIVERSITY_EIN = "12-3456789"; // Mock EIN for the institution

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { description, acquisitionDate, marketValue, donorName, appraisalAttached } =
      await req.json();

    if (!description || !marketValue) {
      return new Response(JSON.stringify({ error: "Missing asset data." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 1. Generate the IRS Form 8283 structure
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Standard US Letter
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Draw Mock IRS Form Headers & Data
    page.drawText("Form 8283: Noncash Charitable Contributions", { x: 50, y: 730, size: 18, font });
    page.drawText(`Donor Name: ${donorName}`, { x: 50, y: 690, size: 12, font });
    page.drawText(`Donee Organization EIN: ${UNIVERSITY_EIN}`, { x: 50, y: 670, size: 12, font });

    page.drawText("Section A. Donated Property Information", { x: 50, y: 630, size: 14, font });
    page.drawText(`Asset Description: ${description}`, { x: 50, y: 600, size: 12, font });
    page.drawText(`Date Acquired: ${acquisitionDate}`, { x: 50, y: 580, size: 12, font });
    page.drawText(`Fair Market Value: $${marketValue}`, { x: 50, y: 560, size: 12, font });

    if (appraisalAttached) {
      page.drawText("Status: QUALIFIED APPRAISAL ATTACHED (See Appendix)", {
        x: 50,
        y: 530,
        size: 12,
        font,
        color: rgb(0.8, 0.1, 0.1),
      });
    }

    page.drawText("PENDING COUNTER-SIGNATURE FROM UNIVERSITY FINANCIAL OFFICE", {
      x: 50,
      y: 480,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // 2. Encode to save to database/storage
    const pdfBytes = await pdfDoc.save();

    // 3. Initialize Supabase Admin Client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 4. Route to Financial Office (Mock Database Insert)
    // Assuming 'tax_documents' table exists
    await supabaseClient.from("tax_documents").insert([
      {
        donor_name: donorName,
        status: "PENDING_FINANCE_SIGNATURE",
        asset_value: marketValue,
        requires_appraisal: appraisalAttached,
        created_at: new Date().toISOString(),
      },
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Form 8283 generated and routed to finance successfully.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("IRS form generation failed:", error);
    return new Response(JSON.stringify({ error: "Failed to process tax documents." }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
