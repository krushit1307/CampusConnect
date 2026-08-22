export interface NoShowStrikeRecord {
  id: string;
  userId: string;
  eventId: string;
  createdAt: string; // ISO String
}

export interface UserPenaltyProfile {
  userId: string;
  email: string;
  gamificationPoints: number;
  rsvpStatus: "active" | "restricted_rsvp";
  rsvpRestrictedUntil?: string;
}

export interface PenaltyEvaluationResult {
  userId: string;
  strikeCountInWindow: number;
  isPenaltyTriggered: boolean;
  deductedPoints: number;
  newGamificationPoints: number;
  newRsvpStatus: "active" | "restricted_rsvp";
  restrictedUntil?: string;
  warningEmailPayload?: {
    toEmail: string;
    subject: string;
    bodyHtml: string;
  };
}

export const ROLLING_WINDOW_DAYS = 90;
export const STRIKE_THRESHOLD = 3;
export const PENALTY_DURATION_DAYS = 14;
export const POINT_DEDUCTION = 500;

/**
 * Calculates strikes within a rolling 90-day window.
 */
export function countStrikesInRollingWindow(
  strikes: NoShowStrikeRecord[],
  userId: string,
  nowMs: number = Date.now(),
): number {
  const windowStartMs = nowMs - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return strikes.filter((s) => {
    if (s.userId !== userId) return false;
    const strikeTimeMs = new Date(s.createdAt).getTime();
    return strikeTimeMs >= windowStartMs && strikeTimeMs <= nowMs;
  }).length;
}

/**
 * Evaluates strike threshold and applies automated 500 point deduction and 14-day RSVP restriction.
 */
export function evaluateNoShowPenalty(
  profile: UserPenaltyProfile,
  userStrikes: NoShowStrikeRecord[],
  nowMs: number = Date.now(),
): PenaltyEvaluationResult {
  const strikeCountInWindow = countStrikesInRollingWindow(userStrikes, profile.userId, nowMs);

  if (strikeCountInWindow >= STRIKE_THRESHOLD) {
    const restrictedUntilMs = nowMs + PENALTY_DURATION_DAYS * 24 * 60 * 60 * 1000;
    const restrictedUntilIso = new Date(restrictedUntilMs).toISOString();
    const newGamificationPoints = Math.max(0, profile.gamificationPoints - POINT_DEDUCTION);

    const subject = "RSVP Privileges Temporarily Restricted - Action Required";
    const bodyHtml = `
      <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
        <h2>RSVP Privileges Paused</h2>
        <p>You have missed <strong>3 events</strong> you reserved seats for within the past 90 days.</p>
        <p>To protect event accessibility for other students, your ability to RSVP to exclusive events is paused for <strong>14 days</strong> (until ${new Date(
          restrictedUntilIso,
        ).toLocaleDateString()}).</p>
        <p>500 Gamification points have been deducted from your account.</p>
      </div>
    `.trim();

    return {
      userId: profile.userId,
      strikeCountInWindow,
      isPenaltyTriggered: true,
      deductedPoints: POINT_DEDUCTION,
      newGamificationPoints,
      newRsvpStatus: "restricted_rsvp",
      restrictedUntil: restrictedUntilIso,
      warningEmailPayload: {
        toEmail: profile.email,
        subject,
        bodyHtml,
      },
    };
  }

  return {
    userId: profile.userId,
    strikeCountInWindow,
    isPenaltyTriggered: false,
    deductedPoints: 0,
    newGamificationPoints: profile.gamificationPoints,
    newRsvpStatus: profile.rsvpStatus,
    restrictedUntil: profile.rsvpRestrictedUntil,
  };
}

/**
 * Automatically lifts expired restrictions after 14 days and resets account status.
 */
export function checkAndLiftExpiredRestrictions(
  profile: UserPenaltyProfile,
  nowMs: number = Date.now(),
): UserPenaltyProfile {
  if (
    profile.rsvpStatus === "restricted_rsvp" &&
    profile.rsvpRestrictedUntil &&
    new Date(profile.rsvpRestrictedUntil).getTime() <= nowMs
  ) {
    return {
      ...profile,
      rsvpStatus: "active",
      rsvpRestrictedUntil: undefined,
    };
  }

  return profile;
}
