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
        const { userId, eventSeriesId } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Track check_in_timestamp relative to event_start_time for each event in Series
        const { data: attendanceRecords, error: attError } = await supabase
            .from('user_event_attendance')
            .select('event_id, check_in_timestamp, events(start_time)')
            .eq('user_id', userId)
            .eq('event_series_id', eventSeriesId)
            .eq('status', 'attended')
            .order('events(start_time)', { ascending: true });

        if (attError || !attendanceRecords || attendanceRecords.length < 2) {
            // Not enough data to establish a trend
            return new Response(
                JSON.stringify({ risk_status: 'stable', message: 'Insufficient attendance data' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Build algorithm to detect negative delta trend
        const deltas: number[] = [];
        for (const record of attendanceRecords) {
            const startTime = new Date(record.events.start_time).getTime();
            const checkInTime = new Date(record.check_in_timestamp).getTime();
            const deltaMinutes = (checkInTime - startTime) / (1000 * 60); // Positive = late, Negative = early
            deltas.push(deltaMinutes);
        }

        // Calculate trend: compare average of first half vs second half
        const mid = Math.floor(deltas.length / 2);
        const firstHalfAvg = deltas.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
        const secondHalfAvg = deltas.slice(mid).reduce((a, b) => a + b, 0) / (deltas.length - mid);

        // If second half is significantly more late (higher positive delta) than first half
        const trendDegradation = secondHalfAvg - firstHalfAvg;

        let riskStatus = 'stable';
        let deltaTrend = 'neutral';

        if (trendDegradation > 15) { // Degrading by more than 15 minutes on average
            riskStatus = 'at_risk';
            deltaTrend = 'declining';
        } else if (trendDegradation < -10) {
            deltaTrend = 'improving';
        }

        const overallAvgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

        // 3. Flag the user's status in the database
        await supabase.from('user_series_engagement').upsert({
            user_id: userId,
            event_series_id: eventSeriesId,
            risk_status: riskStatus,
            average_check_in_delta_minutes: overallAvgDelta,
            delta_trend: deltaTrend,
        });

        return new Response(
            JSON.stringify({
                user_id: userId,
                risk_status: riskStatus,
                delta_trend: deltaTrend,
                average_delta_minutes: overallAvgDelta.toFixed(2),
                requires_intervention: riskStatus === 'at_risk',
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
