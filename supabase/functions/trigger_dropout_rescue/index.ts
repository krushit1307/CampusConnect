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
        const { userId, eventSeriesId, seriesName } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Check if user already has a rescue credit for this series to prevent duplicates
        const { data: existingCredit } = await supabase
            .from('tutoring_credits')
            .select('id')
            .eq('user_id', userId)
            .eq('event_series_id', eventSeriesId)
            .eq('reason', 'dropout_rescue')
            .single();

        if (existingCredit) {
            return new Response(
                JSON.stringify({ success: true, message: 'Rescue credit already granted', creditsGranted: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Interface with P2P Tutoring ledger to deposit the credit
        const { error: creditError } = await supabase.from('tutoring_credits').insert({
            user_id: userId,
            event_series_id: eventSeriesId,
            credits_granted: 1,
            credits_used: 0,
            reason: 'dropout_rescue',
        });

        if (creditError) {
            throw new Error(`Failed to grant tutoring credit: ${creditError.message}`);
        }

        // 3. Fetch user email for notification
        const { data: userData } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();

        if (userData?.email) {
            // Mock email dispatch
            const bookingLink = `${Deno.env.get('APP_URL')}/tutoring/book?series=${eventSeriesId}&credit=applied`;

            console.log(`[EMAIL DISPATCH] To: ${userData.email}`);
            console.log(`Subject: Don't give up! You have a free tutoring session waiting.`);
            console.log(`Body: We noticed you missed a few sessions of ${seriesName}. We've credited your account with 1 Free Tutoring Session. Book here: ${bookingLink}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Dropout rescue workflow triggered successfully',
                creditsGranted: 1
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
