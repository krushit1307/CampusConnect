// =============================================================================
// Utility: Discount Calculator & Pricing Engine
// Issue: #2902 - Implement 'Group Discounts' for Event Ticketing
// Description: Pure utility functions to calculate dynamic pricing based on
// ticket quantity and configured discount rules.Handles edge cases like
// remaining capacity and "Add X more to unlock discount" prompts.
// =============================================================================

export interface DiscountRule {
    min_qty: number;
    discount_pct: number;
}

export interface PricingBreakdown {
    basePrice: number;
    quantity: number;
    subtotal: number;
    discountPercentage: number;
    discountAmount: number;
    total: number;
    nextTier: {
        qtyNeeded: number;
        discountPct: number;
    } | null;
}

/**
 * Calculates the full pricing breakdown for a given ticket tier and quantity.
 * 
 * @param basePrice - The flat rate price per ticket (in cents to avoid floating point issues)
 * @param quantity - The number of tickets the user is attempting to purchase
 * @param rules - The array of discount rules configured for this tier
 * @param remainingCapacity - Optional: The max tickets left to prevent over-ordering
 * @returns PricingBreakdown object with all calculated values
 */
export function calculateTicketPricing(
    basePrice: number,
    quantity: number,
    rules: DiscountRule[],
    remainingCapacity?: number
): PricingBreakdown {
    if (quantity <= 0) {
        return {
            basePrice,
            quantity: 0,
            subtotal: 0,
            discountPercentage: 0,
            discountAmount: 0,
            total: 0,
            nextTier: getNextTier(0, rules, remainingCapacity)
        };
    }

    // Sort rules by min_qty descending to find the highest applicable discount
    const sortedRules = [...rules].sort((a, b) => b.min_qty - a.min_qty);

    let applicableDiscount: DiscountRule | null = null;
    for (const rule of sortedRules) {
        if (quantity >= rule.min_qty) {
            applicableDiscount = rule;
            break;
        }
    }

    const discountPercentage = applicableDiscount ? applicableDiscount.discount_pct : 0;
    const subtotal = basePrice * quantity;
    const discountAmount = Math.round(subtotal * (discountPercentage / 100));
    const total = subtotal - discountAmount;

    return {
        basePrice,
        quantity,
        subtotal,
        discountPercentage,
        discountAmount,
        total,
        nextTier: getNextTier(quantity, sortedRules, remainingCapacity)
    };
}

/**
 * Determines the next discount tier to encourage users to buy more tickets.
 * Returns null if the user is already at the highest tier or if capacity prevents it.
 */
function getNextTier(
    currentQty: number,
    sortedRules: DiscountRule[],
    remainingCapacity?: number
): PricingBreakdown['nextTier'] {

    // We need to look at rules in ASCENDING order to find the *next* threshold
    const ascendingRules = [...sortedRules].sort((a, b) => a.min_qty - b.min_qty);

    for (const rule of ascendingRules) {
        if (rule.min_qty > currentQty) {
            // Check if the user can actually reach this tier given the remaining capacity
            if (remainingCapacity !== undefined && rule.min_qty > remainingCapacity) {
                return null; // Cannot reach this tier, don't tease the user
            }

            return {
                qtyNeeded: rule.min_qty - currentQty,
                discountPct: rule.discount_pct
            };
        }
    }

    return null; // Already at max tier
}

/**
 * Formats a price in cents to a localized currency string.
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(cents / 100);
}

/**
 * Validates that a set of discount rules is logically sound.
 * Used on the frontend before submitting the organizer's configuration form.
 */
export function validateDiscountRules(rules: DiscountRule[]): string | null {
    if (!Array.isArray(rules)) return 'Rules must be an array.';

    // Check for duplicate min_qty
    const qtys = rules.map(r => r.min_qty);
    if (new Set(qtys).size !== qtys.length) {
        return 'Duplicate quantity thresholds are not allowed.';
    }

    for (const rule of rules) {
        if (rule.min_qty < 2) {
            return 'Minimum quantity for a group discount must be at least 2.';
        }
        if (rule.discount_pct <= 0 || rule.discount_pct > 100) {
            return 'Discount percentage must be between 1 and 100.';
        }
    }

    return null; // Valid
}
