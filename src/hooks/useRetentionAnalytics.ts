// =============================================================================
// Hook: useRetentionAnalytics
// Issue: #3285 - Implement 'Event Attendance Analytics'(Retention Rate)
// Description: Fetches the cohort retention matrix and demographic churn data
// for a specific club.Allows the organizer to select a "Base Event" and see
// how many attendees returned for subsequent events.
    // =============================================================================

    import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface RetentionDataPoint {
    subsequent_event_id: string;
    subsequent_event_title: string;
    subsequent_event_date: string;
    base_attendee_count: number;
    returning_attendee_count: number;
    retention_rate: number;
}

export interface ChurnDemographic {
    major: string;
    graduation_year: number;
    churned_count: number;
}

export interface PastEvent {
    id: string;
    title: string;
    event_date: string;
    attendee_count: number;
}

interface UseRetentionAnalyticsReturn {
    pastEvents: PastEvent[];
    selectedBaseEvent: PastEvent | null;
    setSelectedBaseEvent: (event: PastEvent | null) => void;
    retentionMatrix: RetentionDataPoint[];
    churnData: ChurnDemographic[];
    isLoading: boolean;
    error: string | null;
    triggerReengagementEmail: (subsequentEventId: string) => Promise<boolean>;
}

export function useRetentionAnalytics(clubId: string | null): UseRetentionAnalyticsReturn {
    const [pastEvents, setPastEvents] = useState<PastEvent[]>([]);
    const [selectedBaseEvent, setSelectedBaseEvent] = useState<PastEvent | null>(null);
    const [retentionMatrix, setRetentionMatrix] = useState<RetentionDataPoint[]>([]);
    const [churnData, setChurnData] = useState<ChurnDemographic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch past events for the dropdown selector
    const fetchPastEvents = useCallback(async () => {
        if (!clubId) return;

        try {
            const { data, error: fetchError } = await supabase
                .from('events')
                .select('id, title, event_date')
                .eq('club_id', clubId)
                .eq('status', 'COMPLETED')
                .lt('event_date', new Date().toISOString())
                .order('event_date', { ascending: false })
                .limit(20);

            if (fetchError) throw fetchError;

            // In a real app, we'd fetch attendee counts here too. Mocking for now.
            const eventsWithCounts: PastEvent[] = (data || []).map(e => ({
                ...e,
                attendee_count: Math.floor(Math.random() * 100) + 20 // Mock data
            }));

            setPastEvents(eventsWithCounts);
            if (eventsWithCounts.length > 0 && !selectedBaseEvent) {
                setSelectedBaseEvent(eventsWithCounts[0]);
            }
        } catch (err: any) {
            console.error('[useRetentionAnalytics] Fetch events failed:', err);
        }
    }, [clubId, selectedBaseEvent]);

    // Fetch retention matrix when base event changes
    const fetchRetention = useCallback(async () => {
        if (!clubId || !selectedBaseEvent) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc('calculate_cohort_retention', {
                p_club_id: clubId,
                p_base_event_id: selectedBaseEvent.id
            });

            if (rpcError) throw rpcError;
            setRetentionMatrix((data as RetentionDataPoint[]) || []);

            // If there are subsequent events, fetch churn data for the immediate next one
            if (data && data.length > 0) {
                const nextEvent = data[0] as RetentionDataPoint;
                const { data: churn, error: churnError } = await supabase.rpc('analyze_demographic_churn', {
                    p_base_event_id: selectedBaseEvent.id,
                    p_subsequent_event_id: nextEvent.subsequent_event_id
                });

                if (churnError) throw churnError;
                setChurnData((churn as ChurnDemographic[]) || []);
            } else {
                setChurnData([]);
            }

        } catch (err: any) {
            console.error('[useRetentionAnalytics] Fetch retention failed:', err);
            setError(err.message || 'Failed to calculate retention.');
        } finally {
            setIsLoading(false);
        }
    }, [clubId, selectedBaseEvent]);

    useEffect(() => {
        fetchPastEvents();
    }, [fetchPastEvents]);

    useEffect(() => {
        fetchRetention();
    }, [fetchRetention]);

    const triggerReengagementEmail = async (subsequentEventId: string): Promise<boolean> => {
        try {
            const { error: fnError } = await supabase.functions.invoke('send-churn-reengagement', {
                body: {
                    base_event_id: selectedBaseEvent?.id,
                    subsequent_event_id: subsequentEventId
                }
            });
            if (fnError) throw fnError;
            return true;
        } catch (err: any) {
            console.error('[useRetentionAnalytics] Email trigger failed:', err);
            return false;
        }
    };

    return {
        pastEvents,
        selectedBaseEvent,
        setSelectedBaseEvent,
        retentionMatrix,
        churnData,
        isLoading,
        error,
        triggerReengagementEmail
    };
}
