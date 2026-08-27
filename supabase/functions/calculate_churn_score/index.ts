import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Heuristic weights based on historical churn data
const SIGNAL_WEIGHTS = {
    late_arrival_15min: 15,
    no_questions_asked: 10,
    no_email_click: 20,
    missed_session: 40,
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { userId, eventSeriesId } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Fetch attendance and engagement data for this user in this series
        const { data: attendance, error: attError } = await supabase
            .from('user_event_attendance')
            .select('event_id, check_in_timestamp, events(start_time), questions_asked')
            .eq('user_id', userId)
            .eq('event_series_id', eventSeriesId);

        if (attError) throw new Error(attError.message);

        const signals = [];
        let totalScore = 0;

        // 2. Analyze signals
        if (attendance && attendance.length > 0) {
            let lateCount = 0;
            let missedCount = 0;

            for (const record of attendance) {
                if (record.check_in_timestamp) {
                    const startTime = new Date(record.events.start_time).getTime();
                    const checkInTime = new Date(record.check_in_timestamp).getTime();
                    const lateMinutes = (checkInTime - startTime) / (1000 * 60);

                    if (lateMinutes > 15) {
                        lateCount++;
                    }
                } else {
                    missedCount++;
                }
            }

            if (lateCount >= 2) {
                signals.push({ signal_type: 'late_arrival', weight: SIGNAL_WEIGHTS.late_arrival_15min, triggered: true, details: `Late >= 15 mins ${lateCount} times` });
                totalScore += SIGNAL_WEIGHTS.late_arrival_15min;
            }

            if (missedCount >= 1) {
                signals.push({ signal_type: 'missed_session', weight: SIGNAL_WEIGHTS.missed_session, triggered: true, details: `Missed ${missedCount} sessions` });
                totalScore += SIGNAL_WEIGHTS.missed_session;
            }
        }

        // Cap score at 100
        totalScore = Math.min(totalScore, 100);

        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        if (totalScore >= 80) riskLevel = 'high';
        else if (totalScore >= 50) riskLevel = 'medium';

        // 3. Save to database
        const { error: upsertError } = await supabase.from('user_series_churn_risk').upsert({
            user_id: userId,
            event_series_id: eventSeriesId,
            flight_risk_score: totalScore,
            risk_level: riskLevel,
            engagement_signals: signals,
        });

        if (upsertError) throw new Error(upsertError.message);

        // 4. If high risk, trigger automated email (mocked here)
        if (riskLevel === 'high') {
            console.log(`[TRIGGER EMAIL] High risk detected for user ${userId}. Sending personalized check-in.`);
        }

        return new Response(
            JSON.stringify({
                user_id: userId,
                flight_risk_score: totalScore,
                risk_level: riskLevel,
                signals: signals,
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
