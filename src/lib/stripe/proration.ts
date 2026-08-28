import Stripe from 'stripe';
import { ProrationPreview } from '@/types/subscriptions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
});

/**
 * Previews a subscription upgrade to calculate exact prorated charges.
 * 
 * @param subscriptionId - The active Stripe subscription ID
 * @param newPriceId - The Stripe Price ID for the new tier
 * @returns Promise<ProrationPreview>
 */
export async function previewProratedUpgrade(
    subscriptionId: string,
    newPriceId: string
): Promise<ProrationPreview> {
    try {
        // Fetch current subscription to get current price and billing cycle
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentItem = subscription.items.data[0];

        // Preview the update with proration behavior
        const invoice = await stripe.invoices.retrieveUpcoming({
            customer: subscription.customer as string,
            subscription: subscriptionId,
            subscription_items: [
                {
                    id: currentItem.id,
                    price: newPriceId,
                },
            ],
            subscription_proration_behavior: 'always_invoice',
        });

        // Calculate prorated amounts (Stripe returns amounts in cents)
        const currentAmount = currentItem.price?.unit_amount || 0;
        const newAmount = invoice.lines.data.find(line => line.period.current === invoice.period.end)?.amount || 0;

        // Proration credit is the unused portion of the current period
        const proratedCredit = invoice.lines.data
            .filter(line => line.proration)
            .reduce((sum, line) => sum + (line.amount < 0 ? Math.abs(line.amount) : 0), 0);

        // Prorated charge is the cost of the new tier for the remainder of the period
        const proratedCharge = invoice.lines.data
            .filter(line => line.proration)
            .reduce((sum, line) => sum + (line.amount > 0 ? line.amount : 0), 0);

        const netDueToday = proratedCharge - proratedCredit;

        return {
            currentAmount: currentAmount / 100,
            newAmount: newAmount / 100,
            proratedCredit: proratedCredit / 100,
            proratedCharge: proratedCharge / 100,
            netDueToday: netDueToday / 100,
            nextBillingDate: new Date(invoice.period.end * 1000).toLocaleDateString(),
            invoiceId: invoice.id,
        };
    } catch (error) {
        console.error('Stripe proration preview failed:', error);
        throw new Error('Failed to calculate proration');
    }
}

/**
 * Executes the subscription upgrade using the previewed invoice.
 * 
 * @param subscriptionId - The active Stripe subscription ID
 * @param newPriceId - The Stripe Price ID for the new tier
 * @param invoiceId - The ID of the previewed invoice to confirm
 * @returns Promise<Stripe.Subscription>
 */
export async function executeProratedUpgrade(
    subscriptionId: string,
    newPriceId: string,
    invoiceId: string
): Promise<Stripe.Subscription> {
    try {
        // Update the subscription with the new price
        const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
            items: [
                {
                    id: (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].id,
                    price: newPriceId,
                },
            ],
            proration_behavior: 'always_invoice',
        });

        // Pay the upcoming invoice immediately
        await stripe.invoices.pay(invoiceId);

        return updatedSubscription;
    } catch (error) {
        console.error('Stripe upgrade execution failed:', error);
        throw new Error('Failed to execute subscription upgrade');
    }
}
