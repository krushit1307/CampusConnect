import { createClient } from '@supabase/supabase-js';
import { RescueEmailResponse } from '@/types/tutoring';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Triggers the automated dropout rescue workflow.
 * 
 * @param userId - The ID of the flagged user
 * @param eventSeriesId - The ID of the event series
 * @param seriesName - The name of the series for email personalization
 * @returns Promise<RescueEmailResponse>
 */
export async function triggerDropoutRescue(
    userId: string,
    eventSeriesId: string,
    seriesName: string
): Promise<RescueEmailResponse> {
    const { data, error } = await supabase.functions.invoke('trigger_dropout_rescue', {
        body: { userId, eventSeriesId, seriesName },
    });

    if (error) {
        console.error('Failed to trigger dropout rescue:', error);
        throw new Error(error.message || 'Failed to process rescue workflow');
    }

    return data as RescueEmailResponse;
}

/**
 * Fetches the total available tutoring credits for a user.
 */
export async function getAvailableCredits(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_available_tutoring_credits', {
        p_user_id: userId,
    });

    if (error) {
        console.error('Failed to fetch tutoring credits:', error);
        return 0;
    }

    return data || 0;
}
