// =============================================================================
// Utility: Client-Side Tone Analyzer (Instant Feedback)
// Issue: #3557 - Implement 'Automated Event Description "Tone" Analyzer'
// Description: Provides instant, client-side feedback on text formality while
// the user is typing, before they even click "Save Draft". Reduces server
// load by catching obvious violations locally.
// =============================================================================

const SLANG_DICTIONARY = [
    'fam', 'bruh', 'lit', 'bet', 'cap', 'bussin', 'sus', 'vibes', 'pull up',
    'lowkey', 'highkey', 'sheesh', 'finna', 'yeet', 'slaps', 'drip', 'goat'
];

export interface ToneAnalysisResult {
    score: number;
    warnings: string[];
    requiresReview: boolean;
}

/**
 * Analyzes text for informal tone on the client side.
 * This is a fast, synchronous check to provide immediate UI feedback.
 * 
 * @param text - The event description text
 * @returns ToneAnalysisResult with score and warnings
 */
export function analyzeClientTone(text: string): ToneAnalysisResult {
    if (!text || text.trim().length === 0) {
        return { score: 100, warnings: [], requiresReview: false };
    }

    const lowerText = text.toLowerCase();
    const warnings: string[] = [];
    let penaltyScore = 0;

    // 1. Check for slang
    const foundSlang = SLANG_DICTIONARY.filter(slang => {
        const regex = new RegExp(`\\b${slang}\\b`, 'i');
        return regex.test(lowerText);
    });

    if (foundSlang.length > 0) {
        warnings.push(`Slang detected: "${foundSlang.join('", "')}"`);
        penaltyScore += foundSlang.length * 15;
    }

    // 2. Check for excessive exclamation points
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 2) {
        warnings.push(`Too many exclamation points (${exclamationCount})`);
        penaltyScore += (exclamationCount - 2) * 5;
    }

    // 3. Check for high emoji density
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojiMatches = text.match(emojiRegex) || [];

    if (emojiMatches.length > 3) {
        warnings.push(`High emoji count (${emojiMatches.length})`);
        penaltyScore += emojiMatches.length * 10;
    }

    const score = Math.max(0, 100 - penaltyScore);

    return {
        score,
        warnings,
        requiresReview: score < 70
    };
}
