// =============================================================================
// Hook: useRiskAssessment
// Issue: #3336 - Implement 'Automated Event Risk Assessment' Scoring
// Description: Fetches the queue of events pending risk review for Safety Admins.
// Provides functions to manually approve or reject quarantined events.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface QuarantinedEvent {
    id: string;
    title: string;
    risk_score: number;
    risk_factors: string[];
    created_at: string;
    clubs?: { name: string };
}

interface UseRiskAssessmentReturn {
    queue: QuarantinedEvent[];
    isLoading: boolean;
    error: string | null;
    approveEvent: (eventId: string) => Promise<boolean>;
    rejectEvent: (eventId: string) => Promise<boolean>;
}

export function useRiskAssessment(): UseRiskAssessmentReturn {
    const [queue, setQueue] = useState<QuarantinedEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQueue = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('events')
                .select(`
          id,
          title,
          risk_score,
          risk_factors,
          created_at,
          clubs (name)
        `)
                .eq('status', 'pending_risk_review')
                .order('risk_score', { ascending: false });

            if (fetchError) throw fetchError;
            setQueue((data as QuarantinedEvent[]) || []);
        } catch (err: any) {
            console.error('[useRiskAssessment] Fetch failed:', err);
            setError(err.message || 'Failed to load risk queue.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const approveEvent = async (eventId: string): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('events')
                .update({ status: 'approved' })
                .eq('id', eventId);

            if (updateError) throw updateError;
            setQueue(prev => prev.filter(e => e.id !== eventId));
            return true;
        } catch (err: any) {
            console.error('[useRiskAssessment] Approve failed:', err);
            return false;
        }
    };

    const rejectEvent = async (eventId: string): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('events')
                .update({ status: 'rejected' })
                .eq('id', eventId);

            if (updateError) throw updateError;
            setQueue(prev => prev.filter(e => e.id !== eventId));
            return true;
        } catch (err: any) {
            console.error('[useRiskAssessment] Reject failed:', err);
            return false;
        }
    };

    return { queue, isLoading, error, approveEvent, rejectEvent };
}
