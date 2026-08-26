// =============================================================================
// Hook: useNoShowAnalytics
//  Issue: #3563 - Implement 'Automated Post-Event "No-Show" Feedback Loop'
//  Description: Fetches aggregated no-show analytics for a specific event.
//  Used by the Organizer ROI Dashboard to display why attendees bailed.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export type NoShowReason =
    | 'forgot'
    | 'too_much_homework'
    | 'transportation'
    | 'felt_sick'
    | 'schedule_conflict'
    | 'lost_interest'
    | 'other';

export interface NoShowAnalyticsData {
    reason: NoShowReason;
    count: number;
    percentage: number;
}

interface UseNoShowAnalyticsReturn {
    data: NoShowAnalyticsData[];
    totalNoShows: number;
    totalResponses: number;
    isLoading: boolean;
    error: string | null;
}

export function useNoShowAnalytics(eventId: string | null): UseNoShowAnalyticsReturn {
    const [data, setData] = useState<NoShowAnalyticsData[]>([]);
    const [totalNoShows, setTotalNoShows] = useState(0);
    const [totalResponses, setTotalResponses] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = useCallback(async () => {
        if (!eventId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch total no-shows (RSVP'd but not checked in)
            const { count: noShowCount, error: countError } = await supabase
                .from('event_rsvps')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('status', 'registered') // Assuming the cron job marks them as 'registered' still, or 'no_show'
                .eq('checked_in', false);

            if (countError) throw countError;
            setTotalNoShows(noShowCount || 0);

            // 2. Fetch aggregated reasons
            const { data: reasons, error: reasonsError } = await supabase
                .from('no_show_analytics')
                .select('reason')
                .eq('event_id', eventId);

            if (reasonsError) throw reasonsError;

            const totalResponsesCount = reasons?.length || 0;
            setTotalResponses(totalResponsesCount);

            // 3. Tally the reasons
            const tally: Record<string, number> = {};
            (reasons || []).forEach(r => {
                tally[r.reason] = (tally[r.reason] || 0) + 1;
            });

            // 4. Format for chart
            const formattedData: NoShowAnalyticsData[] = Object.entries(tally).map(([reason, count]) => ({
                reason: reason as NoShowReason,
                count,
                percentage: totalResponsesCount > 0 ? Math.round((count / totalResponsesCount) * 100) : 0
            }));

            // Sort by count descending
            formattedData.sort((a, b) => b.count - a.count);
            setData(formattedData);

        } catch (err: any) {
            console.error('[useNoShowAnalytics] Fetch failed:', err);
            setError(err.message || 'Failed to load analytics.');
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    return { data, totalNoShows, totalResponses, isLoading, error };
}
