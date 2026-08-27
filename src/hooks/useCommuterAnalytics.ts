// =============================================================================
// Hook: useCommuterAnalytics
// Issue: #3324 - Implement 'Automated Dorm vs Commuter Demographic Tagging'
//  Description: Fetches the demographic breakdown of a specific club to 
//  determine what percentage of the membership relies on commuting.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface UseCommuterAnalyticsReturn {
    commuterPercentage: number;
    isLoading: boolean;
    error: string | null;
}

export function useCommuterAnalytics(clubId: string | null): UseCommuterAnalyticsReturn {
    const [commuterPercentage, setCommuterPercentage] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPercentage = useCallback(async () => {
        if (!clubId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc('get_club_commuter_percentage', {
                p_club_id: clubId
            });

            if (rpcError) throw rpcError;
            setCommuterPercentage(data || 0);
        } catch (err: any) {
            console.error('[useCommuterAnalytics] Fetch failed:', err);
            setError(err.message || 'Failed to load commuter data.');
        } finally {
            setIsLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        fetchPercentage();
    }, [fetchPercentage]);

    return { commuterPercentage, isLoading, error };
}
