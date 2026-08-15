// =============================================================================
// Hook: useSponsorshipMatches
// Issue: #2961 - Implement 'Sponsorship Matchmaking' Algorithm
// Description: Fetches the recommended sponsors for a specific funding request 
// by invoking the Postgres RPC matchmaking algorithm. Handles the state for 
// sending pitches and tracking pitch statuses.
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { SponsorshipCampaign, SponsorPitch } from '../../lib/sponsorship/matchmaking';

interface UseSponsorshipMatchesReturn {
    matches: SponsorshipCampaign[];
    pitches: SponsorPitch[];
    isLoading: boolean;
    isSubmitting: boolean;
    error: string | null;
    fetchMatches: () => Promise<void>;
    sendPitch: (campaignId: string, message: string, amount: number) => Promise<boolean>;
}

export function useSponsorshipMatches(requestId: string | null): UseSponsorshipMatchesReturn {
    const [matches, setMatches] = useState<SponsorshipCampaign[]>([]);
    const [pitches, setPitches] = useState<SponsorPitch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMatches = useCallback(async () => {
        if (!requestId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Invoke the RPC to get algorithmically matched sponsors
            const { data: matchData, error: matchError } = await supabase.rpc('match_sponsors', {
                p_request_id: requestId
            });

            if (matchError) throw matchError;
            setMatches((matchData as SponsorshipCampaign[]) || []);

            // 2. Fetch existing pitches for this request to show status
            const { data: pitchData, error: pitchError } = await supabase
                .from('sponsor_pitches')
                .select('*')
                .eq('request_id', requestId);

            if (pitchError) throw pitchError;
            setPitches((pitchData as SponsorPitch[]) || []);

        } catch (err: any) {
            console.error('[useSponsorshipMatches] Fetch failed:', err);
            setError(err.message || 'Failed to load sponsor matches.');
        } finally {
            setIsLoading(false);
        }
    }, [requestId]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const sendPitch = async (campaignId: string, message: string, amount: number): Promise<boolean> => {
        if (!requestId) return false;

        setIsSubmitting(true);
        setError(null);

        try {
            const { error: insertError } = await supabase
                .from('sponsor_pitches')
                .insert({
                    request_id: requestId,
                    campaign_id: campaignId,
                    pitch_message: message,
                    requested_amount: amount,
                    status: 'pending'
                });

            if (insertError) throw insertError;

            await fetchMatches(); // Refresh to show the new pitch
            return true;
        } catch (err: any) {
            console.error('[useSponsorshipMatches] Pitch failed:', err);
            setError(err.message.includes('duplicate')
                ? 'You have already pitched to this sponsor for this request.'
                : err.message);
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        matches,
        pitches,
        isLoading,
        isSubmitting,
        error,
        fetchMatches,
        sendPitch
    };
}
