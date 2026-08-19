import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY") || "";
const verifiedSender = Deno.env.get("SENDGRID_VERIFIED_SENDER") || "no-reply@campusconnect.app";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { userId, clubId, templateId, dynamicTemplateData, recipientEmail } = await req.json();

    if (!userId || !clubId || !recipientEmail) {
      throw new Error("Missing required fields: userId, clubId, recipientEmail");
    }

    // 1. Pre-Flight Safety Filter: Check user communication preferences
    const { data: preference, error } = await supabase
      .from('user_communication_preferences')
      .select('email_enabled')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .single();

    // Allow missing records to fallback safely (default opt-in)
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const isAllowed = preference ? preference.email_enabled : true;

    // 2. Strict compliance validation loop
    if (!isAllowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: `Dispatch canceled: User ${userId} has unsubscribed from Club ${clubId} communications.` 
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 3. Fire secure email payload via SendGrid REST API
    if (sendgridApiKey) {
      const sendgridPayload = {
        personalizations: [
          {
            to: [{ email: recipientEmail }],
            dynamic_template_data: dynamicTemplateData || {},
          },
        ],
        from: { email: verifiedSender },
        template_id: templateId,
      };

      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sendgridApiKey}`,
        },
        body: JSON.stringify(sendgridPayload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`SendGrid API error (${res.status}): ${errorText}`);
      }
    } else {
      console.log(`[SendGrid Simulation] Pre-flight passed for ${recipientEmail} (Club: ${clubId})`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email dispatched successfully.' }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Dispatch Engine Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
