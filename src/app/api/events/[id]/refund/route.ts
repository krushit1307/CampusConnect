import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processPartialRefund, calculateRefundAmount } from '@/lib/stripe/refunds';
import { PartialRefundRequest } from '@/types/refunds';
import { authorizeResourceAction } from '@/lib/auth/authorizeResourceAction';
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
const eventId = params.id;

const authorization = await authorizeResourceAction(
    "event",
    eventId,
    "refund_event",
);

if (!authorization.authorized) {
    return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
    );
}

const body: PartialRefundRequest = await req.json();
        if (!body.refundType || !body.value || !body.reason) {
            return NextResponse.json(
                { error: 'Missing required refund parameters' },
                { status: 400 }
            );
        }

        // Fetch all successful payment intents for this event
        const { data: payments, error: fetchError } = await supabase
            .from('event_payments')
            .select('id, payment_intent_id, amount_paid, user_id, profiles(email, full_name)')
            .eq('event_id', eventId)
            .eq('status', 'succeeded');

        if (fetchError) {
            throw new Error(fetchError.message);
        }

        const results = {
            totalProcessed: 0,
            totalFailed: 0,
            totalRefundedAmount: 0,
            failedPaymentIntentIds: [] as string[],
        };

        for (const payment of payments || []) {
            // Check idempotency: has this payment already been refunded?
            const { data: existingRefund } = await supabase
                .from('event_refunds')
                .select('id')
                .eq('payment_intent_id', payment.payment_intent_id)
                .single();

            if (existingRefund) {
                console.log(`Skipping already refunded payment: ${payment.payment_intent_id}`);
                continue;
            }

            const refundAmount = calculateRefundAmount(payment.amount_paid, body.refundType, body.value);

            try {
                // Execute Stripe Refund API call
                const stripeRefund = await processPartialRefund(
                    payment.payment_intent_id,
                    refundAmount,
                    body.reason
                );

                if (stripeRefund.status === 'succeeded') {
                    // Record in database
                    await supabase.from('event_refunds').insert({
                        event_id: eventId,
                        payment_intent_id: payment.payment_intent_id,
                        original_amount: payment.amount_paid,
                        refunded_amount: refundAmount,
                        status: 'succeeded',
                    });

                    results.totalProcessed++;
                    results.totalRefundedAmount += refundAmount;

                    // Dispatch automated email (Mocked for this implementation)
                    console.log(`[EMAIL DISPATCH] To: ${payment.profiles?.email}, Subject: Partial Refund Processed`);
                } else {
                    throw new Error(`Stripe refund status: ${stripeRefund.status}`);
                }
            } catch (error) {
                console.error(`Refund failed for ${payment.payment_intent_id}:`, error);

                await supabase.from('event_refunds').insert({
                    event_id: eventId,
                    payment_intent_id: payment.payment_intent_id,
                    original_amount: payment.amount_paid,
                    refunded_amount: 0,
                    status: 'failed',
                    failure_reason: error instanceof Error ? error.message : 'Unknown error',
                });

                results.totalFailed++;
                results.failedPaymentIntentIds.push(payment.payment_intent_id);
            }
        }

        return NextResponse.json({
            success: results.totalFailed === 0,
            message: `Processed ${results.totalProcessed} refunds. ${results.totalFailed} failed.`,
            ...results,
        });

    } catch (error) {
        console.error('Mass refund error:', error);
        return NextResponse.json(
            { error: 'Failed to process mass refunds' },
            { status: 500 }
        );
    }
}
