import { NextResponse } from 'next/server';
import { CancellationQueue } from '../../../../../../../../services/payments/cancellationQueue';

const queue = new CancellationQueue();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    // 1. Mark event as cancelled in DB
    // await db.event.update({ where: { id: eventId }, data: { status: 'CANCELLED' } })

    // 2. Queue cancellation for async processing (to prevent long HTTP request)
    await queue.pushToQueue(eventId);

    return NextResponse.json({
      success: true,
      message: 'Event cancelled. Refunds queued for processing.'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
