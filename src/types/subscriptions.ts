/**
 * Subscription and Billing Types for CampusConnect
 * Defines interfaces for club membership tiers and prorated upgrades.
 */

export type MembershipTier = 'basic' | 'premium' | 'enterprise';

export interface ClubSubscription {
    id: string;
    club_id: string;
    stripe_subscription_id: string;
    stripe_customer_id: string;
    current_tier: MembershipTier;
    current_price_id: string;
    billing_cycle_anchor: string;
    status: 'active' | 'canceled' | 'past_due';
}

export interface ProrationPreview {
    currentAmount: number;
    newAmount: number;
    proratedCredit: number;
    proratedCharge: number;
    netDueToday: number;
    nextBillingDate: string;
    invoiceId: string;
}

export interface UpgradeRequest {
    clubId: string;
    newPriceId: string;
    previewInvoiceId: string;
}
