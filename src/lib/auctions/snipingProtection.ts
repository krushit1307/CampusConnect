import { createClient } from '@supabase/supabase-js';
import { Auction } from '@/types/auctions';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EXTENSION_SECONDS = 300; // 5 minutes

/**
 * Calculates if a bid qualifies for an auction extension (anti-sniping).
 * Returns the new end time and whether an extension occurred.
 */
export function calculateExtendedEndTime(currentEndTime: string): { newEndTime: string; wasExtended: boolean } {
    const endTime = new Date(currentEndTime).getTime();
    const now = Date.now();
    const deltaSeconds = (endTime - now) / 1000;

    if (deltaSeconds > 0 && deltaSeconds < EXTENSION_SECONDS) {
        const newEndTime = new Date(endTime + EXTENSION_SECONDS * 1000);
        return {
            newEndTime: newEndTime.toISOString(),
            wasExtended: true,
        };
    }

    return {
        newEndTime: currentEndTime,
        wasExtended: false,
    };
}

/**
 * Places a bid and applies soft-close extension if necessary.
 */
export async function placeBidWithSnipingProtection(
    auctionId: string,
    userId: string,
    bidAmount: number
): Promise<{ auction: Auction; wasExtended: boolean; extensionMessage?: string }> {
    // 1. Fetch current auction state
    const { data: auction, error: fetchError } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .eq('status', 'active')
        .single();

    if (fetchError || !auction) {
        throw new Error('Active auction not found');
    }

    if (bidAmount <= auction.current_bid) {
        throw new Error(`Bid must be higher than current bid of ${auction.current_bid}`);
    }

    // 2. Calculate potential extension
    const { newEndTime, wasExtended } = calculateExtendedEndTime(auction.end_time);

    // 3. Update auction with new bid and potentially new end time
    const updatePayload: any = {
        current_bid: bidAmount,
        current_bidder_id: userId,
    };

    if (wasExtended) {
        updatePayload.end_time = newEndTime;
        updatePayload.extended_count = (auction.extended_count || 0) + 1;
        updatePayload.last_extended_at = new Date().toISOString();
    }

    const { data: updatedAuction, error: updateError } = await supabase
        .from('auctions')
        .update(updatePayload)
        .eq('id', auctionId)
        .select()
        .single();

    if (updateError) {
        throw new Error(`Failed to place bid: ${updateError.message}`);
    }

    const extensionMessage = wasExtended
        ? `Auction extended by 5 minutes due to a late bid! (Total extensions: ${updatedAuction.extended_count})`
        : undefined;

    return {
        auction: updatedAuction as Auction,
        wasExtended,
        extensionMessage,
    };
}
