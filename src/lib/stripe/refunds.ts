import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
});

/**
 * Processes a partial refund for a specific Stripe Payment Intent.
 * 
 * @param paymentIntentId - The Stripe Payment Intent ID to refund
 * @param amountInCents - The amount to refund in cents
 * @param reason - The reason for the refund (for audit logs)
 * @returns Promise<Stripe.Refund>
 */
export async function processPartialRefund(
    paymentIntentId: string,
    amountInCents: number,
    reason: string
): Promise<Stripe.Refund> {
    try {
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: amountInCents,
            reason: 'requested_by_customer', // Stripe's closest generic reason
            metadata: {
                campusconnect_reason: reason,
                refund_type: 'partial_prorated',
            },
        });

        return refund;
    } catch (error) {
        console.error(`Stripe refund failed for PI ${paymentIntentId}:`, error);
        throw error;
    }
}

/**
 * Calculates the refund amount based on type and original amount.
 * 
 * @param originalAmount - Original amount paid in cents
 * @param refundType - 'percentage' or 'flat_amount'
 * @param value - Percentage (0-100) or flat amount in cents
 * @returns number - Calculated refund amount in cents
 */
export function calculateRefundAmount(
    originalAmount: number,
    refundType: 'percentage' | 'flat_amount',
    value: number
): number {
    if (refundType === 'percentage') {
        return Math.round(originalAmount * (value / 100));
    }
    // For flat amount, ensure we don't refund more than the original amount
    return Math.min(value, originalAmount);
}
