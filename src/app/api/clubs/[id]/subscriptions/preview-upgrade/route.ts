import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { previewProratedUpgrade } from '@/lib/stripe/proration';

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
        const { newPriceId } = await req.json();

        if (!newPriceId) {
            return NextResponse.json(
                { error: 'Missing newPriceId parameter' },
                { status: 400 }
            );
        }

        // Fetch club's active subscription
        const { data: subscription, error: fetchError } = await supabase
            .from('club_subscriptions')
            .select('stripe_subscription_id, current_tier')
            .eq('club_id', clubId)
            .eq('status', 'active')
            .single();

        if (fetchError || !subscription) {
            return NextResponse.json(
                { error: 'No active subscription found for this club' },
                { status: 404 }
            );
        }

        // Preview the proration
        const preview = await previewProratedUpgrade(
            subscription.stripe_subscription_id,
            newPriceId
        );

        return NextResponse.json({ success: true, preview });
    } catch (error) {
        console.error('Preview upgrade API error:', error);
        return NextResponse.json(
            { error: 'Failed to preview upgrade' },
            { status: 500 }
        );
    }
}
