import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { releaseDepositHold, convertHoldToDeduction } from '@/lib/ledger/depositHolds';
import { CheckInRequest } from '@/types/resources';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const resourceId = params.id;
        const body: CheckInRequest = await req.json();

        // Verify admin permissions (simplified for this implementation)
        // In production, verify admin role via JWT or RLS

        // Fetch the active booking and associated hold
        const { data: booking, error: bookingError } = await supabase
            .from('resource_bookings')
            .select('id, club_id, resource_deposit_holds(id, hold_amount, status)')
            .eq('id', body.bookingId)
            .eq('resource_id', resourceId)
            .eq('status', 'active')
            .single();

        if (bookingError || !booking) {
            return NextResponse.json({ error: 'Active booking not found' }, { status: 404 });
        }

        const hold = booking.resource_deposit_holds?.[0];

        // Update booking status to completed
        await supabase
            .from('resource_bookings')
            .update({ status: 'completed' })
            .eq('id', body.bookingId);

        // Process deposit based on condition
        if (hold && hold.status === 'active') {
            if (body.condition === 'undamaged') {
                await releaseDepositHold(hold.id, body.notes || 'Resource returned undamaged');
            } else if (body.condition === 'damaged') {
                await convertHoldToDeduction(hold.id, body.notes || 'Resource returned damaged');
            }
        }

        return NextResponse.json({
            success: true,
            message: body.condition === 'undamaged'
                ? 'Resource checked in successfully. Deposit hold released.'
                : 'Resource checked in as damaged. Deposit has been deducted.',
        });
    } catch (error) {
        console.error('Resource check-in error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
