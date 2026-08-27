export interface AiEventGeneratorInput {
  title: string;
  keywords: string[];
  tone?: "hype" | "professional" | "casual";
  userId: string;
}

export interface AiGeneratorRateLimitState {
  userId: string;
  count: number;
  resetTime: number; // Unix timestamp
}

export const MAX_GENERATIONS_PER_DAY = 5;
const RATE_LIMIT_STORE = new Map<string, AiGeneratorRateLimitState>();

/**
 * Sanitizes keywords to protect against prompt injection attacks.
 */
export function sanitizeKeywords(keywords: string[]): string[] {
  return keywords
    .map((k) => k.replace(/[<>{}[\]\\]/g, "").trim())
    .filter((k) => k.length > 0 && k.length <= 50);
}

/**
 * Enforces strict per-user rate limit (5 generations per day).
 */
export function checkAiRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const userRecord = RATE_LIMIT_STORE.get(userId);

  if (!userRecord || now >= userRecord.resetTime) {
    RATE_LIMIT_STORE.set(userId, {
      userId,
      count: 1,
      resetTime: now + oneDayMs,
    });
    return { allowed: true, remaining: MAX_GENERATIONS_PER_DAY - 1 };
  }

  if (userRecord.count >= MAX_GENERATIONS_PER_DAY) {
    return { allowed: false, remaining: 0 };
  }

  userRecord.count += 1;
  return { allowed: true, remaining: MAX_GENERATIONS_PER_DAY - userRecord.count };
}

/**
 * Constructs system and user prompts for event description generation.
 */
export function buildEventDescriptionPrompt(input: AiEventGeneratorInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const safeKeywords = sanitizeKeywords(input.keywords);
  const tone = input.tone || "hype";

  const systemPrompt =
    "You are a college event promoter. Write a fun, engaging, 3-paragraph event description based on the provided keywords. Use markdown formatting.";

  const userPrompt = `Event Title: ${input.title}\nTone: ${tone}\nKeywords: ${safeKeywords.join(
    ", ",
  )}`;

  return { systemPrompt, userPrompt };
}
