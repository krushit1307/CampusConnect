import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { z } from "https://esm.sh/zod@3.24.2";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";
import { limitRate } from "../shared/rate_limiter.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { computeCertificateLeafHash } from "../shared/merkle.ts";

// Accepts a storage/db webhook envelope ({ record: {...} }) or top-level payload.
const certPayloadSchema = z
  .object({
    record: z
      .object({
        event_id: z.string().optional(),
        eventId: z.string().optional(),
        user_id: z.string().optional(),
        userId: z.string().optional(),
      })
      .strict()
      .optional(),
    event_id: z.string().optional(),
    eventId: z.string().optional(),
    user_id: z.string().optional(),
    userId: z.string().optional(),
  })
  .strict()
  .refine(
    (v) => {
      const rec = v.record ?? v;
      const eventId = rec.event_id || rec.eventId;
      const userId = rec.user_id || rec.userId;
      return Boolean(eventId && userId);
    },
    { message: "eventId and userId are required" },
  );

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate Limiting: 5 requests per minute per IP
  const rateLimitResponse = await limitRate(req, "generate-event-certs", {
    limit: 5,
  // Rate Limiting: 30 requests per minute per IP
  const rateLimitResponse = await limitRate(req, "generate-event-certs", {
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
      throw new Error("Missing environment variables.");
    }

    // Initialize Supabase client with service role key for background webhook handling
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const parsed = await parseJsonBody(certPayloadSchema, req);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data;
    const record = payload.record || payload;
    const eventId = record.event_id || record.eventId;
    const userId = record.user_id || record.userId;

    if (!eventId || !userId) {
      return new Response(JSON.stringify({ error: "Missing eventId or userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Idempotency Check: Return existing generated certificate if already present
    const { data: existingCert } = await supabase
      .from("certificates")
      .select("id, certificate_url, verification_hash, verify_url, email_sent_at")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingCert && existingCert.certificate_url && existingCert.certificate_url !== "pending") {
      return new Response(
        JSON.stringify({
          success: true,
          url: existingCert.certificate_url,
          verificationHash: existingCert.verification_hash,
          verifyUrl: existingCert.verify_url,
          emailSent: Boolean(existingCert.email_sent_at),
          message: "Certificate already generated idempotently",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // 2. Fetch event details and check generates_certificate flag
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, event_date, start_date, generates_certificate, clubs(name)")
      .eq("id", eventId)
      .is("deleted_at", null)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.generates_certificate === false) {
      return new Response(
        JSON.stringify({ error: "Event is configured not to generate certificates" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const clubName = Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name;
    const actualEventDate = event.event_date || event.start_date || new Date().toISOString();

    // 3. Fetch attendee profile details for snapshotting
    const { data: attendee, error: attendeeError } = await supabase
      .from("profiles")
      .select("first_name, last_name, full_name")
      .eq("id", userId)
      .single();

    if (attendeeError) {
      console.warn(`Failed to fetch profile for user ${userId}, using default name`);
    }

    const fullName =
      [attendee?.first_name, attendee?.last_name].filter(Boolean).join(" ") ||
      attendee?.full_name ||
      "Student";

    // 4. Initialize or obtain existing certificate record ID
    let certId = existingCert?.id;
    if (!certId) {
      const { data: newCertRow, error: insertError } = await supabase
        .from("certificates")
        .upsert(
          {
            event_id: eventId,
            user_id: userId,
            attendee_name: fullName,
            event_title: event.title,
            event_date: actualEventDate,
            certificate_url: "pending",
          },
          { onConflict: "event_id,user_id" },
        )
        .select("id")
        .single();

      if (insertError || !newCertRow) {
        throw new Error(`Failed to save certificate record: ${insertError?.message}`);
      }
      certId = newCertRow.id;
    }

    // Compute secure Merkle verification hash and proof URL
    const verificationHash = computeCertificateLeafHash(eventId, userId, certId);
    const siteUrl = Deno.env.get("SITE_URL") ?? "";
    const verifyUrl = siteUrl
      ? `${siteUrl.replace(/\/+$/, "")}/verify?cert=${certId}`
      : `/verify?cert=${certId}`;

    // 5. Generate PDF using pdf-lib (with template fallback)
    let pdfDoc: PDFDocument;
    const { data: templateData } = await supabase.storage
      .from("certificates")
      .download("template.pdf");

    if (templateData) {
      const templateBuffer = await templateData.arrayBuffer();
      pdfDoc = await PDFDocument.load(templateBuffer);
    } else {
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([600, 400]);
    }

    const pages = pdfDoc.getPages();
    const page = pages[0] || pdfDoc.addPage([600, 400]);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const drawCenteredScaledText = (
      text: string,
      y: number,
      font: PDFFont,
      defaultSize: number,
      color = rgb(0, 0, 0),
    ) => {
      const maxWidth = 500;
      let size = defaultSize;
      let textWidth = font.widthOfTextAtSize(text, size);

      if (textWidth > maxWidth) {
        size = Math.max(10, (maxWidth / textWidth) * size);
        textWidth = font.widthOfTextAtSize(text, size);
      }

      const x = (page.getWidth() - textWidth) / 2;
      page.drawText(text, { x, y, size, font, color });
    };

    const formattedDate = new Date(actualEventDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    drawCenteredScaledText("Certificate of Attendance", 320, helveticaFont, 28, rgb(0, 0, 0));
    drawCenteredScaledText("This certifies that", 275, helveticaNormal, 14);
    drawCenteredScaledText(fullName, 235, helveticaFont, 24);
    drawCenteredScaledText("has successfully attended", 195, helveticaNormal, 14);
    drawCenteredScaledText(event.title, 155, helveticaFont, 20);
    drawCenteredScaledText(`Organized by ${clubName || "CampusConnect"}`, 120, helveticaNormal, 13);
    drawCenteredScaledText(`Date: ${formattedDate}`, 85, helveticaNormal, 12);
    page.drawText(`Verification Hash: ${verificationHash.substring(0, 18)}...`, {
      x: 140,
      y: 55,
      size: 9,
      font: helveticaNormal,
      color: rgb(0.4, 0.4, 0.4),
    });

    const pdfBytes = await pdfDoc.save();

    // 6. Upload PDF to Supabase Storage bucket 'certificates'
    const fileName = `${userId}/${eventId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload certificate for user ${userId}: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("certificates").getPublicUrl(fileName);

    // 7. Save certificate metadata in certificates table
    const { error: updateError } = await supabase
      .from("certificates")
      .update({
        attendee_name: fullName,
        event_title: event.title,
        event_date: actualEventDate,
        certificate_url: publicUrlData.publicUrl,
        verification_hash: verificationHash,
        verify_url: verifyUrl,
        issued_at: new Date().toISOString(),
      })
      .eq("id", certId);

    if (updateError) {
      throw new Error(`Failed to update certificate metadata for user ${userId}: ${updateError.message}`);
    }

    // 8. Deliver Email Notification to Attendee (Post-Generation Only & Idempotent)
    let emailSent = false;
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const recipientEmail = userData?.user?.email;

    if (recipientEmail && !existingCert?.email_sent_at) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const emailBody = {
        from: "CampusConnect <notifications@campusconnect.app>",
        to: [recipientEmail],
        subject: `Your Certificate of Attendance for ${event.title} is Ready! 🎓`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
                .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; text-align: center; }
                .logo { font-size: 22px; font-weight: bold; color: #4f46e5; }
                .btn-container { text-align: center; margin: 28px 0; }
                .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; }
                .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <span class="logo">🎓 CampusConnect Certificate</span>
                </div>
                <p>Hello ${fullName},</p>
                <p>Congratulations! Your official Certificate of Attendance for <strong>${event.title}</strong> (${formattedDate}) has been generated and stored.</p>
                <p>You can view and download your verifiable PDF certificate at any time from your account locker.</p>
                <div class="btn-container">
                  <a href="${publicUrlData.publicUrl}" class="btn">Download Certificate</a>
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
          } else {
            console.error("Resend email dispatch error:", await res.text());
          }
        } catch (e) {
          console.error("Failed to send certificate email via Resend:", e);
        }
      } else {
        console.log(`[generate-event-certs] Mock certificate email dispatched to ${recipientEmail}`);
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
        url: publicUrlData.publicUrl,
        verificationHash,
        verifyUrl,
        emailSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error("Internal Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
