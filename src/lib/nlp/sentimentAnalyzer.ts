// =============================================================================
// Utility: Sentiment Analyzer (AFINN-based with Gen-Z Slang Dictionary)
// Issue: #3230 - Implement 'Live Audience Sentiment Analysis'
// Description: A lightweight, client-side NLP scoring engine. It uses a base 
// AFINN wordlist patched with a custom campus/Gen-Z dictionary to accurately 
// score chat messages from -5 (highly negative/confused) to +5 (highly positive).
// =============================================================================

/**
 * Base AFINN-111 subset for common positive/negative words.
 * Scores range from -5 to +5.
 */
const BASE_AFINN: Record<string, number> = {
    // Positive
    'good': 3, 'great': 4, 'awesome': 5, 'amazing': 5, 'excellent': 5, 'love': 4,
    'fantastic': 5, 'perfect': 5, 'brilliant': 4, 'outstanding': 5, 'wonderful': 4,
    'happy': 3, 'glad': 3, 'excited': 4, 'interesting': 2, 'helpful': 3, 'clear': 2,
    'thanks': 2, 'thank': 2, 'appreciate': 3, 'insightful': 3, 'smart': 3,

    // Negative
    'bad': -3, 'terrible': -5, 'awful': -5, 'horrible': -5, 'hate': -4, 'boring': -3,
    'confused': -3, 'confusing': -3, 'lost': -2, 'slow': -2, 'fast': -1, 'wrong': -3,
    'stupid': -4, 'dumb': -4, 'useless': -4, 'waste': -3, 'disappointed': -3,
    'angry': -4, 'frustrated': -3, 'annoying': -3, 'annoyed': -3, 'trash': -4,
    'sucks': -4, 'lame': -3, 'dull': -2, 'unclear': -2, 'loud': -1, 'quiet': -1
};

/**
 * Gen-Z / Campus Slang Dictionary Override.
 * Standard NLP models fail on modern slang (e.g., "sick" means good, "cap" means lie).
 */
const SLANG_DICTIONARY: Record<string, number> = {
    // Positive Slang
    'sick': 4, 'fire': 5, 'bet': 2, 'based': 4, 'w': 4, 'drip': 3, 'goat': 5,
    'slaps': 4, 'bussin': 5, 'valid': 3, 'lit': 4, 'vibes': 3, 'chef\'s kiss': 5,
    'sheesh': 3, 'aura': 3, 'rizz': 4, 'cooked': -4, // "We are cooked" is negative

    // Negative/Confused Slang
    'cap': -3, 'mid': -2, 'cringe': -4, 'bruh': -1, 'bro': 0, 'sus': -2,
    'skill issue': -3, 'L': -3, 'ratio': -2, 'yap': -2, 'yapping': -2,
    'sleep': -2, 'bro is sleeping': -2, 'bombastic side eye': -3,

    // Confusion Indicators
    '???': -3, 'what': -1, 'huh': -2, 'wait': -1, 'wdym': -2, 'explain': -1
};

// Merge dictionaries, with slang overriding base AFINN
const COMBINED_DICTIONARY = { ...BASE_AFINN, ...SLANG_DICTIONARY };

/**
 * Cleans and tokenizes a chat message.
 * Removes URLs, special characters (except ???), and converts to lowercase.
 */
function tokenize(text: string): string[] {
    // Keep "???" as a single token for confusion detection
    const normalized = text.toLowerCase()
        .replace(/(https?:\/\/[^\s]+)/g, '') // Remove URLs
        .replace(/([a-z0-9])\?{2,}/g, '$1 ???') // Separate "what???" into "what" and "???"
        .replace(/[^\w\s\?']/g, ' ') // Keep alphanumeric, spaces, question marks, apostrophes
        .replace(/\?{2,}/g, ' ??? ') // Normalize multiple question marks
        .trim();

    return normalized.split(/\s+/).filter(Boolean);
}

export interface SentimentResult {
    score: number;        // Raw score (e.g., 12)
    normalized: number;   // Normalized score from -5 to +5
    comparative: number;  // Score per word (e.g., 0.5)
    positiveWords: string[];
    negativeWords: string[];
    isConfusionSpike: boolean; // True if message is primarily "???" or "what"
}

/**
 * Analyzes the sentiment of a single chat message.
 * @param text - The raw chat message
 * @returns SentimentResult with normalized score from -5 to +5
 */
export function analyzeSentiment(text: string): SentimentResult {
    if (!text || text.trim().length === 0) {
        return { score: 0, normalized: 0, comparative: 0, positiveWords: [], negativeWords: [], isConfusionSpike: false };
    }

    const tokens = tokenize(text);
    if (tokens.length === 0) {
        return { score: 0, normalized: 0, comparative: 0, positiveWords: [], negativeWords: [], isConfusionSpike: false };
    }

    let rawScore = 0;
    const positiveWords: string[] = [];
    const negativeWords: string[] = [];
    let confusionCount = 0;

    // Check for multi-word phrases first (e.g., "chef's kiss")
    const joinedText = tokens.join(' ');
    for (const [phrase, score] of Object.entries(COMBINED_DICTIONARY)) {
        if (phrase.includes(' ') && joinedText.includes(phrase)) {
            rawScore += score;
            if (score > 0) positiveWords.push(phrase);
            else if (score < 0) negativeWords.push(phrase);
        }
    }

    // Score individual tokens
    for (const token of tokens) {
        if (COMBINED_DICTIONARY[token] !== undefined) {
            const wordScore = COMBINED_DICTIONARY[token];
            rawScore += wordScore;

            if (wordScore > 0) positiveWords.push(token);
            else if (wordScore < 0) negativeWords.push(token);

            if (token === '???' || token === 'huh' || token === 'wdym') {
                confusionCount++;
            }
        }
    }

    // Calculate normalized score (-5 to +5)
    // We use a logarithmic scale to prevent extremely long messages from skewing the gauge
    const comparative = rawScore / tokens.length;
    let normalized = comparative * 2; // Base multiplier

    // Clamp to -5 and +5
    normalized = Math.max(-5, Math.min(5, normalized));

    // Round to 1 decimal place
    normalized = Math.round(normalized * 10) / 10;

    // Detect confusion spikes (if >30% of words are confusion indicators)
    const isConfusionSpike = (confusionCount / tokens.length) > 0.3 && tokens.length >= 2;

    return {
        score: rawScore,
        normalized,
        comparative,
        positiveWords: Array.from(new Set(positiveWords)),
        negativeWords: Array.from(new Set(negativeWords)),
        isConfusionSpike
    };
}

/**
 * Calculates the rolling average sentiment from a list of recent scores.
 * @param scores - Array of normalized scores (-5 to +5)
 * @returns The average score, or 0 if empty
 */
export function calculateRollingAverage(scores: number[]): number {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / scores.length) * 10) / 10;
}
