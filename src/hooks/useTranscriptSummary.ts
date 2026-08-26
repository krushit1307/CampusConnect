// =============================================================================
// Hook: useTranscriptSummary
// Issue: #3539 - Implement 'Real-Time Event Transcript Summarizer (TL;DR)'
// Description: Fetches the cached TL;DR summary for an event.If it doesn't 
// exist and the user is an admin, provides a function to trigger the Edge
// Function Map - Reduce pipeline to generate it on demand.
    // =============================================================================

    import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface TranscriptSummary {
    event_id: string;
    summary_points: string[];
    generated_at: string;
    model_used: string;
}

interface UseTranscriptSummaryReturn {
    summary: TranscriptSummary | null;
    isLoading: boolean;
    isGenerating: boolean;
    error: string | null;
    triggerGeneration: (transcriptText: string) => Promise<boolean>;
}

export function useTranscriptSummary(eventId: string | null): UseTranscriptSummaryReturn {
    const [summary, setSummary] = useState<TranscriptSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = useCallback(async () => {
        if (!eventId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('event_summaries')
                .select('*')
                .eq('event_id', eventId)
                .maybeSingle();

            if (fetchError) throw fetchError;
            setSummary(data as TranscriptSummary | null);
        } catch (err: any) {
            console.error('[useTranscriptSummary] Fetch failed:', err);
            setError(err.message || 'Failed to load summary.');
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    const triggerGeneration = async (transcriptText: string): Promise<boolean> => {
        if (!eventId || !transcriptText) return false;

        setIsGenerating(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('summarize-transcript', {
                body: { event_id: eventId, transcript_text: transcriptText }
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            // Refetch to get the newly generated summary
            await fetchSummary();
            return true;
        } catch (err: any) {
            console.error('[useTranscriptSummary] Generation failed:', err);
            setError(err.message || 'Failed to generate TL;DR.');
            return false;
        } finally {
            setIsGenerating(false);
        }
    };

    return { summary, isLoading, isGenerating, error, triggerGeneration };
}
