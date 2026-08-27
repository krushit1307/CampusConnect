import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Forbidden: Invalid authorization token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const appUrl = Deno.env.get("APP_URL") || "https://campusconnect.app";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { newsletterId, clubId } = body;

    if (!newsletterId || !clubId) {
      return new Response(JSON.stringify({ error: "newsletterId and clubId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch newsletter record
    const { data: newsletter, error: newsErr } = await supabase
      .from("newsletters")
      .select("*")
      .eq("id", newsletterId)
      .single();

    if (newsErr || !newsletter) {
      throw new Error(`Newsletter not found: ${newsErr?.message}`);
    }

    // 2. Fetch club name
    const { data: club } = await supabase.from("clubs").select("name").eq("id", clubId).single();

    const clubName = club?.name || "CampusConnect Club";

    // 3. Update status to 'sending'
    await supabase
      .from("newsletters")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", newsletterId);

    // 4. Retrieve eligible members via get_eligible_newsletter_recipients RPC (excludes unsubscribed)
    let recipients: { user_id: string; email: string; first_name?: string }[] = [];
    try {
      const { data: rData, error: rErr } = await supabase.rpc(
        "get_eligible_newsletter_recipients",
        { p_club_id: clubId },
      );

      if (!rErr && Array.isArray(rData)) {
        recipients = rData;
      }
    } catch {
      // Fallback direct join query
      const { data: mData } = await supabase
        .from("club_members")
        .select("user_id, profiles(email, first_name)")
        .eq("club_id", clubId)
        .eq("status", "approved");

      if (mData) {
        recipients = mData
          .filter((m: any) => m.profiles?.email)
          .map((m: any) => ({
            user_id: m.user_id,
            email: m.profiles.email,
            first_name: m.profiles.first_name,
          }));
      }
    }

    if (recipients.length === 0) {
      await supabase
        .from("newsletters")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          total_recipients: 0,
          successful_sends: 0,
          failed_sends: 0,
        })
        .eq("id", newsletterId);

      return new Response(
        JSON.stringify({ message: "No eligible recipients found", newsletterId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5. Dispatch in batches of 50
    const batchSize = 50;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let successfulSends = 0;
    let failedSends = 0;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchEmails = batch.map((r) => r.email);

      // Build email content with tracking pixel & unsubscribe link
      const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-newsletter?n=${newsletterId}&type=open" width="1" height="1" style="display:none" alt="" />`;
      const unsubscribeFooter = `
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-family: sans-serif; font-size: 11px; color: #777;">
          <p>You received this email because you are a member of <strong>${clubName}</strong>.</p>
          <p>Don't want to receive newsletters from this club? <a href="${appUrl}/unsubscribe?clubId=${clubId}" style="color: #4f46e5; text-decoration: underline;">Unsubscribe from ${clubName} Newsletters</a>.</p>
        </div>
      `;

      const finalHtml = `${newsletter.content_html}${trackingPixel}${unsubscribeFooter}`;

      const emailPayload = {
        from: `${clubName} <notifications@campusconnect.app>`,
        to: ["notifications@campusconnect.app"], // Dummy to header; recipients in bcc
        bcc: batchEmails,
        subject: newsletter.subject || `Newsletter from ${clubName}`,
        html: finalHtml,
      };

      try {
        if (resendApiKey) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailPayload),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error("Resend API Batch Error:", errData);
            failedSends += batch.length;
          } else {
            successfulSends += batch.length;
          }
        } else {
          // Mock send in test/dev
          console.log(
            `[newsletter-worker] Mock batch of ${batch.length} emails sent for club ${clubName}`,
          );
          successfulSends += batch.length;
        }
      } catch (err) {
        console.error("Batch dispatch exception:", err);
        failedSends += batch.length;
      }

      // Throttle 1 second between batches
      if (i + batchSize < recipients.length) {
        await delay(1000);
      }
    }

    // 6. Update newsletter status to 'sent'
    await supabase
      .from("newsletters")
      .update({
        status: failedSends > 0 && successfulSends === 0 ? "failed" : "sent",
        sent_at: new Date().toISOString(),
        total_recipients: recipients.length,
        successful_sends: successfulSends,
        failed_sends: failedSends,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newsletterId);

    return new Response(
      JSON.stringify({
        message: "Newsletter dispatch completed",
        newsletterId,
        totalRecipients: recipients.length,
        successfulSends,
        failedSends,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("newsletter-worker error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
