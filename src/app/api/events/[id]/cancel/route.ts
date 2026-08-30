import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEventWithVersion, addMultiSigApproval } from '@/lib/events/concurrency';
import { MultiSigApprovalPayload } from '@/types/events';

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
        const body: MultiSigApprovalPayload = await req.json();

        if (body.eventId !== eventId || body.action !== 'cancel') {
            return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
        }

        // 1. Fetch current event state
        const event = await getEventWithVersion(eventId);

        if (event.status === 'cancelled') {
            return NextResponse.json({ error: 'Event is already cancelled' }, { status: 400 });
        }

        // 2. Check club admin count to determine if multi-sig is needed
        const { data: admins, error: adminError } = await supabase
            .from('club_admins')
            .select('user_id')
            .eq('club_id', event.club_id)
            .in('role', ['president', 'co-president', 'admin']);

        if (adminError) {
            throw new Error('Failed to fetch club admins');
        }

        const requiresMultiSig = admins && admins.length >= 2;

        if (requiresMultiSig) {
            // 3. Add approval and check if we have enough
            const updatedEvent = await addMultiSigApproval(eventId, body.adminId, 'cancel');

            const approvedCount = (updatedEvent.cancellation_approved_by || []).length;

            if (approvedCount < 2) {
                return NextResponse.json({
                    success: true,
                    requiresMultiSig: true,
                    message: `Approval recorded. ${approvedCount}/2 admins have approved. Waiting for second approval.`,
                    approvedCount,
                });
            }
        }

        // 4. Execute cancellation (either single admin club or multi-sig satisfied)
        const { error: updateError } = await supabase
            .from('events')
            .update({ status: 'cancelled' })
            .eq('id', eventId);

        if (updateError) {
            throw new Error(`Failed to cancel event: ${updateError.message}`);
        }

        return NextResponse.json({
            success: true,
            requiresMultiSig: false,
            message: 'Event successfully cancelled',
        });
    } catch (error) {
        console.error('Event cancellation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
