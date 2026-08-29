/**
 * Auction and Sniping Protection Types for CampusConnect
 * Defines interfaces for gamification auctions and anti-sniping logic.
 */

export interface Auction {
    id: string;
    resource_id: string;
    resource_name: string;
    starting_bid: number;
    current_bid: number;
    current_bidder_id: string | null;
    end_time: string;
    original_end_time: string;
    extended_count: number;
    status: 'active' | 'completed' | 'cancelled';
    created_at: string;
}

export interface PlaceBidRequest {
    auctionId: string;
    userId: string;
    bidAmount: number;
}

export interface PlaceBidResponse {
    success: boolean;
    message: string;
    newCurrentBid: number;
    newEndTime: string;
    wasExtended: boolean;
    extensionMessage?: string;
}

export interface AuctionWebSocketUpdate {
    type: 'bid_placed' | 'auction_extended';
    auctionId: string;
    currentBid: number;
    bidderName: string;
    endTime: string;
    message?: string;
}
