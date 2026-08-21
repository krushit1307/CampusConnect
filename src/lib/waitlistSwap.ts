// src/lib/waitlistSwap.ts
//
// Frontend client for the Waitlist Swap Marketplace (Issue #2903).

import { supabase } from "./supabase/client";

/**
 * Claim a swap offer using the token from the SMS link.
 * Calls the `claim_swap_offer` Postgres RPC.
 */
export async function claimSwapOffer(
    offerId: string,
    claimToken: string,
    userId: string
): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc("claim_swap_offer", {
        p_offer_id: offerId,
        p_claim_token: claimToken,
        p_to_user_id: userId,
    });

    if (error || !data || data.success === false) {
        return {
            success: false,
            message: data?.error ?? error?.message ?? "Failed to claim the ticket.",
        };
    }

    return {
        success: true,
        message: data.message ?? "Ticket claimed successfully!",
    };
}
