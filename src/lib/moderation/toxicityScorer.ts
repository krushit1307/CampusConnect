// =============================================================================
// Utility: Client-Side Toxicity Scorer (Instant Feedback)
//  Issue: #3547 - Build an 'Interactive Real-Time Q&A Profanity/Troll Filter'
//  Description: A lightweight, client-side regex and profanity wordlist checker.
//  Provides instant UI feedback (disabling the submit button) before the 
//  message is even sent to the server, reducing server load and API costs.
// =============================================================================

// A subset of highly offensive terms for client-side pre-filtering
const PROFANITY_LIST = [
    'fuck', 'shit', 'cunt', 'nigger', 'faggot', 'bitch', 'asshole',
    'dickhead', 'motherfucker', 'cock', 'pussy', 'retard', 'tranny'
];

// Regex patterns for bypass attempts (e.g., f*ck, sh!t, f.u.c.k)
const BYPASS_PATTERNS = [
    /\b[f][\W_]*[u][\W_]*[c][\W_]*[k]\b/i,
    /\b[s][\W_]*[h][\W_]*[i][\W_]*[t]\b/i,
    /\b[n][\W_]*[i][\W_]*[g][\W_]*[g][\W_]*[e][\W_]*[r]\b/i,
    /\b[f][\W_]*[a][\W_]*[g][\W_]*[g][\W_]*[o][\W_]*[t]\b/i
];

export interface ToxicityResult {
    score: number; // 0.0 to 1.0
    isToxic: boolean;
    matchedWords: string[];
}

/**
 * Analyzes text for profanity and toxic patterns on the client side.
 * This is a fast, synchronous check to provide immediate UI feedback.
 * 
 * @param text - The user's input text
 * @returns ToxicityResult with a calculated score and matched words
 */
export function analyzeClientToxicity(text: string): ToxicityResult {
    if (!text || text.trim().length === 0) {
        return { score: 0, isToxic: false, matchedWords: [] };
    }

    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    const matchedWords: string[] = [];
    let toxicityHits = 0;

    // 1. Check against exact profanity list
    for (const word of words) {
        // Strip punctuation from the word for matching
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        if (PROFANITY_LIST.includes(cleanWord)) {
            matchedWords.push(cleanWord);
            toxicityHits++;
        }
    }

    // 2. Check against bypass patterns
    for (const pattern of BYPASS_PATTERNS) {
        if (pattern.test(text)) {
            toxicityHits += 2; // Bypass attempts are weighted heavier
            matchedWords.push('bypass_attempt');
        }
    }

    // 3. Check for excessive caps or punctuation (shouting/trolling indicators)
    const capsRatio = (text.replace(/[^A-Z]/g, "").length) / text.length;
    const punctuationRatio = (text.replace(/[a-zA-Z0-9\s]/g, "").length) / text.length;

    if (capsRatio > 0.7 && text.length > 10) toxicityHits += 0.5;
    if (punctuationRatio > 0.4) toxicityHits += 0.5;

    // Calculate final score (normalized to 0.0 - 1.0)
    // 3 hits = 1.0 (highly toxic)
    const score = Math.min(1.0, toxicityHits / 3);

    return {
        score,
        isToxic: score >= 0.8,
        matchedWords: Array.from(new Set(matchedWords))
    };
}
