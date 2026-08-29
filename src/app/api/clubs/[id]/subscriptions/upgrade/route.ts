import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeProratedUpgrade } from '@/lib/stripe/proration';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const clubId = params.id;
        const { newPriceId, previewInvoiceId } = await req.json();

        if (!newPriceId || !previewInvoiceId) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Fetch club's active subscription
        const { data: subscription, error: fetchError } = await supabase
            .from('club_subscriptions')
            .select('stripe_subscription_id')
            .eq('club_id', clubId)
            .eq('status', 'active')
            .single();

        if (fetchError || !subscription) {
            return NextResponse.json(
                { error: 'No active subscription found' },
                { status: 404 }
            );
        }

        // Execute the upgrade
        await executeProratedUpgrade(
            subscription.stripe_subscription_id,
            newPriceId,
            previewInvoiceId
        );

        // Update local database
        const { error: updateError } = await supabase
            .from('club_subscriptions')
            .update({ current_tier: 'premium' }) // Simplified for this example
            .eq('club_id', clubId);

        if (updateError) {
            throw new Error(updateError.message);
        }

        return NextResponse.json({ success: true, message: 'Subscription upgraded successfully' });
    } catch (error) {
        console.error('Upgrade API error:', error);
        return NextResponse.json(
            { error: 'Failed to execute upgrade' },
            { status: 500 }
        );
    }
}
