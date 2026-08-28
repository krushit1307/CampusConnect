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
        const { userId, eventId, basePoints, clubId } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Fetch Event and Club info
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, name, club_id, event_series_id, event_series(name)')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            throw new Error('Event not found');
        }

        const targetClubId = event.club_id || clubId;

        // 2. Intercept: Check if the organizing club is currently on Active Probation (#4533)
        if (targetClubId) {
            // Check club_probations table
            const { data: activeProbations } = await supabase
                .from('club_probations')
                .select('id, status, expires_at, reason')
                .eq('club_id', targetClubId)
                .eq('status', 'active')
                .gt('expires_at', new Date().toISOString())
                .limit(1);

            // Also check clubs table status
            const { data: clubRecord } = await supabase
                .from('clubs')
                .select('status')
                .eq('id', targetClubId)
                .maybeSingle();

            const isProbation = (activeProbations && activeProbations.length > 0) || (clubRecord?.status === 'probation');

            if (isProbation) {
                // Log blocked attempt in ledger
                await supabase.from('ledger_transactions').insert({
                    user_id: userId,
                    event_id: eventId,
                    club_id: targetClubId,
                    amount: 0,
                    transaction_type: 'probation_blocked',
                    base_points: basePoints,
                    streak_multiplier: 0,
                    is_streak_bonus: false,
                    description: 'Point Accumulation is FROZEN due to active Disciplinary Probation.',
                });

                return new Response(
                    JSON.stringify({
                        success: false,
                        frozen: true,
                        points_awarded: 0,
                        club_id: targetClubId,
                        message: 'Point Accumulation is FROZEN due to active Disciplinary Probation.',
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
            }
        }

        let multiplier = 1.0;
        let consecutiveCount = 1;
        let streakMessage = `+${basePoints} Points Awarded!`;
        let isSeriesEvent = false;
        let seriesName = undefined;

        // 2. Query how many consecutive events in this series the user has attended
        if (event.event_series_id) {
            isSeriesEvent = true;
            seriesName = event.event_series?.name;

            const { data: streakData, error: streakError } = await supabase
                .from('user_series_streaks')
                .select('current_streak, max_streak')
                .eq('user_id', userId)
                .eq('event_series_id', event.event_series_id)
                .single();

            if (!streakError && streakData) {
                consecutiveCount = streakData.current_streak + 1;
                // 4. Apply the multiplier: Base Points * (1.5 ^ Consecutive Attendance Count)
                multiplier = Math.pow(1.5, consecutiveCount);

                // Update streak record
                await supabase
                    .from('user_series_streaks')
                    .update({
                        current_streak: consecutiveCount,
                        max_streak: Math.max(streakData.max_streak, consecutiveCount),
                        last_attended_event_id: eventId,
                        last_attended_at: new Date().toISOString(),
                    })
                    .eq('user_id', userId)
                    .eq('event_series_id', event.event_series_id);
            } else {
                // First time attending this series
                await supabase.from('user_series_streaks').insert({
                    user_id: userId,
                    event_series_id: event.event_series_id,
                    current_streak: 1,
                    max_streak: 1,
                    last_attended_event_id: eventId,
                });
            }

            const finalPoints = Math.round(basePoints * multiplier);
            streakMessage = `🔥 ${consecutiveCount}-Event Streak! ${finalPoints} Points Awarded!`;

            // Record the gamification reward in ledger
            await supabase.from('ledger_transactions').insert({
                user_id: userId,
                event_id: eventId,
                amount: finalPoints,
                transaction_type: 'gamification_reward',
                base_points: basePoints,
                streak_multiplier: multiplier,
                is_streak_bonus: consecutiveCount > 1,
                description: streakMessage,
            });

            // 5. Route the club's share of these points through the Student Union
            // Bank so an active Point Loan (#4840) garnishes 50% for repayment.
            if (targetClubId) {
                await supabase.rpc('garnish_club_points', {
                    p_club_id: targetClubId,
                    p_event_id: eventId,
                    p_gross_points: finalPoints,
                });
            }
        } else {
            // Standard points award for non-series events
            await supabase.from('ledger_transactions').insert({
                user_id: userId,
                event_id: eventId,
                amount: basePoints,
                transaction_type: 'gamification_reward',
                base_points: basePoints,
                streak_multiplier: 1.0,
                is_streak_bonus: false,
                description: `+${basePoints} Points Awarded!`,
            });

            if (targetClubId) {
                await supabase.rpc('garnish_club_points', {
                    p_club_id: targetClubId,
                    p_event_id: eventId,
                    p_gross_points: basePoints,
                });
            }
        }
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Check-in successful',
                points_awarded: Math.round(basePoints * multiplier),
                streak_count: consecutiveCount,
                multiplier: multiplier,
                is_series_event: isSeriesEvent,
                series_name: seriesName,
                streak_message: streakMessage,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
