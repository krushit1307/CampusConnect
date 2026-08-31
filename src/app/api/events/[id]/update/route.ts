import { NextRequest, NextResponse } from 'next/server';
import { updateEventWithOCC } from '@/lib/events/concurrency';
import { EventUpdatePayload } from '@/types/events';

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const eventId = params.id;
        const body: EventUpdatePayload = await req.json();

        if (body.eventId !== eventId) {
            return NextResponse.json({ error: 'Event ID mismatch' }, { status: 400 });
        }

        const { currentVersion, ...updates } = body;

        // Remove undefined values from updates
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );

        if (Object.keys(cleanUpdates).length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        const updatedEvent = await updateEventWithOCC({
            eventId,
            currentVersion,
            updates: cleanUpdates,
        });

        return NextResponse.json({
            success: true,
            message: 'Event updated successfully',
            event: updatedEvent,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'OptimisticConcurrencyError') {
            return NextResponse.json(
                {
                    error: error.message,
                    isOCCError: true,
                    currentVersion: (error as any).currentVersion
                },
                { status: 409 } // 409 Conflict
            );
        }

        console.error('Event update error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
