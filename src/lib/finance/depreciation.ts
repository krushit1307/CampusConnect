// =============================================================================
// Utility: Straight-Line Depreciation (client mirror)
// Issue: #3685 - Implement 'Automated "Event Equipment" Depreciation Tracker'
// Description: Pure TS mirror of the Postgres RPC so charts can render
// instantly from cached inventory rows without an extra round-trip.
// =============================================================================

export interface DepreciationResult {
    monthsActive: number;
    monthlyDepreciation: number;
    accumulatedDepreciation: number;
    bookValue: number;
    remainingValuePct: number;
}

export interface DepreciableAsset {
    id: string;
    name: string;
    purchase_price: number | null;
    purchase_date: string | null;
    estimated_lifespan_months: number | null;
}

/** Straight-line depreciation: (price / lifespan) * months_active. */
export function straightLineDepreciation(asset: DepreciableAsset, now = new Date()): DepreciationResult {
    const price = asset.purchase_price ?? 0;
    const lifespan = asset.estimated_lifespan_months ?? 0;
    const purchased = asset.purchase_date ? new Date(asset.purchase_date) : null;

    if (price <= 0 || lifespan <= 0 || !purchased) {
        return { monthsActive: 0, monthlyDepreciation: 0, accumulatedDepreciation: 0, bookValue: price, remainingValuePct: 100 };
    }

    const monthsActive = Math.max(0,
        (now.getFullYear() - purchased.getFullYear()) * 12 + (now.getMonth() - purchased.getMonth()));

    const monthly = price / lifespan;
    const accumulated = Math.min(price, monthly * monthsActive);
    const bookValue = Math.max(0, price - accumulated);
    const remainingValuePct = Math.round((bookValue / price) * 1000) / 10;

    return {
        monthsActive,
        monthlyDepreciation: Math.round(monthly * 100) / 100,
        accumulatedDepreciation: Math.round(accumulated * 100) / 100,
        bookValue: Math.round(bookValue * 100) / 100,
        remainingValuePct,
    };
}

/** Assets below this % of original value trigger a replacement alert. */
export const END_OF_LIFE_THRESHOLD_PCT = 20;

export function isEndOfLife(asset: DepreciableAsset): boolean {
    return straightLineDepreciation(asset).remainingValuePct < END_OF_LIFE_THRESHOLD_PCT;
}

/** Human-readable replacement suggestion used by the alert banner. */
export function replacementSuggestion(asset: DepreciableAsset): string {
    const price = asset.purchase_price ?? 0;
    return `Your ${asset.name} is nearing end-of-life. We suggest allocating $${price.toLocaleString()} in your next annual budget request for a replacement.`;
}
