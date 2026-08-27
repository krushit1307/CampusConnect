// =============================================================================
// Hook: useWaitlistBidding
//  Issue: #3544 - Build an 'Interactive Event Waitlist Bidding' System
//  Description: Manages the state for the charity waitlist leaderboard. 
//  Fetches anonymized bids, handles the Stripe Elements SetupIntent flow, 
//  and updates the user's bid position in real-time via Supabase Realtime.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface AnonymizedBid {
    rank: number;
    bid_amount_cents: number;
    is_current_user: boolean;
}

interface UseWaitlistBiddingReturn {
    leaderboard: AnonymizedBid[];
    userCurrentBid: number;
    isLoading: boolean;
    error: string | null;
    initiateBid: (rsvpId: string, amountDollars: number) => Promise<string | null>; // Returns client_secret
    confirmBidSuccess: (rsvpId: string) => Promise<void>;
}

export function useWaitlistBidding(eventId: string | null, userRsvpId: string | null): UseWaitlistBiddingReturn {
    const [leaderboard, setLeaderboard] = useState<AnonymizedBid[]>([]);
    const [userCurrentBid, setUserCurrentBid] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboard = useCallback(async () => {
        if (!eventId) return;
        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Fetch top 50 bids, ordered descending
            const { data: bids, error: fetchError } = await supabase
                .from('event_rsvps')
                .select('user_id, bid_amount_cents')
                .eq('event_id', eventId)
                .eq('status', 'waitlisted')
                .eq('bid_status', 'authorized')
                .gt('bid_amount_cents', 0)
                .order('bid_amount_cents', { ascending: false })
                .limit(50);

            if (fetchError) throw fetchError;

            const formatted: AnonymizedBid[] = (bids || []).map((b, idx) => ({
                rank: idx + 1,
                bid_amount_cents: b.bid_amount_cents,
                is_current_user: b.user_id === user?.id
            }));

            setLeaderboard(formatted);

            const myBid = formatted.find(b => b.is_current_user);
            setUserCurrentBid(myBid ? myBid.bid_amount_cents : 0);

        } catch (err: any) {
            console.error('[useWaitlistBidding] Fetch failed:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    // Subscribe to Realtime updates for the leaderboard
    useEffect(() => {
        if (!eventId) return;
        fetchLeaderboard();

        const channel = supabase
            .channel(`waitlist-bids-${eventId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps', filter: `event_id=eq.${eventId}` }, () => {
                fetchLeaderboard();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [eventId, fetchLeaderboard]);

    const initiateBid = async (rsvpId: string, amountDollars: number): Promise<string | null> => {
        setError(null);
        try {
            const amountCents = Math.round(amountDollars * 100);
            const { data, error: fnError } = await supabase.functions.invoke('create-bid-setup-intent', {
                body: { rsvp_id: rsvpId, bid_amount_cents: amountCents }
            });
            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);
            return data.client_secret;
        } catch (err: any) {
            setError(err.message || 'Failed to initiate bid.');
            return null;
        }
    };

    const confirmBidSuccess = async (rsvpId: string) => {
        // The Edge Function already updated the DB, but we can force a refetch
        await fetchLeaderboard();
    };

    return { leaderboard, userCurrentBid, isLoading, error, initiateBid, confirmBidSuccess };
}
