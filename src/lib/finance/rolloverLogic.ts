// =============================================================================
// Utility: Rollover Logic Helpers
// Issue: #4036 - Implement 'Automated Club Budget Roll-over' Logic
// Description: Client-side utilities to format and preview fiscal rollover 
// calculations before the admin manually triggers or reviews the cron job.
// =============================================================================

export interface RolloverPreview {
    clubName: string;
    currentBalance: number;
    initialAllocation: number;
    maxRolloverPct: number;
    allowedRollover: number;
    reclaimedAmount: number;
}

/**
 * Calculates the expected rollover metrics for a given club ledger.
 * Matches the Postgres RPC logic exactly for preview consistency.
 */
export function calculateRolloverPreview(
    currentBalance: number,
    initialAllocation: number,
    maxRolloverPct: number = 20
): RolloverPreview {
    const allowedRollover = Number((initialAllocation * (maxRolloverPct / 100)).toFixed(2));
    const reclaimedAmount = currentBalance > allowedRollover
        ? Number((currentBalance - allowedRollover).toFixed(2))
        : 0;

    return {
        clubName: "Preview Club", // Placeholder, replaced by actual data
        currentBalance,
        initialAllocation,
        maxRolloverPct,
        allowedRollover,
        reclaimedAmount
    };
}

/**
 * Formats a currency value for display in the admin dashboard.
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}
