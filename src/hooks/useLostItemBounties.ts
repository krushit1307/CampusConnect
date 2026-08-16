// =============================================================================
// Hook: useLostItemBounties
//  Issue: #3318 - Implement 'Interactive Lost Item Bounty' System
//  Description: Manages the state for creating bounty escrows and releasing 
//  funds to the finder. Handles the Stripe Checkout redirect and the final 
//  transfer execution.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface UseLostItemBountiesReturn {
    isCreatingEscrow: boolean;
    isReleasing: boolean;
    error: string | null;
    createBounty: (lostItemId: string, amountDollars: number) => Promise<boolean>;
    releaseFunds: (lostItemId: string) => Promise<boolean>;
    markReturned: (lostItemId: string, finderId: string) => Promise<boolean>;
}

export function useLostItemBounties(): UseLostItemBountiesReturn {
    const [isCreatingEscrow, setIsCreatingEscrow] = useState(false);
    const [isReleasing, setIsReleasing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createBounty = async (lostItemId: string, amountDollars: number): Promise<boolean> => {
        setIsCreatingEscrow(true);
        setError(null);

        try {
            const amountCents = Math.round(amountDollars * 100);

            const { data, error: fnError } = await supabase.functions.invoke('create-bounty-escrow', {
                body: { lost_item_id: lostItemId, amount_cents: amountCents }
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            // Redirect to Stripe Checkout
            if (data.url) {
                window.location.href = data.url;
                return true;
            }
            return false;
        } catch (err: any) {
            console.error('[useLostItemBounties] Create escrow failed:', err);
            setError(err.message || 'Failed to create bounty.');
            return false;
        } finally {
            setIsCreatingEscrow(false);
        }
    };

    const markReturned = async (lostItemId: string, finderId: string): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('lost_items')
                .update({ finder_user_id: finderId, status: 'found' })
                .eq('id', lostItemId);

            if (updateError) throw updateError;
            return true;
        } catch (err: any) {
            console.error('[useLostItemBounties] Mark returned failed:', err);
            setError(err.message);
            return false;
        }
    };

    const releaseFunds = async (lostItemId: string): Promise<boolean> => {
        setIsReleasing(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('release-bounty', {
                body: { lost_item_id: lostItemId }
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            return true;
        } catch (err: any) {
            console.error('[useLostItemBounties] Release failed:', err);
            setError(err.message || 'Failed to release funds.');
            return false;
        } finally {
            setIsReleasing(false);
        }
    };

    return {
        isCreatingEscrow,
        isReleasing,
        error,
        createBounty,
        releaseFunds,
        markReturned
    };
}
