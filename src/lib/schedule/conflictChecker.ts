import { createClient } from '@supabase/supabase-js';
import { ConflictCheckResult } from '@/types/schedule';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Checks if a user has an academic conflict with a specific event.
 * 
 * @param userId - The ID of the user
 * @param eventId - The ID of the event
 * @param eventStartTime - ISO string of event start time
 * @param eventEndTime - ISO string of event end time
 * @returns Promise<ConflictCheckResult>
 */
export async function checkAcademicConflict(
    userId: string,
    eventId: string,
    eventStartTime: string,
    eventEndTime: string
): Promise<ConflictCheckResult> {
    const { data, error } = await supabase.functions.invoke('check_academic_conflict', {
        body: { userId, eventId, eventStartTime, eventEndTime },
    });

    if (error) {
        console.error('Failed to check academic conflict:', error);
        throw new Error(error.message || 'Failed to process conflict check');
    }

    return data as ConflictCheckResult;
}

/**
 * Uploads or syncs a user's class schedule.
 * 
 * @param userId - The ID of the user
 * @param scheduleData - Array of class blocks to insert/update
 */
export async function syncUserSchedule(userId: string, scheduleData: any[]) {
    // Delete existing schedule for this user to avoid duplicates
    await supabase.from('user_schedules').delete().eq('user_id', userId);

    if (scheduleData.length > 0) {
        const { error } = await supabase.from('user_schedules').insert(
            scheduleData.map(block => ({
                user_id: userId,
                ...block
            }))
        );

        if (error) {
            throw new Error(error.message);
        }
    }
}
