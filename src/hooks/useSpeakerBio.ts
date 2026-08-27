// =============================================================================
// Hook: useSpeakerBio
// Issue: #3339 - Implement 'Automated Speaker Bio Fetching'
// Description: Manages the state for triggering the Edge Function to fetch
// and summarize a speaker's biography from their LinkedIn URL.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface SpeakerData {
    name: string;
    bio: string;
    photo_url: string | null;
    headline: string;
}

interface UseSpeakerBioReturn {
    isFetching: boolean;
    error: string | null;
    fetchBio: (linkedinUrl: string) => Promise<SpeakerData | null>;
}

export function useSpeakerBio(): UseSpeakerBioReturn {
    const [isFetching, setIsFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBio = useCallback(async (linkedinUrl: string): Promise<SpeakerData | null> => {
        setIsFetching(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('fetch-speaker-bio', {
                body: { linkedin_url: linkedinUrl }
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            return data.data as SpeakerData;
        } catch (err: any) {
            console.error('[useSpeakerBio] Fetch failed:', err);
            setError(err.message || 'Failed to fetch speaker bio. Ensure the profile is public.');
            return null;
        } finally {
            setIsFetching(false);
        }
    }, []);

    return { isFetching, error, fetchBio };
}
