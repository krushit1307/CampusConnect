import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { z } from "https://esm.sh/zod@3.24.2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { limitRate } from "../shared/rate_limiter.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { computeCertificateLeafHash } from "../shared/merkle.ts";

const transcriptPayloadSchema = z
  .object({
    userId: z.string().min(1),
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await limitRate(req, "generate-volunteer-transcript", { limit: 10 });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth Header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid Auth Token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await parseJsonBody(req);
    const { userId } = transcriptPayloadSchema.parse(body);

    if (user.id !== userId) {
      // Allow only self or admin, but for simplicity here only self
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1. Fetch User Profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .single();

    if (!profile) throw new Error("Profile not found");

    // 2. Fetch all approved ledger entries for user
    const { data: ledgerEntries } = await supabaseAdmin
      .from("volunteer_ledger")
      .select("hours_credited, club_id, clubs(name), approved_at")
      .eq("user_id", userId)
      .eq("status", "approved");

    if (!ledgerEntries) throw new Error("Could not fetch ledger entries");

    const totalHours = ledgerEntries.reduce((sum, entry) => sum + Number(entry.hours_credited), 0);

    // Group by club
    const clubTotals: Record<string, number> = {};
    ledgerEntries.forEach((entry) => {
      const clubName = entry.clubs?.name || "Unknown Club";
      clubTotals[clubName] = (clubTotals[clubName] || 0) + Number(entry.hours_credited);
    });

    // 3. Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();

    // Title
    page.drawText("Official Volunteer Transcript", {
      x: 50,
      y: height - 100,
      size: 24,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    // Student Info
    page.drawText(`Student Name: ${profile.first_name} ${profile.last_name}`, {
      x: 50,
      y: height - 150,
      size: 14,
      font: helveticaFont,
    });

    page.drawText(`Student ID: ${userId}`, {
      x: 50,
      y: height - 170,
      size: 10,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Total Hours
    page.drawText(`Total Approved Hours: ${totalHours.toFixed(2)}`, {
      x: 50,
      y: height - 220,
      size: 18,
      font: helveticaBold,
    });

    // Breakdown
    page.drawText("Club-wise Breakdown:", {
      x: 50,
      y: height - 260,
      size: 14,
      font: helveticaBold,
    });

    let yOffset = height - 290;
    for (const [club, hours] of Object.entries(clubTotals)) {
      page.drawText(`${club}: ${hours.toFixed(2)} hours`, {
        x: 70,
        y: yOffset,
        size: 12,
        font: helveticaFont,
      });
      yOffset -= 20;
    }

    // Signature/Hash
    const dateStr = new Date().toISOString();
    page.drawText(`Generated: ${dateStr}`, {
      x: 50,
      y: 100,
      size: 10,
      font: helveticaFont,
    });

    // For Issue #2910, they store the hash in event_certificates. We will do the same or just sign it.
    const rawPdfBytes = await pdfDoc.save();

    // Convert bytes to hex for hashing
    const buffer = new Uint8Array(rawPdfBytes);
    let hexString = "";
    for (let i = 0; i < buffer.length; i++) {
      hexString += buffer[i].toString(16).padStart(2, "0");
    }
    const signature = await computeCertificateLeafHash(userId, "volunteer-transcript", hexString);

    // Add signature text at the bottom
    page.drawText(`Digital Signature (SHA-256): ${signature.substring(0, 32)}...`, {
      x: 50,
      y: 80,
      size: 10,
      font: helveticaFont,
      color: rgb(0.1, 0.1, 0.1),
    });

    const finalPdfBytes = await pdfDoc.save();

    return new Response(finalPdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="volunteer_transcript_${profile.last_name}.pdf"`,
        ...corsHeaders,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
