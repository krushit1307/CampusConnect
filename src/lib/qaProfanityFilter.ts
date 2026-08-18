import { createClient } from "./supabase/client";

export interface QaProfanityResult {
  isProfane: boolean;
  isShadowbanned: boolean;
  matchedTerms: string[];
  cleanedContent: string;
  latencyMs: number;
}

export interface QaQuestionSubmissionResult {
  success: boolean;
  questionId?: string;
  message: string;
  isShadowbanned: boolean;
}

// Banned term patterns compiled with word boundary (\b) to avoid Scunthorpe problem false positives
export const BANNED_TERMS = [
  "spam",
  "scam",
  "abuse",
  "toxic",
  "hate",
  "harass",
  "slur",
  "idiot",
  "stupid",
  "dummy",
  "fool",
];

/**
 * Senior Sub-50ms Profanity Analysis Engine:
 * Intercepts Q&A text submissions using fast local word-boundary regex tokenization.
 * Prevents the Scunthorpe problem (e.g. "classic", "assessment", "pass", "anatomy" are unaffected).
 * Respects custom event whitelist term overrides.
 */
export function analyzeQaProfanity(
  content: string,
  customWhitelist: string[] = [],
): QaProfanityResult {
  const startTime = performance.now();
  if (!content || !content.trim()) {
    return {
      isProfane: false,
      isShadowbanned: false,
      matchedTerms: [],
      cleanedContent: "",
      latencyMs: Number((performance.now() - startTime).toFixed(2)),
    };
  }

  // Normalize custom whitelist terms into a lowercase Set
  const whitelistSet = new Set(customWhitelist.map((w) => w.trim().toLowerCase()));

  const matchedTerms: string[] = [];
  let cleanedContent = content;

  for (const term of BANNED_TERMS) {
    if (whitelistSet.has(term.toLowerCase())) {
      continue; // Skip whitelisted terms
    }

    // Word boundary regex matching to avoid Scunthorpe problem (e.g., \bidiot\b)
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    if (regex.test(content)) {
      matchedTerms.push(term);
      cleanedContent = cleanedContent.replace(regex, "*".repeat(term.length));
    }
  }

  const isProfane = matchedTerms.length > 0;
  const endTime = performance.now();

  return {
    isProfane,
    isShadowbanned: isProfane, // Profane submissions are silently shadowbanned
    matchedTerms,
    cleanedContent,
    latencyMs: Number((endTime - startTime).toFixed(2)),
  };
}

/**
 * Submits a live Q&A question through the sub-50ms profanity filter pipeline.
 * Returns 200 OK success to submitter even when shadowbanned so trolls are not alerted.
 */
export async function submitQaQuestionWithFilter(
  eventId: string,
  userId: string,
  content: string,
  customWhitelist: string[] = [],
): Promise<QaQuestionSubmissionResult> {
  const filterResult = analyzeQaProfanity(content, customWhitelist);

  const supabase = createClient();
  const { data, error } = await supabase.rpc("submit_qa_question", {
    p_event_id: eventId,
    p_user_id: userId,
    p_content: content,
    p_is_shadowbanned: filterResult.isShadowbanned,
    p_flagged_reason: filterResult.isProfane
      ? `Flagged terms: ${filterResult.matchedTerms.join(", ")}`
      : null,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
      isShadowbanned: filterResult.isShadowbanned,
    };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? true,
    questionId: res?.question_id ?? undefined,
    message: res?.message ?? "Question submitted successfully.",
    isShadowbanned: res?.is_shadowbanned ?? filterResult.isShadowbanned,
  };
}
