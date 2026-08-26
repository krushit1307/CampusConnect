// =============================================================================
// Shared Utility: Contextual AI Analyzer
// Issue: #4419 - Implement 'Automated "Profanity/Harassment" Contextual AI'
//
// When the basic NLP filter flags a message for 'Violence' (e.g., "killed"),
// this module routes the message to a lightweight LLM for semantic context
// analysis BEFORE issuing a ban. The LLM determines whether the flagged text
// is a literal threat of violence or harmless slang/exaggeration.
//
// Architecture:
//   1. Basic NLP filter flags message (existing pipeline)
//   2. Route flagged message here for contextual LLM analysis
//   3. LLM classifies: THREAT (literal violence) vs SLANG (harmless exaggeration)
//   4. If SLANG -> silently drop the flag, allow the message
//   5. If THREAT -> proceed with ban and admin alert
// =============================================================================

/**
 * Result of contextual AI analysis.
 * - isThreat: true if the LLM determined this is a literal threat
 * - confidence: LLM confidence score (0-1)
 * - reasoning: brief explanation from the LLM
 */
export interface ContextualAnalysisResult {
  isThreat: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * Violence-flagging keywords that trigger contextual analysis.
 * These are terms that may be flagged as "Violence" by the basic NLP filter
 * but are commonly used as slang/exaggeration in casual conversation.
 */
const CONTEXTUAL_KEYWORDS = [
  "kill",
  "killed",
  "killing",
  "dead",
  "die",
  "died",
  "murder",
  "destroy",
  "destroyed",
  "crush",
  "crushed",
  "slay",
  "slayed",
  "stab",
  "stabbed",
  "shoot",
  "shot",
  "beat",
  "beaten",
  "attack",
  "attacked",
  "threat",
  "bomb",
  "blow",
  "hang",
  "hanged",
  "torture",
  "rape",
  "raped",
  "suicide",
  "explode",
  "skin",
  "rip",
  "wreck",
  "annihilate",
  "obliterate",
  "punish",
  "eliminate",
  "suffer",
  "bleed",
  "choke",
  "punch",
  "slap",
  "smash",
  "strangle",
  "assassinate",
  "lynch",
  "burn",
  "arson",
  "poison",
];

/**
 * Check if a flagged message contains violence-related keywords that
 * warrant contextual LLM analysis before banning.
 */
export function requiresContextualAnalysis(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  return CONTEXTUAL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Analyze flagged content using a lightweight LLM to determine if the
 * message is a literal threat of violence or harmless slang/exaggeration.
 *
 * Uses OpenAI Chat Completions API with a fast model (gpt-4o-mini) for
 * low-latency classification. The prompt is structured for binary output
 * to minimize token usage and maximize speed.
 *
 * @param content - The flagged message content
 * @param openaiApiKey - OpenAI API key
 * @param flagReason - The reason the basic NLP filter flagged this message
 * @returns ContextualAnalysisResult with threat classification
 */
export async function analyzeContextually(
  content: string,
  openaiApiKey: string,
  flagReason: string = "violence",
): Promise<ContextualAnalysisResult> {
  const systemPrompt = `You are a content moderation AI that determines whether flagged text is a LITERAL THREAT of violence or harmless SLANG/EXAGGERATION.

Your ONLY job: Answer YES (Threat) or NO (Slang) for whether the text is a real, actionable threat.

SLANG / NOT THREATS (answer NO):
- "This exam killed me" (exaggeration about difficulty)
- "I'm dead" / "I'm dead" (gen-z slang for laughing hard)
- "That concert was murder" / "that set was killer" (praise)
- "Let's destroy them in the game" / "we're gonna crush it" (competitive/gaming)
- "I'll beat you at this" / "beat that level" (friendly competition)
- "The test was a massacre" / "this homework is brutal" (exaggeration)
- "I'm going to die of laughter" / "dying inside" (hyperbole)
- "She slayed that performance" / "he killed it" (compliment)
- "This food is to die for" / "the gym killed me" (idiom/exaggeration)
- "I'm so hungry I could eat a horse" (idiom)
- "That was savage" / "total destruction on the court" (compliment/sports)
- "The traffic is killing me" / "this heat is murder" (complaint)
- "RIP my inbox" / "RIP my GPA" (humorous exaggeration)
- "I'm gonna bomb this exam" (slang for doing poorly, NOT a literal bomb)
- "She's a beast at math" / "he's a killer player" (compliment)

REAL THREATS (answer YES):
- "I'm going to kill you tonight" (direct, personal, actionable)
- "You're dead, I know where you live" (specific threat with intent)
- "I'll shoot you on sight" (direct weapon threat)
- "I'm going to bomb the building" (specific target, actionable)
- "You deserve to be murdered" (incitement)
- "I'll find you and hurt you" (stalking + violence)
- "Watch your back, I'm coming for you" (direct threat)

RULES:
1. Consider context, tone, and common usage - NOT just individual words
2. Slang, idioms, hyperbole, gaming language, sports, and pop culture are NOT threats
3. Specific, directed, personal threats WITH actionable intent ARE threats
4. When in doubt, classify as NOT a threat (allow the message)
5. Vague/ambiguous = NOT a threat (err on the side of allowing)

Respond with EXACTLY this format (no other text):
VERDICT: YES or NO
CONFIDENCE: 0.0 to 1.0
REASON: <one sentence explaining your verdict>`;

  const userPrompt = `Analyze this flagged text: "${content}"
The basic moderation filter flagged this for: ${flagReason}

Is this a literal threat of violence, or harmless slang/exaggeration?`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error(`[ContextualAI] LLM API error: ${response.status}`);
      return { isThreat: true, confidence: 0.5, reasoning: "LLM API error - defaulting to threat" };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return parseContextualAnalysis(text);
  } catch (error: any) {
    console.error("[ContextualAI] Analysis error:", error);
    return { isThreat: true, confidence: 0.5, reasoning: "Analysis error - defaulting to threat" };
  }
}

/**
 * Parse the LLM response into a structured ContextualAnalysisResult.
 * Expects format: VERDICT: YES/NO, CONFIDENCE: 0.0-1.0, REASON: ...
 */
function parseContextualAnalysis(responseText: string): ContextualAnalysisResult {
  const lines = responseText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let isThreat = true;
  let confidence = 0.5;
  let reasoning = "Could not parse LLM response";

  for (const line of lines) {
    const upper = line.toUpperCase();

    if (upper.startsWith("VERDICT:")) {
      const value = line
        .substring(line.indexOf(":") + 1)
        .trim()
        .toUpperCase();
      isThreat = value === "YES";
    } else if (upper.startsWith("CONFIDENCE:")) {
      const value = line.substring(line.indexOf(":") + 1).trim();
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        confidence = Math.max(0, Math.min(1, parsed));
      }
    } else if (upper.startsWith("REASON:")) {
      reasoning = line.substring(line.indexOf(":") + 1).trim();
    }
  }

  return { isThreat, confidence, reasoning };
}

/**
 * Log the contextual analysis result to the database for audit purposes.
 */
export async function logContextualAnalysis(
  supabaseAdmin: any,
  params: {
    message_id: string;
    user_id: string;
    source_table: string;
    original_flag_reason: string;
    is_threat: boolean;
    confidence: number;
    reasoning: string;
    original_content: string;
  },
): Promise<void> {
  try {
    await supabaseAdmin.from("contextual_moderation_audit").insert({
      message_id: params.message_id,
      user_id: params.user_id,
      source_table: params.source_table,
      original_flag_reason: params.original_flag_reason,
      llm_is_threat: params.is_threat,
      llm_confidence: params.confidence,
      llm_reasoning: params.reasoning,
      original_content: params.original_content,
      reviewed: false,
    });
  } catch (error: any) {
    console.error("[ContextualAI] Failed to log audit:", error);
  }
}
