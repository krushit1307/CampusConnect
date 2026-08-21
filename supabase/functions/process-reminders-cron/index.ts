import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendTwilioSms(phone: string, message: string): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[Twilio Mock] SMS simulation to: ${phone}. Msg: "${message}"`);
    return true; // Return true to complete job in mock/dev environments
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: phone,
          Body: message,
        }),
      }
    );
    return response.ok;
  } catch (err) {
    console.error("[Twilio Error] Failed to send SMS:", err);
    return false;
  }
}

async function sendSendGridEmail(email: string, subject: string, htmlContent: string): Promise<boolean> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "no-reply@campusconnect.app";

  if (!apiKey || apiKey.startsWith("mock-")) {
    console.log(`[SendGrid Mock] Email simulation to: ${email}. Subject: "${subject}". Content: "${htmlContent}"`);
    return true; // Return true to complete job in mock/dev environments
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: fromEmail },
        subject: subject,
        content: [{ type: "text/html", value: htmlContent }],
      }),
    });
    return response.ok;
  } catch (err) {
    console.error("[SendGrid Error] Failed to send Email:", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[Reminders Cron] Running poll and dequeue process...");

    // 1. Dequeue all due reminders (SKIP LOCKED)
    const { data: reminders, error: errDequeue } = await supabase.rpc(
      "dequeue_scheduled_reminders"
    );

    if (errDequeue) {
      console.error("Failed to dequeue reminders:", errDequeue);
      throw errDequeue;
    }

    console.log(`[Reminders Cron] Processing ${reminders?.length ?? 0} reminders.`);

    for (const job of reminders || []) {
      const { id, rsvp_id, stage, event_id, event_title, user_id, user_email, user_phone, user_first_name } = job;
      let success = false;

      try {
        if (stage === 1) {
          // Stage 1: Email (T-72h)
          console.log(`[Reminders Cron] Processing Stage 1 Email for user: ${user_email}, event: ${event_title}`);
          const subject = `Coming up! ${event_title}`;
          const html = `<p>Hi ${user_first_name || "there"},</p>
                        <p>This is a reminder that the event <strong>"${event_title}"</strong> is coming up in 3 days!</p>
                        <p>We look forward to seeing you there.</p>`;
          success = await sendSendGridEmail(user_email, subject, html);
        } else if (stage === 2) {
          // Stage 2: Push Notification (T-24h)
          console.log(`[Reminders Cron] Processing Stage 2 Push Notification for user: ${user_id}`);
          const pushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
          const res = await fetch(pushUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              user_id: user_id,
              title: `Upcoming Event: ${event_title}`,
              message: "Event tomorrow. Cancel if you can't make it.",
              url: `/events/${event_id}`,
            }),
          });
          success = res.ok;
          if (!res.ok) {
            const errText = await res.text();
            console.error(`Push Notification failed: ${errText}`);
          }
        } else if (stage === 3) {
          // Stage 3: SMS (T-1h)
          console.log(`[Reminders Cron] Processing Stage 3 SMS for user: ${user_phone}, event: ${event_title}`);
          const phone = user_phone || "";
          if (phone) {
            const qrCodeUrl = `https://campusconnect.app/events/checkin?rsvp=${rsvp_id}`;
            const message = `Hi ${user_first_name || "Student"}, "${event_title}" starts in 1 hour! Get your check-in QR code here: ${qrCodeUrl}`;
            success = await sendTwilioSms(phone, message);
          } else {
            console.warn(`[Reminders Cron] Skip Stage 3 SMS: User ${user_id} has no phone number.`);
            success = true; // Complete anyway as there is no phone number
          }
        }

        if (!success) {
          // Set status back to failed
          await supabase
            .from("scheduled_reminders")
            .update({ status: "failed", error_message: "Dispatch delivery failed." })
            .eq("id", id);
        }
      } catch (jobErr: any) {
        console.error(`[Reminders Cron] Error processing job ${id}:`, jobErr);
        await supabase
          .from("scheduled_reminders")
          .update({ status: "failed", error_message: jobErr.message })
          .eq("id", id);
      }
    }

    return new Response(JSON.stringify({ success: true, count: reminders?.length ?? 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Reminders Cron Error]:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
