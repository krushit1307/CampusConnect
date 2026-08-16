// =============================================================================
// Hook: useIcebreakers
// Issue: #3269 - Develop an 'Algorithmic Icebreaker' Engine for Networking Events
// Description: Fetches the generated icebreaker suggestions for the current 
// user at a specific event. Handles triggering the generation Edge Function 
// and managing the "Wave" interaction state.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface IcebreakerMatch {
    id: string;
    user_b_id: string;
    similarity_score: number;
    shared_interests: string[];
    conversation_prompt: string;
    profiles?: {
        full_name: string;
        avatar_url: string | null;
        major: string | null;
    };
    has_waved: boolean;
}

interface UseIcebreakersReturn {
    matches: IcebreakerMatch[];
    isLoading: boolean;
    isGenerating: boolean;
    error: string | null;
    generateSuggestions: () => Promise<void>;
    sendWave: (connectionId: string) => Promise<void>;
}

export function useIcebreakers(eventId: string | null): UseIcebreakersReturn {
    const [matches, setMatches] = useState<IcebreakerMatch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMatches = useCallback(async () => {
        if (!eventId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setIsLoading(false);
                return;
            }

            // Fetch connections where the current user is user_a
            const { data: connections, error: connError } = await supabase
                .from('icebreaker_connections')
                .select(`
          id,
          user_b_id,
          similarity_score,
          shared_interests,
          conversation_prompt,
          profiles:user_b_id (full_name, avatar_url, major),
          icebreaker_waves (waved_by)
        `)
                .eq('event_id', eventId)
                .eq('user_a_id', user.id)
                .order('similarity_score', { ascending: false });

            if (connError) throw connError;

            const formattedMatches: IcebreakerMatch[] = (connections || []).map((conn: any) => ({
                id: conn.id,
                user_b_id: conn.user_b_id,
                similarity_score: conn.similarity_score,
                shared_interests: conn.shared_interests,
                conversation_prompt: conn.conversation_prompt,
                profiles: conn.profiles,
                has_waved: conn.icebreaker_waves && conn.icebreaker_waves.length > 0
            }));

            setMatches(formattedMatches);
        } catch (err: any) {
            console.error('[useIcebreakers] Fetch failed:', err);
            setError(err.message || 'Failed to load suggestions.');
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const generateSuggestions = async () => {
        if (!eventId) return;
        setIsGenerating(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('generate-icebreakers', {
                body: { event_id: eventId }
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            // Refetch to show the newly generated matches
            await fetchMatches();
        } catch (err: any) {
            console.error('[useIcebreakers] Generation failed:', err);
            setError(err.message || 'Failed to generate suggestions.');
        } finally {
            setIsGenerating(false);
        }
    };

    const sendWave = async (connectionId: string) => {
        try {
            const { error: insertError } = await supabase
                .from('icebreaker_waves')
                .insert({ connection_id: connectionId });

            if (insertError) throw insertError;

            // Optimistically update local state
            setMatches(prev => prev.map(m =>
                m.id === connectionId ? { ...m, has_waved: true } : m
            ));
        } catch (err: any) {
            console.error('[useIcebreakers] Wave failed:', err);
        }
    };

    return {
        matches,
        isLoading,
        isGenerating,
        error,
        generateSuggestions,
        sendWave
    };
}
