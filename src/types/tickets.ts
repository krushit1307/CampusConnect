/**
 * Ticketing and Secondary Market Types for CampusConnect
 * Defines interfaces for ticket transfers, price capping, and QR invalidation.
 */

/**
 * Represents a ticket eligible for transfer on the secondary market.
 */
export interface TransferableTicket {
    /** Unique ticket identifier */
    id: string;
    /** Event associated with the ticket */
    eventId: string;
    eventName: string;
    /** Original purchaser user ID */
    originalOwnerId: string;
    /** Original face value paid for the ticket */
    faceValue: number;
    /** Current QR code string (to be invalidated upon transfer) */
    currentQrCode: string;
    /** Ticket status */
    status: 'active' | 'listed' | 'pending_transfer' | 'transferred' | 'invalidated';
    /** Listed price on the marketplace (if applicable) */
    listedPrice?: number;
    /** Timestamp when the ticket was listed */
    listedAt?: string;
}

/**
 * Payload for listing a ticket on the internal transfer marketplace.
 */
export interface ListTicketRequest {
    ticketId: string;
    listingPrice: number;
}

/**
 * Payload for purchasing a listed ticket from the marketplace.
 */
export interface PurchaseTicketRequest {
    ticketId: string;
    buyerId: string;
    paymentMethodId: string;
}

/**
 * Result of a ticket transfer operation.
 */
export interface TicketTransferResult {
    success: boolean;
    message: string;
    newQrCode?: string;
    refundAmount?: number;
    chargeAmount?: number;
}

/**
 * Marketplace listing view for buyers.
 */
export interface MarketplaceListing {
    ticketId: string;
    eventId: string;
    eventName: string;
    faceValue: number;
    listingPrice: number;
    maxAllowedPrice: number;
    sellerName: string;
    listedAt: string;
}
