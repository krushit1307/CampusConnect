import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Find jobs expiring in exactly 7 days
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() + 6); // 24-hour window

        const { data: expiringJobs, error: fetchError } = await supabase
            .from('alumni_jobs')
            .select('id, title, company, expires_at, renewal_token, alumni_id, profiles(email, full_name)')
            .eq('status', 'active')
            .gte('expires_at', sevenDaysAgo.toISOString())
            .lte('expires_at', sevenDaysFromNow.toISOString());

        if (fetchError) {
            throw new Error(`Failed to fetch expiring jobs: ${fetchError.message}`);
        }

        const results = [];
        for (const job of expiringJobs || []) {
            const renewalUrl = `${Deno.env.get('APP_URL')}/api/jobs/renew?token=${job.renewal_token}&jobId=${job.id}`;

            // In a production environment, this would call Resend/SendGrid API
            // For this implementation, we log the email dispatch
            const emailPayload = {
                to: job.profiles?.email,
                subject: `Action Required: Your job posting "${job.title}" expires in 7 days`,
                html: `
          <p>Hello ${job.profiles?.full_name},</p>
          <p>Your job posting for <strong>${job.title}</strong> at <strong>${job.company}</strong> is set to expire on ${new Date(job.expires_at).toLocaleDateString()}.</p>
          <p>Is this position still open? Click the link below to renew it for an additional 30 days:</p>
          <a href="${renewalUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Renew Job Posting</a>
          <p>If you do not take action, this posting will be automatically archived.</p>
        `
            };

            // Mock email sending
            console.log(`[EMAIL DISPATCH] To: ${emailPayload.to}, Subject: ${emailPayload.subject}`);

            results.push({ jobId: job.id, emailSent: true });
        }

        return new Response(
            JSON.stringify({ success: true, processed: results.length, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
