// =============================================================================
// Utility: Chat Sentiment Analyzer (VADER-lite, -1.0 to 1.0)
// Issue: #4838 - Automated "Profanity/Harassment" Chat Sentiment Shadowbanning
// A minimal lexicon-based scorer for detecting persistent low-level negativity
// ("this sucks", "boring", "I hate this") that evades binary toxicity filters.
// =============================================================================

const LEXICON: Record<string, number> = {
  good: 0.4, great: 0.6, love: 0.6, amazing: 0.7, awesome: 0.7, fun: 0.5,
  nice: 0.3, cool: 0.3, excited: 0.5, happy: 0.5, thanks: 0.3, lit: 0.5,

  sucks: -0.7, hate: -0.7, boring: -0.6, bored: -0.5, bad: -0.4, terrible: -0.8,
  awful: -0.8, worst: -0.8, lame: -0.5, trash: -0.6, dumb: -0.5, stupid: -0.6,
  annoying: -0.5, waste: -0.5, disappointed: -0.5, mid: -0.3, meh: -0.3,
  ugh: -0.4, whatever: -0.2,
};

const NEGATORS = new Set(["not", "no", "never", "isn't", "wasn't", "don't"]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Scores a single chat message from -1.0 (extremely negative) to 1.0
 * (extremely positive). A simple negation check flips adjacent word polarity.
 */
export function scoreMessageSentiment(text: string): number {
  if (!text || !text.trim()) return 0;

  const tokens = tokenize(text);
  if (tokens.length === 0) return 0;

  let total = 0;
  let matched = 0;

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const base = LEXICON[word];
    if (base === undefined) continue;

    const precededByNegator = i > 0 && NEGATORS.has(tokens[i - 1]);
    total += precededByNegator ? -base : base;
    matched++;
  }

  if (matched === 0) return 0;

  const average = total / matched;
  return Math.max(-1, Math.min(1, Math.round(average * 100) / 100));
}

/**
 * Rolling average sentiment over a user's most recent messages.
 */
export function calculateRollingSentiment(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}