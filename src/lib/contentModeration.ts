export interface ModerationScores {
  adult: number; // Scale 0.0 - 1.0
  violence: number; // Scale 0.0 - 1.0
  racy: number; // Scale 0.0 - 1.0
}

export interface ModerationResult {
  isFlagged: boolean;
  moderatedStatus: "APPROVED" | "FLAGGED";
  reason?: string;
  scores: ModerationScores;
}

export const MODERATION_THRESHOLDS = {
  ADULT: 0.7,
  VIOLENCE: 0.8,
  RACY: 0.85,
} as const;

/**
 * Analyzes image content moderation scores against safety thresholds.
 */
export function evaluateImageSafety(scores: ModerationScores): ModerationResult {
  const flags: string[] = [];

  if (scores.adult >= MODERATION_THRESHOLDS.ADULT) {
    flags.push(`Adult content threshold exceeded (${scores.adult})`);
  }
  if (scores.violence >= MODERATION_THRESHOLDS.VIOLENCE) {
    flags.push(`Violence threshold exceeded (${scores.violence})`);
  }
  if (scores.racy >= MODERATION_THRESHOLDS.RACY) {
    flags.push(`Racy content threshold exceeded (${scores.racy})`);
  }

  const isFlagged = flags.length > 0;

  return {
    isFlagged,
    moderatedStatus: isFlagged ? "FLAGGED" : "APPROVED",
    reason: isFlagged ? flags.join("; ") : undefined,
    scores,
  };
}
