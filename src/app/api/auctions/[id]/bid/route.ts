import { NextRequest, NextResponse } from 'next/server';
import { placeBidWithSnipingProtection } from '@/lib/auctions/snipingProtection';
import { PlaceBidRequest, PlaceBidResponse } from '@/types/auctions';

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const auctionId = params.id;
        const body: PlaceBidRequest = await req.json();

        if (body.auctionId !== auctionId) {
            return NextResponse.json({ error: 'Auction ID mismatch' }, { status: 400 });
        }

        const result = await placeBidWithSnipingProtection(
            auctionId,
            body.userId,
            body.bidAmount
        );

        // In a real implementation, broadcast to WebSocket subscribers here
        // e.g., await broadcastToChannel(`auction_${auctionId}`, { type: 'bid_placed', ... })

        return NextResponse.json({
            success: true,
            message: 'Bid placed successfully',
            newCurrentBid: result.auction.current_bid,
            newEndTime: result.auction.end_time,
            wasExtended: result.wasExtended,
            extensionMessage: result.extensionMessage,
        } as PlaceBidResponse);

    } catch (error) {
        console.error('Bid placement error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 400 }
        );
    }
}
