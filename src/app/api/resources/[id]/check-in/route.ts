import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateCheckoutDuration, updateResourceFlightMetrics } from '@/lib/hardware/batteryTracker';
import { CheckInPayload } from '@/types/hardware';

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
        const body: CheckInPayload = await req.json();

        // 1. Fetch the active booking to get original start time
        const { data: booking, error: bookingError } = await supabase
            .from('resource_bookings')
            .select('start_time, status')
            .eq('id', body.bookingId)
            .eq('resource_id', resourceId)
            .single();

        if (bookingError || !booking) {
            return NextResponse.json({ error: 'Active booking not found' }, { status: 404 });
        }

        if (booking.status !== 'active') {
            return NextResponse.json({ error: 'Booking is not currently active' }, { status: 400 });
        }

        // 2. Calculate checkout duration
        const durationMinutes = calculateCheckoutDuration(booking.start_time, body.actualReturnTime);

        // 3. Update booking record with return details
        const { error: updateBookingError } = await supabase
            .from('resource_bookings')
            .update({
                status: 'completed',
                actual_return_time: body.actualReturnTime,
                checkout_duration_minutes: durationMinutes,
            })
            .eq('id', body.bookingId);

        if (updateBookingError) {
            throw new Error(updateBookingError.message);
        }

        // 4. Update resource flight metrics and check for degradation
        const { resource, alert } = await updateResourceFlightMetrics(resourceId, durationMinutes);

        return NextResponse.json({
            success: true,
            message: 'Resource checked in successfully.',
            checkoutDurationMinutes: durationMinutes,
            resource: {
                id: resource.id,
                name: resource.name,
                totalFlightMinutes: resource.total_flight_minutes,
                batteryHealthPercentage: resource.battery_health_percentage,
                maintenanceRequired: resource.maintenance_required,
            },
            maintenanceAlert: alert,
        });
    } catch (error) {
        console.error('Resource check-in error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}


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
