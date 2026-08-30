import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("CRON_SECRET_TOKEN");
const sendgridKey = Deno.env.get("SENDGRID_API_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Enforce cron authorization tokens
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized invocation" }), { status: 401 });
  }

  try {
    const { data: expiringContracts, error } = await supabase.rpc('audit_contract_expirations');
    if (error) throw error;

    const contracts = expiringContracts || [];
    console.log(`Auditing expiring contracts. Found: ${contracts.length}`);

    for (const contract of contracts) {
      const subject = `⚠️ Contract Expiration: ${contract.vendor_name} Discount`;
      let text = `Your discount contract with ${contract.vendor_name} expires in exactly 60 days (${contract.expiration_date}).\n\n`;
      if (contract.discount_terms) text += `Terms: ${contract.discount_terms}\n`;
      if (contract.contract_pdf_url) text += `Contract Document: ${contract.contract_pdf_url}\n`;
      text += `\nPlease contact them to renegotiate for next year to avoid paying full price.`;

      if (sendgridKey) {
          try {
              await fetch('https://api.sendgrid.com/v3/mail/send', {
                  method: 'POST',
                  headers: {
                      'Authorization': `Bearer ${sendgridKey}`,
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                      personalizations: [{
                          to: [{ email: contract.president_email }, { email: 'studentunion@university.edu' }]
                      }],
                      from: { email: Deno.env.get("COMPLIANCE_SENDER_EMAIL") || 'noreply@platform.edu' },
                      subject: subject,
                      content: [{ type: 'text/plain', value: text }]
                  })
              });
              console.log(`Expiration email sent to ${contract.president_email} for ${contract.vendor_name}`);
          } catch (emailError) {
              console.error(`Failed to send email for ${contract.vendor_name}`, emailError);
          }
      } else {
          console.warn(`[Simulated Email] To: ${contract.president_email} | Subject: ${subject}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processedCount: contracts.length }), {
        headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
    });
  }
});
