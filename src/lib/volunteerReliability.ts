// src/lib/volunteerReliability.ts
// -----------------------------------------------------------------------------
// Issue #3751 — Dynamic Volunteer Shift Reliability Score & No-Show Risk Forecast
//
// Pure scoring helpers for volunteer shift reliability. Deliberately free of
// React and Supabase imports so the maths can be unit-tested in isolation and
// reused by the coordinator dashboard, the shift board and any future cron job
// that wants to nudge unreliable volunteers.
//
// The model in one paragraph: every completed shift assignment produces an
// outcome. Outcomes are credited on a 0..1 scale (showing up = full credit,
// arriving late = partial, ghosting = none) and weighted by an exponential
// time decay so that recent behaviour dominates. The weighted credit ratio is
// then shrunk toward a neutral prior, which stops a volunteer with a single
// data point from being branded either perfect or worthless.
// -----------------------------------------------------------------------------

/**
 * What actually happened for a given (shift, volunteer) pair.
 *
 * `cancelled_in_time` and `excused` are deliberately *not* failures. A
 * volunteer who withdraws with enough notice for the slot to be re-filled has
 * behaved well, and a volunteer excused by a coordinator (illness, exam clash)
 * should not be punished for it. Both are excluded from the ratio entirely
 * rather than being scored as a pass, because counting them as attendance
 * would let someone farm a perfect score by claiming and cancelling shifts.
 */
export type ShiftOutcome = "attended" | "late" | "no_show" | "excused" | "cancelled_in_time";

export interface ShiftAttendanceRecord {
  id: string;
  shift_id: string;
  user_id: string;
  outcome: ShiftOutcome;
  /** ISO timestamp of the shift this outcome belongs to. Drives the decay. */
  shift_start: string;
  recorded_at: string;
  notes?: string | null;
}

export interface ReliabilityConfig {
  /** Days after which an outcome carries half its original weight. */
  halfLifeDays: number;
  /**
   * Strength of the neutral prior, expressed in "virtual shifts". A value of 3
   * means a brand-new volunteer is treated as though they already had three
   * shifts at the prior score, so one bad night cannot flatten them to zero.
   */
  priorWeight: number;
  /** The score assigned to a volunteer with no history at all. */
  priorScore: number;
  /** Credit awarded for turning up late but turning up. */
  lateCredit: number;
  /** Outcomes older than this are ignored outright, however small their weight. */
  maxAgeDays: number;
}

export const DEFAULT_RELIABILITY_CONFIG: ReliabilityConfig = {
  halfLifeDays: 60,
  priorWeight: 3,
  priorScore: 0.8,
  lateCredit: 0.6,
  maxAgeDays: 540,
};

/**
 * Reliability bands. These are the only thing coordinators should ever see in
 * bulk — a raw decimal invites arguing about the third significant figure.
 */
export type ReliabilityBand = "exemplary" | "reliable" | "watch" | "at_risk";

export const BAND_THRESHOLDS: Array<{ band: ReliabilityBand; min: number }> = [
  { band: "exemplary", min: 0.9 },
  { band: "reliable", min: 0.75 },
  { band: "watch", min: 0.55 },
  { band: "at_risk", min: 0 },
];

export interface ReliabilityProfile {
  userId: string;
  /** Shrunk, decayed score in the range 0..1. */
  score: number;
  band: ReliabilityBand;
  /** Sum of decay weights across all counted outcomes. */
  weightedTotal: number;
  /** Sum of (decay weight × credit) across all counted outcomes. */
  weightedCredit: number;
  /** Raw counts, useful for "3 no-shows in the last year" style copy. */
  counts: Record<ShiftOutcome, number>;
  /** Number of outcomes that actually counted toward the ratio. */
  countedOutcomes: number;
  /** Consecutive no-shows ending at the most recent counted outcome. */
  currentNoShowStreak: number;
  /** Consecutive attended (or late) shifts ending at the most recent outcome. */
  currentAttendedStreak: number;
  /** True when the profile is dominated by the prior rather than real data. */
  isProvisional: boolean;
  lastOutcomeAt: string | null;
}

const EMPTY_COUNTS: Record<ShiftOutcome, number> = {
  attended: 0,
  late: 0,
  no_show: 0,
  excused: 0,
  cancelled_in_time: 0,
};

/**
 * Credit for an outcome, or `null` when the outcome should be excluded from
 * the ratio entirely (neither reward nor punishment).
 */
export function outcomeCredit(
  outcome: ShiftOutcome,
  config: ReliabilityConfig = DEFAULT_RELIABILITY_CONFIG,
): number | null {
  switch (outcome) {
    case "attended":
      return 1;
    case "late":
      return config.lateCredit;
    case "no_show":
      return 0;
    case "excused":
    case "cancelled_in_time":
      return null;
    default:
      return null;
  }
}

const MS_PER_DAY = 86_400_000;

/**
 * Exponential decay weight for an outcome that happened `ageDays` ago.
 * Future-dated shifts (clock skew, or a record written early) are clamped to
 * full weight rather than being given a weight above 1.
 */
export function decayWeight(ageDays: number, halfLifeDays: number): number {
  if (!Number.isFinite(ageDays) || ageDays <= 0) return 1;
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export function ageInDays(isoTimestamp: string, now: Date): number {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then) / MS_PER_DAY;
}

export function bandForScore(score: number): ReliabilityBand {
  for (const { band, min } of BAND_THRESHOLDS) {
    if (score >= min) return band;
  }
  return "at_risk";
}

/**
 * Builds a reliability profile for one volunteer from their outcome history.
 *
 * Records belonging to other users are ignored rather than trusted, so a
 * caller can hand the whole event's history to this function per user without
 * pre-filtering and still get a correct answer.
 */
export function computeReliabilityProfile(
  userId: string,
  records: ShiftAttendanceRecord[],
  now: Date = new Date(),
  config: ReliabilityConfig = DEFAULT_RELIABILITY_CONFIG,
): ReliabilityProfile {
  const mine = records.filter((r) => r.user_id === userId);

  // Most recent first — streaks read naturally from this order.
  const sorted = [...mine].sort(
    (a, b) => new Date(b.shift_start).getTime() - new Date(a.shift_start).getTime(),
  );

  const counts: Record<ShiftOutcome, number> = { ...EMPTY_COUNTS };
  let weightedTotal = 0;
  let weightedCredit = 0;
  let countedOutcomes = 0;
  let lastOutcomeAt: string | null = null;

  for (const record of sorted) {
    const age = ageInDays(record.shift_start, now);
    if (age > config.maxAgeDays) continue;

    counts[record.outcome] = (counts[record.outcome] ?? 0) + 1;
    if (lastOutcomeAt === null) lastOutcomeAt = record.shift_start;

    const credit = outcomeCredit(record.outcome, config);
    if (credit === null) continue; // excused / cancelled in time

    const weight = decayWeight(age, config.halfLifeDays);
    weightedTotal += weight;
    weightedCredit += weight * credit;
    countedOutcomes += 1;
  }

  // Shrinkage toward the prior. With no counted outcomes this returns exactly
  // the prior score, which is the desired behaviour for a new volunteer.
  const score =
    (weightedCredit + config.priorWeight * config.priorScore) /
    (weightedTotal + config.priorWeight);

  const { noShowStreak, attendedStreak } = computeStreaks(sorted, config);

  return {
    userId,
    score: clamp01(score),
    band: bandForScore(clamp01(score)),
    weightedTotal,
    weightedCredit,
    counts,
    countedOutcomes,
    currentNoShowStreak: noShowStreak,
    currentAttendedStreak: attendedStreak,
    isProvisional: countedOutcomes < config.priorWeight,
    lastOutcomeAt,
  };
}

/**
 * Streaks skip over excluded outcomes rather than breaking on them: being
 * excused for one shift between two no-shows does not reset the no-show
 * streak, because nothing about the excused shift says the volunteer became
 * more dependable.
 */
function computeStreaks(
  newestFirst: ShiftAttendanceRecord[],
  config: ReliabilityConfig,
): { noShowStreak: number; attendedStreak: number } {
  let noShowStreak = 0;
  let attendedStreak = 0;
  let seenCounted = false;

  for (const record of newestFirst) {
    const credit = outcomeCredit(record.outcome, config);
    if (credit === null) continue;

    const isNoShow = record.outcome === "no_show";
    if (!seenCounted) {
      seenCounted = true;
      if (isNoShow) noShowStreak = 1;
      else attendedStreak = 1;
      continue;
    }

    if (isNoShow && attendedStreak === 0) noShowStreak += 1;
    else if (!isNoShow && noShowStreak === 0) attendedStreak += 1;
    else break;
  }

  return { noShowStreak, attendedStreak };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

// -----------------------------------------------------------------------------
// Per-shift staffing forecast
// -----------------------------------------------------------------------------

export interface ShiftAssignmentSummary {
  shiftId: string;
  shiftTitle: string;
  startTime: string;
  endTime: string;
  /** Bodies the shift actually needs. */
  capacity: number;
  /** Volunteers who have claimed the shift. */
  assigneeIds: string[];
}

export type StaffingRisk = "healthy" | "thin" | "at_risk" | "critical";

export interface ShiftForecast {
  shiftId: string;
  shiftTitle: string;
  startTime: string;
  endTime: string;
  capacity: number;
  signupCount: number;
  /** Sum of assignee reliability scores — the expected number of bodies. */
  expectedAttendance: number;
  /** capacity − expectedAttendance, floored at 0. */
  forecastGap: number;
  risk: StaffingRisk;
  /** How many extra volunteers to recruit to close the gap with margin. */
  recommendedBackups: number;
  /** Assignees in the two weakest bands, so coordinators know who to chase. */
  shakyAssigneeIds: string[];
}

/**
 * Fill ratio thresholds for the staffing risk bands. Expressed as
 * expectedAttendance / capacity.
 */
export const STAFFING_THRESHOLDS = {
  healthy: 1,
  thin: 0.85,
  atRisk: 0.6,
} as const;

export function staffingRiskFor(expectedAttendance: number, capacity: number): StaffingRisk {
  if (capacity <= 0) return "healthy";
  const ratio = expectedAttendance / capacity;
  if (ratio >= STAFFING_THRESHOLDS.healthy) return "healthy";
  if (ratio >= STAFFING_THRESHOLDS.thin) return "thin";
  if (ratio >= STAFFING_THRESHOLDS.atRisk) return "at_risk";
  return "critical";
}

/**
 * Forecasts attendance for a single shift.
 *
 * Expected attendance is the sum of assignees' reliability scores rather than
 * the raw signup count. Six signups averaging 0.55 forecasts 3.3 bodies, which
 * is the number a coordinator should be planning against.
 */
export function forecastShift(
  shift: ShiftAssignmentSummary,
  profiles: Map<string, ReliabilityProfile>,
  config: ReliabilityConfig = DEFAULT_RELIABILITY_CONFIG,
): ShiftForecast {
  let expectedAttendance = 0;
  const shakyAssigneeIds: string[] = [];

  for (const userId of shift.assigneeIds) {
    const profile = profiles.get(userId);
    const score = profile ? profile.score : config.priorScore;
    expectedAttendance += score;
    if (profile && (profile.band === "watch" || profile.band === "at_risk")) {
      shakyAssigneeIds.push(userId);
    }
  }

  const rounded = roundTo(expectedAttendance, 2);
  const forecastGap = roundTo(Math.max(0, shift.capacity - rounded), 2);
  const risk = staffingRiskFor(rounded, shift.capacity);

  return {
    shiftId: shift.shiftId,
    shiftTitle: shift.shiftTitle,
    startTime: shift.startTime,
    endTime: shift.endTime,
    capacity: shift.capacity,
    signupCount: shift.assigneeIds.length,
    expectedAttendance: rounded,
    forecastGap,
    risk,
    recommendedBackups: recommendBackups(forecastGap, config),
    shakyAssigneeIds,
  };
}

/**
 * Converts a fractional gap into a whole number of humans to recruit.
 *
 * Backups are themselves unreliable, so closing a gap of 2.0 by recruiting
 * exactly 2 people just reproduces the problem. We divide by the prior score
 * to account for the expected attendance of the backups we are about to
 * recruit, then round up.
 */
export function recommendBackups(
  forecastGap: number,
  config: ReliabilityConfig = DEFAULT_RELIABILITY_CONFIG,
): number {
  if (forecastGap <= 0) return 0;
  const expectedPerBackup = config.priorScore > 0 ? config.priorScore : 1;
  return Math.ceil(forecastGap / expectedPerBackup);
}

/**
 * Forecasts a whole event's shift board, sorted worst-first so the shift that
 * needs attention is at the top of the coordinator's screen.
 */
export function forecastShiftBoard(
  shifts: ShiftAssignmentSummary[],
  profiles: Map<string, ReliabilityProfile>,
  config: ReliabilityConfig = DEFAULT_RELIABILITY_CONFIG,
): ShiftForecast[] {
  const RISK_ORDER: Record<StaffingRisk, number> = {
    critical: 0,
    at_risk: 1,
    thin: 2,
    healthy: 3,
  };

  return shifts
    .map((shift) => forecastShift(shift, profiles, config))
    .sort((a, b) => {
      const byRisk = RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
      if (byRisk !== 0) return byRisk;
      // Within a band, the bigger absolute hole comes first.
      if (b.forecastGap !== a.forecastGap) return b.forecastGap - a.forecastGap;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// -----------------------------------------------------------------------------
// Presentation helpers
// -----------------------------------------------------------------------------

export function formatScorePercent(score: number): string {
  return `${Math.round(clamp01(score) * 100)}%`;
}

export function bandLabel(band: ReliabilityBand): string {
  switch (band) {
    case "exemplary":
      return "Exemplary";
    case "reliable":
      return "Reliable";
    case "watch":
      return "Keep an eye on";
    case "at_risk":
      return "At risk";
  }
}

export function riskLabel(risk: StaffingRisk): string {
  switch (risk) {
    case "healthy":
      return "Fully staffed";
    case "thin":
      return "Thin";
    case "at_risk":
      return "At risk";
    case "critical":
      return "Critically short";
  }
}

/**
 * One-line explanation of why a shift is flagged, for the dashboard row.
 * Coordinators act on sentences, not on numbers in isolation.
 */
export function explainForecast(forecast: ShiftForecast): string {
  if (forecast.signupCount === 0) {
    return `No volunteers have claimed this shift — ${forecast.capacity} needed.`;
  }
  if (forecast.risk === "healthy") {
    return `${forecast.signupCount} signed up, forecasting ${forecast.expectedAttendance} of ${forecast.capacity} needed.`;
  }
  const shaky = forecast.shakyAssigneeIds.length;
  const shakyClause =
    shaky > 0 ? ` ${shaky} of them ${shaky === 1 ? "has" : "have"} a weak attendance record.` : "";
  return `${forecast.signupCount} signed up but only ~${forecast.expectedAttendance} expected against ${forecast.capacity} needed.${shakyClause}`;
}
