import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
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

    // Initialize Supabase client with admin privileges since this is a background webhook
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const record = payload.record || payload;
    const eventId = record.event_id || record.eventId;
    const userId = record.user_id || record.userId;

    if (!eventId || !userId) {
      return new Response(JSON.stringify({ error: "Missing eventId or userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("title, event_date, clubs(name)")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    if (new Date(event.event_date).getTime() > Date.now()) {
      return new Response(
        JSON.stringify({ error: "Cannot generate certificates for future events" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const clubName = Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name;

    // 2. Fetch specific attendee profile
    const { data: attendee, error: attendeeError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    if (attendeeError) {
      console.warn(`Failed to fetch profile for user ${userId}, using default name`);
    }

    const fullName = attendee?.full_name || "Student";

    // 3. Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText("Certificate of Participation", {
      x: 100,
      y: 320,
      size: 30,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(`This certifies that`, { x: 230, y: 270, size: 16, font: helveticaNormal });
    page.drawText(fullName, {
      x: 200,
      y: 230,
      size: 24,
      font: helveticaFont,
    });
    page.drawText(`has successfully participated in`, {
      x: 190,
      y: 190,
      size: 16,
      font: helveticaNormal,
    });
    page.drawText(event.title, { x: 150, y: 150, size: 20, font: helveticaFont });
    page.drawText(`Organized by ${clubName || "CampusConnect"}`, {
      x: 200,
      y: 110,
      size: 14,
      font: helveticaNormal,
    });

    const dateStr = event.event_date
      ? new Date(event.event_date).toLocaleDateString()
      : new Date().toLocaleDateString();
    page.drawText(`Date: ${dateStr}`, { x: 250, y: 70, size: 12, font: helveticaNormal });

    const pdfBytes = await pdfDoc.save();

    // Upload to storage
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

    // Save to database
    const { error: insertError } = await supabase.from("certificates").upsert(
      {
        event_id: eventId,
        user_id: userId,
        certificate_url: publicUrlData.publicUrl,
      },
      { onConflict: "event_id,user_id" },
    );

    if (insertError) {
      throw new Error(`Failed to save record for user ${userId}: ${insertError.message}`);
    }

    return new Response(JSON.stringify({ success: true, url: publicUrlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
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
