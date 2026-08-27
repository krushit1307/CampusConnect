// =============================================================================
// Hook: useClubFinances
// Issue: #3277 - Implement 'Interactive Club Financial Transparency Dashboard'
// Description: Fetches the aggregated spending breakdown and reinvestment
// metrics for a specific club.Handles loading states and permission errors.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface SpendingCategory {
    category: string;
    total_spent: number;
    transaction_count: number;
}

interface UseClubFinancesReturn {
    breakdown: SpendingCategory[];
    totalReinvested: number;
    isLoading: boolean;
    error: string | null;
    isTransparent: boolean;
}

export function useClubFinances(clubId: string | null): UseClubFinancesReturn {
    const [breakdown, setBreakdown] = useState<SpendingCategory[]>([]);
    const [totalReinvested, setTotalReinvested] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isTransparent, setIsTransparent] = useState(false);

    const fetchFinances = useCallback(async () => {
        if (!clubId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch spending breakdown
            const { data: breakdownData, error: breakdownError } = await supabase.rpc('get_club_spending_breakdown', {
                p_club_id: clubId
            });

            if (breakdownError) {
                if (breakdownError.message.includes('transparency is disabled')) {
                    setIsTransparent(false);
                    setBreakdown([]);
                    setIsLoading(false);
                    return;
                }
                throw breakdownError;
            }

            setIsTransparent(true);
            setBreakdown((breakdownData as SpendingCategory[]) || []);

            // 2. Fetch reinvestment total
            const { data: reinvestmentData, error: reinvestmentError } = await supabase.rpc('get_event_reinvestment_total', {
                p_club_id: clubId
            });

            if (reinvestmentError) throw reinvestmentError;
            setTotalReinvested(reinvestmentData || 0);

        } catch (err: any) {
            console.error('[useClubFinances] Fetch failed:', err);
            setError(err.message || 'Failed to load financial data.');
        } finally {
            setIsLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        fetchFinances();
    }, [fetchFinances]);

    return {
        breakdown,
        totalReinvested,
        isLoading,
        error,
        isTransparent
    };
}
