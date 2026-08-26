// server/services/membershipService.ts

import Stripe from 'stripe';
import { Pool } from 'pg';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2025-02-28.acacia' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface MembershipTier {
    id: string;
    club_id: string;
    tier_name: string;
    price: number;
    benefits: string;
    stripe_price_id: string;
}

/**
 * Creates a Stripe Checkout Session for subscribing to a club membership tier.
 */
export async function createMembershipCheckoutSession(userId: string, tierId: string, successUrl: string, cancelUrl: string): Promise<string> {
    const client = await pool.connect();
    try {
        const tierResult = await client.query<MembershipTier>(
            `SELECT * FROM club_membership_tiers WHERE id = $1`,
            [tierId]
        );
        if (tierResult.rows.length === 0) {
            throw new Error('Membership tier not found.');
        }
        const tier = tierResult.rows[0];

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: tier.stripe_price_id,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&tier=${tier.tier_name}&club=${tier.club_id}`,
            cancel_url: cancelUrl,
            metadata: {
                userId,
                clubId: tier.club_id,
                tierName: tier.tier_name,
            },
        });

        return session.url || '';
    } finally {
        client.release();
    }
}

/**
 * Updates user_club_ledger upon successful subscription.
 */
export async function fulfillMembershipSubscription(userId: string, clubId: string, tierName: string): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO user_club_ledger (user_id, club_id, role, joined_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id, club_id) 
             DO UPDATE SET role = $3, updated_at = NOW()`,
            [userId, clubId, tierName]
        );
    } finally {
        client.release();
    }
}

/**
 * Checks RSVP eligibility and applies discount if user has Premium/VIP perk.
 */
export async function calculateEventDiscount(userId: string, clubId: string, eventId: string): Promise<number> {
    const client = await pool.connect();
    try {
        const ledgerRes = await client.query(
            `SELECT role FROM user_club_ledger WHERE user_id = $1 AND club_id = $2`,
            [userId, clubId]
        );
        
        if (ledgerRes.rows.length === 0) return 0;
        const role = ledgerRes.rows[0].role;

        if (role === 'Premium' || role === 'VIP') {
            const perkRes = await client.query(
                `SELECT premium_perk_active FROM events WHERE id = $1`,
                [eventId]
            );
            if (perkRes.rows[0]?.premium_perk_active) {
                return 1.0; // 100% discount on event food/entry fee
            }
        }
        return 0;
    } finally {
        client.release();
    }
}
