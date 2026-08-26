import { useState, useCallback, useMemo } from 'react';
import {
    InventoryItem,
    AssetClass,
    InventoryItemWithValuation,
    BalanceSheetCategory,
    ClubBalanceSheet
} from '../types/finance';

// Supabase mock for the sake of the hook
const createMockBalanceSheet = (): ClubBalanceSheet => ({
    categories: [
        { category: 'Electronics & Computing', historical_cost_total: 5848.00, accumulated_depreciation: 2154.50, net_book_value: 3693.50 },
        { category: 'Club Furniture & Fixtures', historical_cost_total: 5400.00, accumulated_depreciation: 1542.85, net_book_value: 3857.15 }
    ],
    grand_total: { category: 'GRAND_TOTAL', historical_cost_total: 11248.00, accumulated_depreciation: 3697.35, net_book_value: 7550.65 },
    as_of_date: new Date().toISOString(),
    generated_at: new Date().toISOString()
});

const createMockInventory = (): InventoryItemWithValuation[] => [
    {
        id: '1', club_id: 'club-1', name: 'MacBook Pro M2 - Officer 1',
        purchase_date: new Date(Date.now() - 3.154e10).toISOString(), // 1 yr ago
        purchase_price: 2499.00, asset_class: 'ELECTRONICS', condition_status: 'GOOD',
        net_book_value: 1707.65, percent_lifespan_used: 33.33,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: '2', club_id: 'club-1', name: 'Executive Board Table',
        purchase_date: new Date(Date.now() - 1.262e11).toISOString(), // 4 yrs ago
        purchase_price: 1200.00, asset_class: 'FURNITURE', condition_status: 'FAIR',
        net_book_value: 582.86, percent_lifespan_used: 57.14,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: '3', club_id: 'club-1', name: 'Canon EOS DSLR Camera',
        purchase_date: new Date(Date.now() - 3.154e9).toISOString(),
        purchase_price: 1000.00, asset_class: 'ELECTRONICS', condition_status: 'GOOD',
        net_book_value: 890.00, percent_lifespan_used: 11,
        due_date: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days overdue
        checked_out_to: 'a Photography Club member', is_overdue: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }
];
export const useDepreciation = (clubId: string) => {
    const [balanceSheet, setBalanceSheet] = useState<ClubBalanceSheet | null>(null);
    const [inventory, setInventory] = useState<InventoryItemWithValuation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBalanceSheet = useCallback(async (asOfDate?: string) => {
        setLoading(true);
        setError(null);
        try {
            // Simulate network call to `generate_club_balance_sheet` RPC
            await new Promise(r => setTimeout(r, 600));
            setBalanceSheet(createMockBalanceSheet());
        } catch (err: any) {
            setError(err.message || 'Failed to fetch balance sheet');
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    const fetchValuedInventory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Simulate network call to `get_inventory_with_valuation` RPC
            await new Promise(r => setTimeout(r, 800));
            setInventory(createMockInventory());
        } catch (err: any) {
            setError(err.message || 'Failed to fetch valued inventory');
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    /**
     * Client-side forecast generator using straight-line formula
     * useful for drawing charts without spamming the RPC backend.
     */
    const generateForecast = useCallback((item: InventoryItem, assetClass: AssetClass) => {
        if (!item.purchase_date || !item.purchase_price) return [];

        const purchaseDate = new Date(item.purchase_date);
        const salvageValue = item.purchase_price * (assetClass.salvage_value_percent / 100);
        const depreciableBase = item.purchase_price - salvageValue;
        const annualDepreciation = depreciableBase / assetClass.lifespan_years;

        const forecast = [];
        let currentValue = item.purchase_price;

        for (let i = 0; i <= assetClass.lifespan_years; i++) {
            const yearDate = new Date(purchaseDate);
            yearDate.setFullYear(purchaseDate.getFullYear() + i);

            forecast.push({
                year: i,
                date: yearDate.toISOString().split('T')[0],
                value: i === assetClass.lifespan_years ? salvageValue : Number(currentValue.toFixed(2)),
                depreciation_expense: i === 0 ? 0 : Number(annualDepreciation.toFixed(2))
            });

            if (i > 0) {
                currentValue -= annualDepreciation;
            }
        }

        return forecast;
    }, []);

    const kpis = useMemo(() => {
        if (!balanceSheet) return null;
        const total = balanceSheet.grand_total;

        const percentRetained = total.historical_cost_total > 0
            ? (total.net_book_value / total.historical_cost_total) * 100
            : 0;

        // Calculate health score (0-100) based on how depreciated the portfolio is
        // 100 = brand new, <30 implies heavy capitalization is needed soon
        const healthScore = Math.min(100, Math.max(0, percentRetained));

        return {
            totalAssetValue: total.net_book_value,
            totalHistoricalCost: total.historical_cost_total,
            totalDepreciation: total.accumulated_depreciation,
            percentRetained,
            healthScore,
            status: healthScore > 65 ? 'EXCELLENT' : healthScore > 40 ? 'FAIR' : 'NEEDS_RENEWAL'
        };
    }, [balanceSheet]);

    return {
        balanceSheet,
        inventory,
        loading,
        error,
        fetchBalanceSheet,
        fetchValuedInventory,
        generateForecast,
        kpis
    };
};
