// =============================================================================
// Hook: usePosterTranslation
// Issue: #3664 - Implement 'Real-Time "Translation Overlay" for Posters'
// Description: Loads the poster + OCR block map for an event, decides whether
// the viewer's language differs from the poster's source language, and lazily
// batch-translates the extracted strings for the overlay renderer.
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { PosterOcrData, OcrBlock, detectUserLanguage } from '../../lib/ocr/types';

interface UsePosterTranslationReturn {
    posterUrl: string | null;
    sourceLanguage: string;
    userLanguage: string;
    blocks: OcrBlock[];
    translatedTexts: Record<string, string>;
    needsTranslation: boolean;
    isTranslating: boolean;
    isLoading: boolean;
    showOverlay: boolean;
    setShowOverlay: (v: boolean) => void;
    translate: () => Promise<void>;
}

export function usePosterTranslation(eventId: string | null): UsePosterTranslationReturn {
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const [sourceLanguage, setSourceLanguage] = useState('en');
    const [ocrData, setOcrData] = useState<PosterOcrData | null>(null);
    const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
    const [isTranslating, setIsTranslating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showOverlay, setShowOverlay] = useState(true);

    const userLanguage = useMemo(() => detectUserLanguage(), []);
    const blocks = useMemo(() => ocrData?.blocks || [], [ocrData]);

    // Fetch poster URL + OCR payload + source language in one query
    useEffect(() => {
        const load = async () => {
            if (!eventId) { setIsLoading(false); return; }
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('events')
                    .select('cover_image_url, poster_source_language, poster_ocr_data')
                    .eq('id', eventId)
                    .single();

                if (error) throw error;
                setPosterUrl(data.cover_image_url);
                setSourceLanguage(data.poster_source_language || 'en');
                setOcrData(data.poster_ocr_data as PosterOcrData | null);
            } catch (err) {
                console.error('[usePosterTranslation] Load failed:', err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [eventId]);

    const needsTranslation = userLanguage !== sourceLanguage && blocks.length > 0;

    // Batch-translate every block once the user opts in (or automatically)
    const translate = useCallback(async () => {
        if (!needsTranslation || blocks.length === 0) return;
        setIsTranslating(true);
        try {
            const { data, error } = await supabase.functions.invoke('translate-text', {
                body: {
                    texts: blocks.map(b => b.text),
                    source: sourceLanguage,
                    target: userLanguage,
                },
            });
            if (error) throw error;

            const map: Record<string, string> = {};
            (data.translations as string[]).forEach((t, i) => {
                map[blocks[i].id] = t;
            });
            setTranslatedTexts(map);
        } catch (err) {
            console.error('[usePosterTranslation] Translate failed:', err);
        } finally {
            setIsTranslating(false);
        }
    }, [blocks, needsTranslation, sourceLanguage, userLanguage]);

    // Auto-translate on load when languages differ
    useEffect(() => {
        if (!isLoading && needsTranslation && Object.keys(translatedTexts).length === 0) {
            translate();
        }
    }, [isLoading, needsTranslation, translate, translatedTexts]);

    return {
        posterUrl, sourceLanguage, userLanguage, blocks, translatedTexts,
        needsTranslation, isTranslating, isLoading, showOverlay, setShowOverlay, translate,
    };
}
