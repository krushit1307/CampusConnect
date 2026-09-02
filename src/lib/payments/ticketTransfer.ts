import { createClient } from '@supabase/supabase-js';
import {
    TransferableTicket,
    ListTicketRequest,
    PurchaseTicketRequest,
    TicketTransferResult,
    MarketplaceListing
} from '@/types/tickets';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Maximum allowed markup percentage for secondary ticket sales (120% of face value).
 * This allows for a small convenience fee while preventing predatory scalping.
 */
export const MAX_PRICE_MULTIPLIER = 1.20;

/**
 * Calculates the maximum allowed listing price for a ticket based on its face value.
 * 
 * @param faceValue The original price paid for the ticket
 * @returns The maximum permissible listing price
 */
export function calculateMaxAllowedPrice(faceValue: number): number {
    return Math.round(faceValue * MAX_PRICE_MULTIPLIER * 100) / 100;
}

/**
 * Lists a ticket on the internal transfer marketplace with price cap enforcement.
 * 
 * @param request The listing request containing ticket ID and desired price
 * @param userId The ID of the user attempting to list the ticket
 * @returns Promise resolving to the updated ticket or throwing an error
 */
export async function listTicketForTransfer(
    request: ListTicketRequest,
    userId: string
): Promise<TransferableTicket> {
    // 1. Fetch the ticket to verify ownership and get face value
    const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', request.ticketId)
        .eq('originalOwnerId', userId)
        .eq('status', 'active')
        .single();

    if (fetchError || !ticket) {
        throw new Error('Ticket not found or you do not have permission to list it.');
    }

    // 2. Enforce algorithmic anti-scalping price cap
    const maxAllowed = calculateMaxAllowedPrice(ticket.faceValue);
    if (request.listingPrice > maxAllowed) {
        throw new Error(`Listing price exceeds the 120% anti-scalping cap. Maximum allowed price is $${maxAllowed.toFixed(2)}.`);
    }

    if (request.listingPrice < ticket.faceValue) {
        throw new Error('Listing price cannot be lower than the original face value.');
    }

    // 3. Update ticket status to 'listed'
    const { data: updatedTicket, error: updateError } = await supabase
        .from('tickets')
        .update({
            status: 'listed',
            listedPrice: request.listingPrice,
            listedAt: new Date().toISOString(),
        })
        .eq('id', request.ticketId)
        .select()
        .single();

    if (updateError) {
        throw new Error(`Failed to list ticket: ${updateError.message}`);
    }

    return updatedTicket as TransferableTicket;
}

/**
 * Executes a secure ticket transfer, refunding the original buyer and charging the new buyer.
 * Generates a new cryptographic QR code to prevent double-spend fraud.
 * 
 * @param request The purchase request containing buyer details and payment method
 * @returns Promise resolving to the transfer result
 */
export async function executeTicketTransfer(request: PurchaseTicketRequest): Promise<TicketTransferResult> {
    // 1. Fetch the listed ticket
    const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', request.ticketId)
        .eq('status', 'listed')
        .single();

    if (fetchError || !ticket) {
        throw new Error('Ticket is no longer available for purchase.');
    }

    // 2. Verify buyer is not the original owner (prevent self-buying loops)
    if (ticket.originalOwnerId === request.buyerId) {
        throw new Error('You cannot purchase your own listed ticket.');
    }

    // 3. Process Stripe Connect transfer (Mocked for this implementation)
    // In production: 
    // - Charge the buyer's payment method for ticket.listedPrice
    // - Refund the original owner's payment method for ticket.faceValue
    // - Retain the difference as a platform convenience fee

    const refundAmount = ticket.faceValue;
    const chargeAmount = ticket.listedPrice;

    // 4. Generate new cryptographic QR code
    const newQrCode = `QR-${crypto.randomUUID()}`;

    // 5. Update ticket ownership and status
    const { error: updateError } = await supabase
        .from('tickets')
        .update({
            originalOwnerId: request.buyerId,
            currentQrCode: newQrCode,
            status: 'transferred',
            listedPrice: null,
            listedAt: null,
        })
        .eq('id', request.ticketId);

    if (updateError) {
        throw new Error(`Failed to finalize transfer: ${updateError.message}`);
    }

    // 6. Log the transaction in the ledger for audit purposes
    await supabase.from('ledger_transactions').insert([
        {
            user_id: request.buyerId,
            amount: -chargeAmount,
            transaction_type: 'ticket_purchase_secondary',
            description: `Purchased transferred ticket for ${ticket.eventName}`,
            status: 'completed',
        },
        {
            user_id: ticket.originalOwnerId,
            amount: refundAmount,
            transaction_type: 'ticket_refund_secondary',
            description: `Refund for transferred ticket: ${ticket.eventName}`,
            status: 'completed',
        }
    ]);

    return {
        success: true,
        message: 'Ticket transferred successfully. Your new QR code has been generated.',
        newQrCode,
        refundAmount,
        chargeAmount,
    };
}

/**
 * Fetches all active marketplace listings for a specific event.
 * 
 * @param eventId The ID of the event to fetch listings for
 * @returns Promise resolving to an array of marketplace listings
 */
export async function getEventMarketplaceListings(eventId: string): Promise<MarketplaceListing[]> {
    const { data, error } = await supabase
        .from('tickets')
        .select(`
      id,
      eventId,
      eventName,
      faceValue,
      listedPrice,
      listedAt,
      profiles!tickets_originalOwnerId_fkey (full_name)
    `)
        .eq('eventId', eventId)
        .eq('status', 'listed')
        .order('listedAt', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch listings: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
        ticketId: item.id,
        eventId: item.eventId,
        eventName: item.eventName,
        faceValue: item.faceValue,
        listingPrice: item.listedPrice,
        maxAllowedPrice: calculateMaxAllowedPrice(item.faceValue),
        sellerName: item.profiles?.full_name || 'Anonymous',
        listedAt: item.listedAt,
    }));
}
