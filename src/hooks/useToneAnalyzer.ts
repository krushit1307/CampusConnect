// =============================================================================
// Hook: useToneAnalyzer
// Issue: #3557 - Implement 'Automated Event Description "Tone" Analyzer'
// Description: Manages the tone analysis workflow. Triggers the Edge Function
// when the user attempts to save a draft, and handles the AI rewrite flow
// if the text is flagged as too informal.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { analyzeClientTone, ToneAnalysisResult } from '../../lib/nlp/toneAnalyzer';

interface UseToneAnalyzerReturn {
    clientAnalysis: ToneAnalysisResult;
    isAnalyzing: boolean;
    isRewriting: boolean;
    error: string | null;
    checkTone: (text: string, clubId: string) => Promise<ToneAnalysisResult | null>;
    rewriteText: (text: string) => Promise<string | null>;
    updateClientAnalysis: (text: string) => void;
}

export function useToneAnalyzer(): UseToneAnalyzerReturn {
    const [clientAnalysis, setClientAnalysis] = useState<ToneAnalysisResult>({
        score: 100,
        warnings: [],
        requiresReview: false
    });
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isRewriting, setIsRewriting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update client-side analysis as the user types
    const updateClientAnalysis = useCallback((text: string) => {
        const result = analyzeClientTone(text);
        setClientAnalysis(result);
    }, []);

    // Trigger server-side analysis when saving draft
    const checkTone = async (text: string, clubId: string): Promise<ToneAnalysisResult | null> => {
        setIsAnalyzing(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('analyze-tone', {
                body: { text, club_id: clubId }
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            // If not an official department, bypass warnings
            if (!data.is_official) {
                const bypassResult: ToneAnalysisResult = { score: 100, warnings: [], requiresReview: false };
                setClientAnalysis(bypassResult);
                return bypassResult;
            }

            const result: ToneAnalysisResult = {
                score: data.score,
                warnings: data.warnings || [],
                requiresReview: data.requires_review || false
            };

            setClientAnalysis(result);
            return result;
        } catch (err: any) {
            console.error('[useToneAnalyzer] Check failed:', err);
            setError(err.message || 'Failed to analyze tone.');
            return null;
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Trigger AI rewrite
    const rewriteText = async (text: string): Promise<string | null> => {
        setIsRewriting(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('rewrite-professional', {
                body: { text }
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            return data.rewritten_text;
        } catch (err: any) {
            console.error('[useToneAnalyzer] Rewrite failed:', err);
            setError(err.message || 'Failed to rewrite text.');
            return null;
        } finally {
            setIsRewriting(false);
        }
    };

    return {
        clientAnalysis,
        isAnalyzing,
        isRewriting,
        error,
        checkTone,
        rewriteText,
        updateClientAnalysis
    };
}
