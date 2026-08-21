// =============================================================================
// Hook: useAccountMerger
// Issue: #3560 - Implement 'Automated User Account Merger'
// Description: Manages the self - serve account merging workflow.Handles the
// OAuth flow to authenticate the secondary account, verifies ownership, and
// executes the sensitive Postgres RPC to merge the data atomically.
// =============================================================================

    import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface UseAccountMergerReturn {
    isMerging: boolean;
    isAuthenticating: boolean;
    error: string | null;
    secondaryEmail: string | null;
    initiateOAuth: () => Promise<void>;
    executeMerge: (secondaryUserId: string) => Promise<boolean>;
    clearState: () => void;
}

export function useAccountMerger(): UseAccountMergerReturn {
    const [isMerging, setIsMerging] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [secondaryEmail, setSecondaryEmail] = useState<string | null>(null);

    const clearState = useCallback(() => {
        setError(null);
        setSecondaryEmail(null);
    }, []);

    // 1. Initiate OAuth flow for the secondary account
    const initiateOAuth = async () => {
        setIsAuthenticating(true);
        setError(null);

        try {
            // We use a special redirect URL that will handle the secondary auth logic
            // In a real app, this might open a popup or redirect to a dedicated merge-auth page
            const { error: authError } = await supabase.auth.signInWithOAuth({
                provider: 'google', // Assuming Google OAuth for Gmail accounts
                options: {
                    redirectTo: `${window.location.origin}/settings/merge-callback`,
                    queryParams: {
                        prompt: 'select_account', // Force account selection
                        access_type: 'offline'
                    }
                }
            });

            if (authError) throw authError;
        } catch (err: any) {
            console.error('[useAccountMerger] OAuth failed:', err);
            setError(err.message || 'Failed to initiate authentication.');
            setIsAuthenticating(false);
        }
    };

    // 2. Execute the merge RPC
    const executeMerge = async (secondaryUserId: string): Promise<boolean> => {
        setIsMerging(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Primary user not authenticated.');

            // Call the secure RPC to merge the accounts
            const { data, error: rpcError } = await supabase.rpc('merge_user_accounts', {
                p_primary_user_id: user.id,
                p_secondary_user_id: secondaryUserId
            });

            if (rpcError) throw rpcError;
            if (!data) throw new Error('Merge operation failed.');

            // In a production environment, you would now call the Supabase Admin API
            // to permanently delete the secondary auth user record:
            // await supabaseAdmin.auth.admin.deleteUser(secondaryUserId);

            setIsMerging(false);
            return true;
        } catch (err: any) {
            console.error('[useAccountMerger] Merge failed:', err);
            setError(err.message || 'Failed to merge accounts. Please contact support.');
            setIsMerging(false);
            return false;
        }
    };

    return {
        isMerging,
        isAuthenticating,
        error,
        secondaryEmail,
        initiateOAuth,
        executeMerge,
        clearState
    };
}
