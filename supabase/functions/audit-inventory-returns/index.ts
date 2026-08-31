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
    return true;
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
        body: new URLSearchParams({ From: fromNumber, To: phone, Body: message }),
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
    return true;
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
        subject,
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

    console.log("[Inventory Audit Cron] Running audit_inventory_returns...");

    const { data: dueLoans, error } = await supabase.rpc("audit_inventory_returns");

    if (error) {
      console.error("Failed to audit inventory returns:", error);
      throw error;
    }

    console.log(`[Inventory Audit Cron] Processing ${dueLoans?.length ?? 0} loan(s).`);

    for (const loan of dueLoans || []) {
      const { item_name, borrower_email, borrower_phone, borrower_first_name, due_date, notice_type } = loan;

      try {
        if (notice_type === "reminder") {
          const subject = `Reminder: ${item_name} is due back tomorrow`;
          const html = `<p>Hi ${borrower_first_name || "there"},</p>
                        <p>Just a friendly reminder that <strong>${item_name}</strong> is due back on
                        ${new Date(due_date).toLocaleString()}.</p>
                        <p>Please return it on time so other members can use it. Thanks!</p>`;
          await sendSendGridEmail(borrower_email, subject, html);
        } else if (notice_type === "overdue") {
          if (borrower_phone) {
            const message = `URGENT: Your rental of ${item_name} is past due. Please return it immediately to avoid a hold on your student account.`;
            await sendTwilioSms(borrower_phone, message);
          } else {
            console.warn(`[Inventory Audit Cron] No phone on file for overdue borrower of ${item_name}; skipping SMS.`);
          }
        }
      } catch (jobErr: any) {
        console.error(`[Inventory Audit Cron] Error notifying for loan of ${item_name}:`, jobErr);
      }
    }

    return new Response(JSON.stringify({ success: true, count: dueLoans?.length ?? 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Inventory Audit Cron Error]:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});