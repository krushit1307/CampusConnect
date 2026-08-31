import { NextRequest, NextResponse } from 'next/server';
import { listTicketForTransfer, executeTicketTransfer, getEventMarketplaceListings } from '@/lib/payments/ticketTransfer';
import { ListTicketRequest, PurchaseTicketRequest } from '@/types/tickets';

/**
 * Handles ticket transfer marketplace operations.
 * Supports GET (fetch listings), POST (list or purchase).
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get('eventId');

        if (!eventId) {
            return NextResponse.json(
                { error: 'eventId query parameter is required' },
                { status: 400 }
            );
        }

        const listings = await getEventMarketplaceListings(eventId);

        return NextResponse.json({
            success: true,
            listings,
        });
    } catch (error) {
        console.error('Failed to fetch marketplace listings:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const action = body.action; // 'list' or 'purchase'

        if (action === 'list') {
            const listRequest: ListTicketRequest = body;
            const userId = req.headers.get('x-user-id'); // In production, verify via JWT

            if (!userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const result = await listTicketForTransfer(listRequest, userId);
            return NextResponse.json({ success: true, ticket: result });
        }

        if (action === 'purchase') {
            const purchaseRequest: PurchaseTicketRequest = body;
            const result = await executeTicketTransfer(purchaseRequest);
            return NextResponse.json({ success: true, result });
        }

        return NextResponse.json(
            { error: 'Invalid action. Use "list" or "purchase".' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Ticket transfer API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 400 }
        );
    }
}

export const config = {
    runtime: 'edge',
};

