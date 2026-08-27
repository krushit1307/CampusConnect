// =============================================================================
// Utility: Sponsorship Tier Types & Helpers
// Issue: #3170 - Build a 'Club Sponsorship Tier Management' UI
// Description: TypeScript types and formatting helpers for club sponsorship
// tiers (Bronze/Silver/Gold packages) shown in the Treasurer admin UI and the
// sponsor-facing pricing grid.
// =============================================================================

export interface SponsorshipTier {
    id: string;
    club_id: string;
    name: string;
    price: number; // In cents
    perks_json: string[];
    available_quantity: number | null; // null = unlimited
    sold_quantity: number;
    is_active: boolean;
    created_at: string;
}

export type NewSponsorshipTier = Pick<
    SponsorshipTier,
    'name' | 'price' | 'perks_json' | 'available_quantity' | 'is_active'
>;

/**
 * Formats an integer representing cents into a localized USD currency string.
 */
export function formatTierPrice(cents: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(cents / 100);
}

/**
 * Returns how many units of a tier remain, or null if the tier is unlimited.
 */
export function getRemainingQuantity(tier: SponsorshipTier): number | null {
    if (tier.available_quantity === null) return null;
    return Math.max(0, tier.available_quantity - tier.sold_quantity);
}

/**
 * Whether a limited-quantity tier has sold out.
 */
export function isTierSoldOut(tier: SponsorshipTier): boolean {
    if (tier.available_quantity === null) return false;
    return tier.sold_quantity >= tier.available_quantity;
}