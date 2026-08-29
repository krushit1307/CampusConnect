// =============================================================================
// Hook: useTagStandardization
// Issue: #3711 - Implement 'Automated "Event Tag" Standardization'
// Description: Loads the canonical dictionary once and normalizes tags
// client-side (instant feedback) with an optional server-side confirm pass.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CanonicalTag, normalizeTags, NormalizationResult } from '../../lib/tags/canonicalTags';

interface UseTagStandardizationReturn {
    dictionary: CanonicalTag[];
    isLoading: boolean;
    normalize: (rawTags: string[]) => {
        standardized: string[];
        novel: string[];
        results: NormalizationResult[];
    };
}

export function useTagStandardization(): UseTagStandardizationReturn {
    const [dictionary, setDictionary] = useState<CanonicalTag[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load the canonical dictionary once on mount
    useEffect(() => {
        const load = async () => {
            try {
                const { data, error } = await supabase
                    .from('canonical_tags')
                    .select('id, tag_name, aliases');
                if (error) throw error;
                setDictionary((data as CanonicalTag[]) || []);
            } catch (err) {
                console.error('[useTagStandardization] Dictionary load failed:', err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const normalize = useCallback((rawTags: string[]) => {
        return normalizeTags(rawTags, dictionary);
    }, [dictionary]);

    return { dictionary, isLoading, normalize };
}
