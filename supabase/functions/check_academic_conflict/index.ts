import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert time string (HH:mm) to minutes from midnight
function timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { userId, eventId, eventStartTime, eventEndTime } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Parse event times
        const eventStart = new Date(eventStartTime);
        const eventEnd = new Date(eventEndTime);
        const eventDay = eventStart.getDay();
        const eventStartMins = eventStart.getHours() * 60 + eventStart.getMinutes();
        const eventEndMins = eventEnd.getHours() * 60 + eventEnd.getMinutes();

        // Fetch user's schedule for that day of the week
        const { data: schedule, error } = await supabase
            .from('user_schedules')
            .select('course_name, course_code, start_time, end_time, is_mandatory')
            .eq('user_id', userId)
            .eq('day_of_week', eventDay)
            .eq('is_mandatory', true);

        if (error) {
            throw new Error('Failed to fetch user schedule');
        }

        const conflictingCourses: string[] = [];

        // Check for temporal intersection
        for (const block of schedule || []) {
            const blockStartMins = timeToMinutes(block.start_time);
            const blockEndMins = timeToMinutes(block.end_time);

            // Intersection logic: (StartA <= EndB) and (EndA >= StartB)
            if (eventStartMins <= blockEndMins && eventEndMins >= blockStartMins) {
                conflictingCourses.push(`${block.course_code} - ${block.course_name}`);
            }
        }

        const hasConflict = conflictingCourses.length > 0;

        if (hasConflict) {
            // 3. If true, waive the penalty.
            // 4. Insert a positive ledger transaction instead
            await supabase.from('ledger_transactions').insert({
                user_id: userId,
                event_id: eventId,
                amount: 0, // No penalty
                transaction_type: 'penalty_waived',
                description: 'Penalty Waived: Academic Conflict Detected.',
                metadata: { conflicting_courses: conflictingCourses }
            });
        }

        return new Response(
            JSON.stringify({
                has_conflict: hasConflict,
                conflicting_courses: conflictingCourses,
                penalty_waived: hasConflict,
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
