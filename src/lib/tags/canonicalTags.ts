// =============================================================================
// Utility: Canonical Tag Fuzzy Matcher
// Issue: #3711 - Implement 'Automated "Event Tag" Standardization'
// Description: Uses Fuse.js to fuzzy-match a free-text tag against the canonical
// dictionary + aliases. Returns the standardized tag above a confidence
// threshold, or flags it as novel for admin review.
// =============================================================================

import Fuse from 'fuse.js';

export interface CanonicalTag {
    id: string;
    tag_name: string;
    aliases: string[];
}

export interface NormalizationResult {
    input: string;
    canonical: string | null;   // standardized tag, if matched
    confidence: number;         // 0..1 (1 = exact)
    isNovel: boolean;           // no good match -> needs admin review
}

/** Confidence above which we silently replace the user's tag. */
export const MATCH_THRESHOLD = 0.8;

// Flatten the dictionary into searchable documents (one per tag + its aliases)
function buildDocuments(tags: CanonicalTag[]): { label: string; canonical: string }[] {
    const docs: { label: string; canonical: string }[] = [];
    for (const tag of tags) {
        docs.push({ label: tag.tag_name.toLowerCase(), canonical: tag.tag_name });
        for (const alias of tag.aliases) {
            docs.push({ label: alias.toLowerCase(), canonical: tag.tag_name });
        }
    }
    return docs;
}

/**
 * Normalizes a single raw tag. Returns the canonical tag when fuzzy confidence
 * exceeds the threshold, otherwise marks it novel.
 */
export function normalizeTag(raw: string, dictionary: CanonicalTag[]): NormalizationResult {
    const input = raw.trim();
    const lower = input.toLowerCase();

    // Fast-path exact alias lookup (confidence = 1)
    const docs = buildDocuments(dictionary);
    const exact = docs.find(d => d.label === lower);
    if (exact) {
        return { input, canonical: exact.canonical, confidence: 1, isNovel: false };
    }

    // Fuzzy match with Fuse.js
    const fuse = new Fuse(docs, {
        keys: ['label'],
        includeScore: true,
        threshold: 0.4,      // permissive search; we gate on confidence below
        ignoreLocation: true,
    });

    const results = fuse.search(lower);
    if (results.length > 0) {
        const top = results[0];
        const confidence = 1 - (top.score ?? 1); // Fuse score is 0=perfect, 1=worst
        if (confidence >= MATCH_THRESHOLD) {
            return { input, canonical: top.item.canonical, confidence, isNovel: false };
        }
    }

    // No confident match -> novel tag
    return { input, canonical: null, confidence: 0, isNovel: true };
}

/** Normalizes an array of raw tags, deduping canonical results. */
export function normalizeTags(rawTags: string[], dictionary: CanonicalTag[]): {
    standardized: string[];
    novel: string[];
    results: NormalizationResult[];
} {
    const results = rawTags.map(t => normalizeTag(t, dictionary));
    const standardized = Array.from(
        new Set(results.filter(r => r.canonical).map(r => r.canonical as string))
    );
    const novel = Array.from(new Set(results.filter(r => r.isNovel).map(r => r.input)));
    return { standardized, novel, results };
}
