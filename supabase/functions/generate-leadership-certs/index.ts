import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { z } from "https://esm.sh/zod@3.24.2";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";
import * as qrcode from "https://esm.sh/qrcode@1.5.3";
import { limitRate } from "../shared/rate_limiter.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { computeCertificateLeafHash } from "../shared/merkle.ts";

const certPayloadSchema = z
  .object({
    record: z
      .object({
        certificate_id: z.string().optional(),
        certificateId: z.string().optional(),
        user_id: z.string().optional(),
        userId: z.string().optional(),
        club_id: z.string().optional(),
        clubId: z.string().optional(),
        member_id: z.string().optional(),
        memberId: z.string().optional(),
      })
      .strict()
      .optional(),
    certificate_id: z.string().optional(),
    certificateId: z.string().optional(),
    user_id: z.string().optional(),
    userId: z.string().optional(),
    club_id: z.string().optional(),
    clubId: z.string().optional(),
    member_id: z.string().optional(),
    memberId: z.string().optional(),
  })
  .strict()
  .refine(
    (v) => {
      const rec = v.record ?? v;
      return Boolean(rec.certificate_id || rec.certificateId || (rec.user_id || rec.userId) && (rec.club_id || rec.clubId));
    },
    { message: "Either certificate_id or both user_id and club_id are required" },
  );

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate Limiting: 30 requests per minute per IP
  const rateLimitResponse = await limitRate(req, "generate-leadership-certs", {
    limit: 30,
    windowMs: 60000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const authHeader = req.headers.get("Authorization");
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const parsed = await parseJsonBody(certPayloadSchema, req);
    if (!parsed.ok) return parsed.response;

    const payload = parsed.data;
    const record = payload.record || payload;

    let certId = record.certificate_id || record.certificateId;
    let userId = record.user_id || record.userId;
    let clubId = record.club_id || record.clubId;

    // 1. If certId is provided, fetch initial certificate metadata
    if (certId && (!userId || !clubId)) {
      const { data: existingCertRow } = await supabase
        .from("certificates")
        .select("id, user_id, club_id, certificate_url")
        .eq("id", certId)
        .maybeSingle();

      if (existingCertRow) {
        userId = userId || existingCertRow.user_id;
        clubId = clubId || existingCertRow.club_id;
      }
    }

    if (!userId || !clubId) {
      return new Response(JSON.stringify({ error: "Missing required user_id or club_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Query database for actual member role, joined_at, removed_at, termination_reason
    const { data: memberRow, error: memberError } = await supabase
      .from("club_members")
      .select(`
        id, user_id, club_id, status, joined_at, created_at, removed_at, termination_reason,
        club_roles (id, title, permissions_level),
        clubs (id, name, logo_url)
      `)
      .eq("user_id", userId)
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (memberError || !memberRow) {
      return new Response(
        JSON.stringify({ error: "No club membership record found for the specified user and club." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clubRole = Array.isArray(memberRow.club_roles) ? memberRow.club_roles[0] : memberRow.club_roles;
    const club = Array.isArray(memberRow.clubs) ? memberRow.clubs[0] : memberRow.clubs;

    const roleTitle = clubRole?.title || "Officer";
    const permissionsLevel = clubRole?.permissions_level ?? 0;

    // Require leadership role
    if (roleTitle.toLowerCase() === "member" && permissionsLevel < 50) {
      return new Response(
        JSON.stringify({ error: "Member did not hold a leadership role eligible for a Leadership Certificate." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Reject impeached members
    if (memberRow.termination_reason && memberRow.termination_reason.toLowerCase() === "impeached") {
      return new Response(
        JSON.stringify({ error: "Member was impeached and is ineligible for a Leadership Certificate." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Calculate tenure start and end dates strictly from database
    const rawTenureStart = memberRow.joined_at || memberRow.created_at;
    const rawTenureEnd = memberRow.removed_at || new Date().toISOString();

    const tenureStartMs = new Date(rawTenureStart).getTime();
    const tenureEndMs = new Date(rawTenureEnd).getTime();
    const tenureDays = Math.floor((tenureEndMs - tenureStartMs) / (1000 * 60 * 60 * 24));

    // Require at least 90 days of tenure
    if (tenureDays < 90) {
      return new Response(
        JSON.stringify({
          error: `Leadership tenure must be at least 90 days. Current calculated tenure is ${tenureDays} days.`,
          tenureDays,
          requiredDays: 90,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Idempotency Check: Prevent duplicate certificates for the same leadership tenure
    const { data: existingLeadershipCert } = await supabase
      .from("certificates")
      .select("id, certificate_url, verification_hash, verify_url, email_sent_at")
      .eq("user_id", userId)
      .eq("club_id", clubId)
      .eq("certificate_type", "leadership")
      .eq("role_title", roleTitle)
      .eq("tenure_start", rawTenureStart)
      .maybeSingle();

    if (
      existingLeadershipCert &&
      existingLeadershipCert.certificate_url &&
      existingLeadershipCert.certificate_url !== "pending"
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          url: existingLeadershipCert.certificate_url,
          verificationHash: existingLeadershipCert.verification_hash,
          verifyUrl: existingLeadershipCert.verify_url,
          emailSent: Boolean(existingLeadershipCert.email_sent_at),
          message: "Leadership certificate already generated idempotently",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Fetch user profile for recipient name snapshotting
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, full_name")
      .eq("id", userId)
      .single();

    const recipientName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      profile?.full_name ||
      "Distinguished Student Leader";

    const clubName = club?.name || "CampusConnect Organization";

    // 5. Initialize certificate DB row ID if not created yet
    if (!certId) {
      certId = existingLeadershipCert?.id;
    }

    if (!certId) {
      const { data: newCertRow, error: insertError } = await supabase
        .from("certificates")
        .upsert(
          {
            club_id: clubId,
            user_id: userId,
            attendee_name: recipientName,
            event_title: `Certificate of Leadership - ${roleTitle} (${clubName})`,
            certificate_type: "leadership",
            role_title: roleTitle,
            tenure_start: rawTenureStart,
            tenure_end: rawTenureEnd,
            termination_reason: memberRow.termination_reason || null,
            certificate_url: "pending",
          },
          { onConflict: "club_id,user_id,role_title,tenure_start" },
        )
        .select("id")
        .single();

      if (insertError || !newCertRow) {
        throw new Error(`Failed to create certificate database record: ${insertError?.message}`);
      }
      certId = newCertRow.id;
    }

    // 6. Compute Merkle Verification Hash and Public Verification URL (/verify-leadership?hash=XYZ)
    const verificationHash = computeCertificateLeafHash(clubId, userId, certId);
    const siteUrl = Deno.env.get("SITE_URL") ?? "";
    const verifyUrl = siteUrl
      ? `${siteUrl.replace(/\/+$/, "")}/verify-leadership?hash=${encodeURIComponent(verificationHash)}`
      : `/verify-leadership?hash=${encodeURIComponent(verificationHash)}`;

    // 7. Generate QR Code PNG image encoding the public /verify-leadership?hash=XYZ route
    let qrPngBytes: Uint8Array | null = null;
    try {
      const qrDataUrl = await qrcode.toDataURL(verifyUrl, {
        margin: 1,
        width: 180,
        color: { dark: "#1E293B", light: "#FFFFFF" },
      });
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
      qrPngBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    } catch (qrErr) {
      console.warn("Failed to generate QR code PNG:", qrErr);
    }

    // 8. Generate formal PDF document using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 420]); // Standard landscape certificate size
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const drawCenteredText = (
      text: string,
      y: number,
      font: PDFFont,
      defaultSize: number,
      color = rgb(0.1, 0.15, 0.25),
    ) => {
      const maxWidth = 520;
      let size = defaultSize;
      let textWidth = font.widthOfTextAtSize(text, size);
      if (textWidth > maxWidth) {
        size = Math.max(10, (maxWidth / textWidth) * size);
        textWidth = font.widthOfTextAtSize(text, size);
      }
      const x = (page.getWidth() - textWidth) / 2;
      page.drawText(text, { x, y, size, font, color });
    };

    // Draw elegant double border
    page.drawRectangle({
      x: 15,
      y: 15,
      width: 570,
      height: 390,
      borderColor: rgb(0.15, 0.25, 0.45), // Deep Navy
      borderWidth: 2,
    });
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 560,
      height: 380,
      borderColor: rgb(0.75, 0.6, 0.2), // Gold Accent
      borderWidth: 1,
    });

    // Try embedding University Logo if available in storage or public assets
    let logoEmbedded = false;
    try {
      const logoUrlToFetch = club?.logo_url || `${siteUrl}/favicon.png`;
      if (logoUrlToFetch && logoUrlToFetch.startsWith("http")) {
        const logoRes = await fetch(logoUrlToFetch);
        if (logoRes.ok) {
          const logoArrayBuffer = await logoRes.arrayBuffer();
          const logoImage = logoUrlToFetch.endsWith(".png")
            ? await pdfDoc.embedPng(logoArrayBuffer)
            : await pdfDoc.embedJpg(logoArrayBuffer);
          page.drawImage(logoImage, { x: 275, y: 350, width: 50, height: 50 });
          logoEmbedded = true;
        }
      }
    } catch {
      // Graceful fallback to typography header if logo fetch is unavailable
    }

    const headerY = logoEmbedded ? 325 : 345;
    drawCenteredText("CAMPUSCONNECT UNIVERSITY", headerY, fontBold, 16, rgb(0.2, 0.3, 0.5));
    drawCenteredText("CERTIFICATE OF LEADERSHIP", headerY - 30, fontBold, 24, rgb(0.1, 0.15, 0.3));
    drawCenteredText("THIS CERTIFIES THAT", headerY - 60, fontNormal, 11, rgb(0.4, 0.4, 0.4));

    // Recipient Name
    drawCenteredText(recipientName, headerY - 95, fontBold, 22, rgb(0.05, 0.1, 0.2));

    // Attribution statement
    drawCenteredText(
      `has served with distinction as ${roleTitle.toUpperCase()}`,
      headerY - 125,
      fontNormal,
      12,
      rgb(0.2, 0.25, 0.35),
    );
    drawCenteredText(`of ${clubName}`, headerY - 145, fontBold, 15, rgb(0.1, 0.2, 0.4));

    // Format tenure dates
    const startDateFormatted = new Date(rawTenureStart).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const endDateFormatted = new Date(rawTenureEnd).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    drawCenteredText(
      `Tenure: ${startDateFormatted} – ${endDateFormatted} (${tenureDays} Days of Service)`,
      headerY - 180,
      fontItalic,
      11,
      rgb(0.3, 0.35, 0.45),
    );

    // Verification Hash & Footer
    page.drawText(`Verification Hash: ${verificationHash.substring(0, 22)}...`, {
      x: 35,
      y: 45,
      size: 8,
      font: fontNormal,
      color: rgb(0.4, 0.45, 0.5),
    });
    page.drawText(`Certificate ID: ${certId}`, {
      x: 35,
      y: 32,
      size: 8,
      font: fontNormal,
      color: rgb(0.4, 0.45, 0.5),
    });

    // Embed QR code on PDF
    if (qrPngBytes) {
      const qrImage = await pdfDoc.embedPng(qrPngBytes);
      page.drawImage(qrImage, { x: 490, y: 30, width: 75, height: 75 });
      page.drawText("Scan to Verify", {
        x: 498,
        y: 22,
        size: 7,
        font: fontNormal,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    const pdfBytes = await pdfDoc.save();

    // 9. Save PDF file to Supabase Storage bucket 'certificates'
    const fileName = `${userId}/leadership_${clubId}_${certId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload leadership certificate to storage: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("certificates").getPublicUrl(fileName);

    // 10. Update certificate record in database with public URL and verification metadata
    const { error: updateError } = await supabase
      .from("certificates")
      .update({
        attendee_name: recipientName,
        event_title: `Certificate of Leadership - ${roleTitle} (${clubName})`,
        certificate_type: "leadership",
        role_title: roleTitle,
        tenure_start: rawTenureStart,
        tenure_end: rawTenureEnd,
        termination_reason: memberRow.termination_reason || null,
        certificate_url: publicUrlData.publicUrl,
        verification_hash: verificationHash,
        verify_url: verifyUrl,
        issued_at: new Date().toISOString(),
      })
      .eq("id", certId);

    if (updateError) {
      throw new Error(`Failed to update leadership certificate database row: ${updateError.message}`);
    }

    // 11. Dispatch Email Notification to Recipient
    let emailSent = false;
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const recipientEmail = userData?.user?.email;

    if (recipientEmail && !existingLeadershipCert?.email_sent_at) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const emailBody = {
        from: "CampusConnect <notifications@campusconnect.app>",
        to: [recipientEmail],
        subject: `Your Certificate of Leadership for ${clubName} is Ready! 🎖️`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
                .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; text-align: center; }
                .logo { font-size: 22px; font-weight: bold; color: #1e3a8a; }
                .btn-container { text-align: center; margin: 28px 0; }
                .btn { display: inline-block; background-color: #1e3a8a; color: #ffffff !important; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; }
                .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <span class="logo">🎖️ CampusConnect Leadership Award</span>
                </div>
                <p>Dear ${recipientName},</p>
                <p>Congratulations! Your official <strong>Certificate of Leadership</strong> for serving as <strong>${roleTitle}</strong> at <strong>${clubName}</strong> (${startDateFormatted} – ${endDateFormatted}) has been issued and cryptographically verified.</p>
                <p>You can view and download your verifiable PDF certificate from your student locker at any time.</p>
                <div class="btn-container">
                  <a href="${publicUrlData.publicUrl}" class="btn">Download Leadership Certificate</a>
                </div>
                <p style="font-size: 13px; color: #64748b;">Verification Link: <a href="${verifyUrl}">${verifyUrl}</a></p>
                <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} CampusConnect. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      };

      if (resendApiKey) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailBody),
          });

          if (res.ok) {
            emailSent = true;
          }
        } catch (e) {
          console.error("Failed to dispatch email via Resend:", e);
        }
      } else {
        emailSent = true;
      }

      if (emailSent) {
        await supabase
          .from("certificates")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", certId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        certificateId: certId,
        url: publicUrlData.publicUrl,
        verificationHash,
        verifyUrl,
        emailSent,
        roleTitle,
        tenureDays,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Leadership Certificate Generation Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
