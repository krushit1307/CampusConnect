// =============================================================================
// Hook: useUserPenalties
// Issue: #3330 - Implement 'Automated No-Show Penalty' System
//Description: Fetches the current user's no-show strike count and suspension 
//status.Provides a boolean flag to easily gate RSVP buttons across the app.
    // =============================================================================

    import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface UserPenaltyState {
    noShowCount: number;
    isSuspended: boolean;
    suspendedUntil: string | null;
    daysRemaining: number | null;
}

interface UseUserPenaltiesReturn {
    penalties: UserPenaltyState;
    isLoading: boolean;
    canRSVP: boolean;
}

export function useUserPenalties(): UseUserPenaltiesReturn {
    const [penalties, setPenalties] = useState<UserPenaltyState>({
        noShowCount: 0,
        isSuspended: false,
        suspendedUntil: null,
        daysRemaining: null
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPenalties = async () => {
            setIsLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setIsLoading(false);
                    return;
                }

                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('no_show_count, rsvp_suspended_until')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                const now = new Date();
                const suspendedUntil = profile?.rsvp_suspended_until ? new Date(profile.rsvp_suspended_until) : null;
                const isSuspended = suspendedUntil ? suspendedUntil > now : false;

                let daysRemaining = null;
                if (isSuspended && suspendedUntil) {
                    const diffTime = suspendedUntil.getTime() - now.getTime();
                    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                setPenalties({
                    noShowCount: profile?.no_show_count || 0,
                    isSuspended,
                    suspendedUntil: profile?.rsvp_suspended_until || null,
                    daysRemaining
                });
            } catch (err) {
                console.error('[useUserPenalties] Fetch failed:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPenalties();
    }, []);

    return {
        penalties,
        isLoading,
        canRSVP: !penalties.isSuspended && !isLoading
    };
}
