import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateSLAPenalty } from '@/lib/vendors/slaCalculator';
import { VendorCheckInPayload } from '@/types/vendors';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const milestoneId = params.id;
        const body: VendorCheckInPayload = await req.json();

        // 1. Fetch milestone details
        const { data: milestone, error: fetchError } = await supabase
            .from('vendor_milestones')
            .select('*')
            .eq('id', milestoneId)
            .eq('vendor_id', body.vendorId)
            .single();

        if (fetchError || !milestone) {
            return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
        }

        if (milestone.status === 'completed') {
            return NextResponse.json({ error: 'Milestone already completed' }, { status: 400 });
        }

        // 2. Verify QR code data (mocked validation)
        if (body.qrCodeData !== `VENUE_${milestone.club_id}`) {
            return NextResponse.json({ error: 'Invalid venue QR code' }, { status: 403 });
        }

        // 3. Calculate SLA penalty
        const now = new Date();
        const slaResult = calculateSLAPenalty(milestone, now);

        // 4. Update milestone with arrival time (trigger will calculate penalty)
        const { error: updateError } = await supabase
            .from('vendor_milestones')
            .update({
                actual_arrival_timestamp: now.toISOString(),
                status: 'completed',
            })
            .eq('id', milestoneId);

        if (updateError) {
            throw new Error(updateError.message);
        }

        // 5. Execute Stripe Connect transfer with slashed amount (mocked)
        // In production: await stripe.transfers.create({ amount: Math.round(slaResult.finalPayout * 100), ... })

        // 6. If penalty > 0, return slashed amount to Club's ledger
        if (slaResult.penaltyAmount > 0) {
            await supabase.from('ledger_transactions').insert({
                club_id: milestone.club_id,
                amount: slaResult.penaltyAmount,
                transaction_type: 'vendor_sla_refund',
                description: `SLA penalty refunded from vendor ${body.vendorId} for ${slaResult.delayMinutes} min delay.`,
                status: 'completed',
            });
        }

        return NextResponse.json({
            success: true,
            slaResult,
            message: slaResult.penaltyAmount > 0
                ? `Checked in late. $${slaResult.penaltyAmount.toFixed(2)} penalty applied and returned to club.`
                : 'Checked in on time. Full payout scheduled.',
        });
    } catch (error) {
        console.error('Vendor check-in error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
