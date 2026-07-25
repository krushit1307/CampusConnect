import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/qrcode.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generates a QR code image for an RSVP record and uploads it to storage.
 *
 * Accepts: { rsvpId: string }
 * Returns: { qrCodeUrl: string }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rsvpId } = await req.json();

    if (!rsvpId) {
      return new Response(JSON.stringify({ error: "Missing rsvpId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the RSVP record
    const { data: rsvp, error: rsvpError } = await supabase
      .from("event_rsvps")
      .select("id, event_id, user_id")
      .eq("id", rsvpId)
      .single();

    if (rsvpError || !rsvp) {
      return new Response(JSON.stringify({ error: "RSVP not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the authenticated user owns this RSVP
    if (rsvp.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encode RSVP parameters into a QR code string
    const qrPayload = JSON.stringify({
      rsvpId: rsvp.id,
      eventId: rsvp.event_id,
      userId: rsvp.user_id,
    });

    // Generate QR code as SVG string
    const qr = qrcode(0, "M");
    qr.addData(qrPayload);
    qr.make();
    const qrSvg = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });

    // Encode SVG as bytes for storage upload
    const svgBytes = new TextEncoder().encode(qrSvg);

    // Upload the QR code image to the qrcodes storage bucket
    const filePath = `${user.id}/${rsvp.id}.svg`;
    const { error: uploadError } = await supabase.storage
      .from("qrcodes")
      .upload(filePath, svgBytes, {
        contentType: "image/svg+xml",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Retrieve the public URL for the uploaded QR code
    const {
      data: { publicUrl },
    } = supabase.storage.from("qrcodes").getPublicUrl(filePath);

    return new Response(JSON.stringify({ qrCodeUrl: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("QR Code Generation Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred generating the QR code." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
