// =============================================================================
// Hook: useAssetDepreciation
// Issue: #3685 - Implement 'Automated "Event Equipment" Depreciation Tracker'
// Description: Fetches the club's depreciable inventory via the Postgres RPC
// and exposes rollups for the Asset Health chart + end-of-life alerts.
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { isEndOfLife, replacementSuggestion, DepreciableAsset } from '../../lib/finance/depreciation';

export interface AssetDepreciationRow {
    item_id: string;
    item_name: string;
    purchase_price: number;
    book_value: number;
    remaining_value_pct: number;
    months_active: number;
    lifespan_months: number;
}

interface UseAssetDepreciationReturn {
    rows: AssetDepreciationRow[];
    alerts: { name: string; message: string }[];
    totalBookValue: number;
    totalOriginalValue: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useAssetDepreciation(clubId: string | null): UseAssetDepreciationReturn {
    const [rows, setRows] = useState<AssetDepreciationRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!clubId) { setIsLoading(false); return; }
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('get_club_asset_depreciation', {
                p_club_id: clubId,
            });
            if (rpcError) throw rpcError;
            setRows((data as AssetDepreciationRow[]) || []);
        } catch (err: any) {
            console.error('[useAssetDepreciation] Fetch failed:', err);
            setError(err.message || 'Failed to load depreciation data.');
        } finally {
            setIsLoading(false);
        }
    }, [clubId]);

    useEffect(() => { refresh(); }, [refresh]);

    // End-of-life alerts (< 20% remaining value)
    const alerts = useMemo(() =>
        rows
            .filter(r => r.remaining_value_pct < 20 && r.purchase_price > 0)
            .map(r => ({
                name: r.item_name,
                message: `Your ${r.item_name} is nearing end-of-life. We suggest allocating $${Number(r.purchase_price).toLocaleString()} in your next annual budget request for a replacement.`,
            })),
        [rows]);

    const totalBookValue = useMemo(() => rows.reduce((s, r) => s + Number(r.book_value || 0), 0), [rows]);
    const totalOriginalValue = useMemo(() => rows.reduce((s, r) => s + Number(r.purchase_price || 0), 0), [rows]);

    return { rows, alerts, totalBookValue, totalOriginalValue, isLoading, error, refresh };
}
