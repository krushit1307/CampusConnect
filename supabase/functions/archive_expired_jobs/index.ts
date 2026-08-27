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

        const now = new Date().toISOString();

        // Find active jobs that have passed their expiration date
        const { data: expiredJobs, error: fetchError } = await supabase
            .from('alumni_jobs')
            .select('id, title, alumni_id')
            .eq('status', 'active')
            .lt('expires_at', now);

        if (fetchError) {
            throw new Error(`Failed to fetch expired jobs: ${fetchError.message}`);
        }

        if (!expiredJobs || expiredJobs.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: 'No expired jobs found', processed: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const jobIds = expiredJobs.map(job => job.id);

        // Update status to archived
        const { error: updateError } = await supabase
            .from('alumni_jobs')
            .update({
                status: 'archived',
                archived_at: now
            })
            .in('id', jobIds);

        if (updateError) {
            throw new Error(`Failed to archive jobs: ${updateError.message}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully archived ${expiredJobs.length} jobs`,
                processed: expiredJobs.length,
                archivedJobIds: jobIds
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
