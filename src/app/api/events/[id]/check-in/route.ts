import { NextRequest, NextResponse } from 'next/server';
import { getEventCapacity, triggerEmergencyHalt, processCapacityDenialRefund } from '@/lib/bouncer/capacityControl';
import { CheckInRequest, CheckInResponse } from '@/types/bouncer';
import { createClient } from '@supabase/supabase-js';

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
        const body: CheckInRequest = await req.json();

        // 1. Check current capacity and halt status
        const capacity = await getEventCapacity(eventId);

        if (capacity.emergency_halt_active) {
            // Trigger refund for this user
            await processCapacityDenialRefund(body.ticketId, body.userId, eventId);

            return NextResponse.json({
                success: false,
                status: 'denied_halt',
                message: 'VENUE FULL. Access Denied by Fire Marshal. An automated refund has been issued to your account.',
                refundTriggered: true,
            } as CheckInResponse, { status: 403 });
        }

        // 2. Verify ticket validity
        const { data: registration, error: regError } = await supabase
            .from('event_registrations')
            .select('status, user_id')
            .eq('id', body.ticketId)
            .eq('event_id', eventId)
            .single();

        if (regError || !registration) {
            return NextResponse.json({
                success: false,
                status: 'denied_invalid',
                message: 'Invalid or unrecognised ticket.',
            } as CheckInResponse, { status: 400 });
        }

        if (registration.status !== 'confirmed') {
            return NextResponse.json({
                success: false,
                status: 'denied_invalid',
                message: `Ticket status is ${registration.status}. Entry denied.`,
            } as CheckInResponse, { status: 400 });
        }

        // 3. Check if adding this person exceeds physical capacity
        if (capacity.checked_in_count >= capacity.venue_physical_capacity) {
            // Auto-trigger emergency halt
            await triggerEmergencyHalt(eventId, body.bouncerId, 'Automatic trigger: Checked in count reached physical capacity limit.');

            // Process refund for this denied user
            await processCapacityDenialRefund(body.ticketId, body.userId, eventId);

            return NextResponse.json({
                success: false,
                status: 'denied_capacity',
                message: 'VENUE FULL. Access Denied by Fire Marshal. An automated refund has been issued to your account.',
                refundTriggered: true,
                checkedInCount: capacity.checked_in_count,
                capacity: capacity.venue_physical_capacity,
            } as CheckInResponse, { status: 403 });
        }

        // 4. Successful check-in
        const { error: updateError } = await supabase
            .from('event_registrations')
            .update({ checked_in_at: new Date().toISOString() })
            .eq('id', body.ticketId);

        if (updateError) {
            throw new Error(updateError.message);
        }

        return NextResponse.json({
            success: true,
            status: 'success',
            message: 'Check-in successful. Enjoy the event!',
            checkedInCount: capacity.checked_in_count + 1,
            capacity: capacity.venue_physical_capacity,
        } as CheckInResponse);

    } catch (error) {
        console.error('Check-in error:', error);
        return NextResponse.json(
            { error: 'Internal server error during check-in' },
            { status: 500 }
        );
    }
}
