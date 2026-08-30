import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createDepositHold } from '@/lib/ledger/depositHolds';
import { BookingRequest } from '@/types/resources';

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
        const body: BookingRequest = await req.json();

        // Fetch resource details including deposit requirement
        const { data: resource, error: resourceError } = await supabase
            .from('resources')
            .select('id, name, deposit_required, available')
            .eq('id', resourceId)
            .single();

        if (resourceError || !resource) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        if (!resource.available) {
            return NextResponse.json({ error: 'Resource is not available for booking' }, { status: 400 });
        }

        // Create the booking record
        const { data: booking, error: bookingError } = await supabase
            .from('resource_bookings')
            .insert({
                resource_id: resourceId,
                club_id: body.clubId,
                start_time: body.startTime,
                end_time: body.endTime,
                status: 'approved',
            })
            .select()
            .single();

        if (bookingError) {
            return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
        }

        // If a deposit is required, create a hold
        if (resource.deposit_required > 0) {
            try {
                await createDepositHold(
                    resourceId,
                    body.clubId,
                    booking.id,
                    resource.deposit_required
                );
            } catch (holdError) {
                // Rollback booking if hold fails
                await supabase.from('resource_bookings').delete().eq('id', booking.id);
                return NextResponse.json(
                    { error: holdError instanceof Error ? holdError.message : 'Failed to process deposit hold' },
                    { status: 400 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            booking,
            message: resource.deposit_required > 0
                ? `Booking successful. A deposit hold of $${resource.deposit_required} has been placed on your ledger.`
                : 'Booking successful.',
        });
    } catch (error) {
        console.error('Resource booking error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
