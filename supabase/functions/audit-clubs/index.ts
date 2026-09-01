import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("CRON_SECRET_TOKEN");
const sendgridKey = Deno.env.get("SENDGRID_API_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Enforce cron authorization tokens to prevent unauthorized endpoint pings
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized invocation" }), { status: 401 });
  }

  try {
    // 1. Invoke the lifecycle transaction engine routine
    const { data: auditLogs, error } = await supabase.rpc('audit_club_activity_lifecycle');
    if (error) throw error;

    const logs = auditLogs || [];
    
    console.log(`Audited clubs. Processed: ${logs.length}`);

    // 2. Iterate over processing logs to send notification emails
    for (const log of logs) {
      if (log.action_taken === 'warning_issued') {
        const subject = `⚠️ Urgent: Inactivity Warning for ${log.club_name}`;
        const text = `The organization profile for ${log.club_name} has registered zero event activity for an entire academic semester. Create an upcoming event placeholder within 30 days to avoid automatic profile hibernation.`;

        if (sendgridKey) {
            try {
                // Using standard fetch for SendGrid in Deno
                await fetch('https://api.sendgrid.com/v3/mail/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sendgridKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        personalizations: [{
                            to: [{ email: log.president_email }, { email: 'studentunion@university.edu' }]
                        }],
                        from: { email: Deno.env.get("COMPLIANCE_SENDER_EMAIL") || 'noreply@platform.edu' },
                        subject: subject,
                        content: [{ type: 'text/plain', value: text }]
                    })
                });
                console.log(`Warning email sent to ${log.president_email} for ${log.club_name}`);
            } catch (emailError) {
                console.error(`Failed to send email to ${log.president_email}`, emailError);
            }
        } else {
            console.warn(`[Simulated Email] To: ${log.president_email} | Subject: ${subject}`);
        }
      } else if (log.action_taken === 'hibernated') {
        console.warn(`Club ${log.club_name} has been hibernated due to prolonged inactivity.`);
      }
    }

    return new Response(JSON.stringify({ success: true, processedCount: logs.length }), {
        headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
    });
  }
});
