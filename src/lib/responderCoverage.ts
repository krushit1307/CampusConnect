// src/lib/responderCoverage.ts
// -----------------------------------------------------------------------------
// Issue #3754 — Dynamic Certified First-Aid Responder Coverage Planner
//
// Continuous-coverage analysis for certified first-aid responders across an
// event's timeline. Pure functions — no React, no Supabase — because the two
// failure modes this exists to catch are subtle enough to need exhaustive
// tests:
//
//   1. Temporal gaps. Two responder blocks written independently ("Priya 14:00
//      –16:00", "Arun 17:00–19:00") leave an hour with nobody on the ground,
//      and nobody notices because each block looks fine on its own.
//   2. Silently expired certifications. A rostered responder whose certificate
//      lapsed three months ago still appears on the roster and contributes
//      nothing if an incident happens.
//
// The core is a sweep line over duty intervals. At every instant we count how
// many *validly certified* responders are on duty and compare against what the
// event's risk tier requires. Certification validity is evaluated against the
// duty date, not against today, so a certificate expiring mid-shift correctly
// invalidates the later portion of that block.
// -----------------------------------------------------------------------------

export type CertificationLevel = "basic" | "intermediate" | "advanced";

/** Ordering used for "meets the minimum level" comparisons. */
export const CERTIFICATION_RANK: Record<CertificationLevel, number> = {
  basic: 1,
  intermediate: 2,
  advanced: 3,
};

export interface ResponderCertification {
  id: string;
  userId: string;
  level: CertificationLevel;
  issuingBody: string;
  issuedOn: string; // ISO date
  expiresOn: string; // ISO date
}

export interface ResponderDuty {
  id: string;
  responderId: string;
  responderName: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  station?: string | null;
}

export type EventRiskTier = "low" | "moderate" | "high" | "extreme";

export interface TierRequirement {
  /** Responders that must be on duty concurrently at all times. */
  requiredConcurrent: number;
  /** Lowest certification level that counts toward the requirement. */
  minimumLevel: CertificationLevel;
}

/**
 * Tier requirements. A 3,000-person sports meet with contact sport is not the
 * same risk as a 40-person seminar, and a roster of three basic first-aiders
 * does not satisfy a tier that needs an advanced responder on site.
 */
export const TIER_REQUIREMENTS: Record<EventRiskTier, TierRequirement> = {
  low: { requiredConcurrent: 1, minimumLevel: "basic" },
  moderate: { requiredConcurrent: 2, minimumLevel: "basic" },
  high: { requiredConcurrent: 3, minimumLevel: "intermediate" },
  extreme: { requiredConcurrent: 4, minimumLevel: "advanced" },
};

export type ActivityRisk = "sedentary" | "active" | "contact_sport" | "hazardous";

/**
 * Derives a risk tier from attendance and activity type.
 *
 * Attendance alone is a poor proxy: 200 people at a contact sports fixture
 * needs more cover than 800 at a lecture. We take the higher of the two
 * signals rather than averaging them, because risk does not average.
 */
export function deriveRiskTier(expectedAttendance: number, activity: ActivityRisk): EventRiskTier {
  const byAttendance: EventRiskTier =
    expectedAttendance >= 2000
      ? "extreme"
      : expectedAttendance >= 500
        ? "high"
        : expectedAttendance >= 150
          ? "moderate"
          : "low";

  const byActivity: EventRiskTier =
    activity === "hazardous"
      ? "extreme"
      : activity === "contact_sport"
        ? "high"
        : activity === "active"
          ? "moderate"
          : "low";

  const TIER_ORDER: EventRiskTier[] = ["low", "moderate", "high", "extreme"];
  return TIER_ORDER[Math.max(TIER_ORDER.indexOf(byAttendance), TIER_ORDER.indexOf(byActivity))];
}

// -----------------------------------------------------------------------------
// Certification validity
// -----------------------------------------------------------------------------

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * The best certification a responder holds that is valid at a given instant.
 *
 * Returns null when they hold none — which is the whole point: a responder
 * with a lapsed certificate contributes zero coverage, not "probably fine".
 */
export function effectiveCertificationAt(
  certifications: ResponderCertification[],
  userId: string,
  atMs: number,
): ResponderCertification | null {
  const valid = certifications.filter(
    (c) => c.userId === userId && toMs(c.issuedOn) <= atMs && toMs(c.expiresOn) > atMs,
  );
  if (valid.length === 0) return null;

  return valid.reduce((best, current) =>
    CERTIFICATION_RANK[current.level] > CERTIFICATION_RANK[best.level] ? current : best,
  );
}

export function meetsLevel(level: CertificationLevel, minimum: CertificationLevel): boolean {
  return CERTIFICATION_RANK[level] >= CERTIFICATION_RANK[minimum];
}

/**
 * Splits a duty interval wherever a responder's effective certification
 * changes — which is what makes "expires at noon" invalidate only the
 * afternoon rather than the whole block or none of it.
 */
export interface CertifiedSegment {
  dutyId: string;
  responderId: string;
  responderName: string;
  startMs: number;
  endMs: number;
  level: CertificationLevel | null;
  station?: string | null;
}

export function segmentDutyByCertification(
  duty: ResponderDuty,
  certifications: ResponderCertification[],
): CertifiedSegment[] {
  const startMs = toMs(duty.startsAt);
  const endMs = toMs(duty.endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  // Certification boundaries falling strictly inside the duty window are the
  // only places the effective level can change.
  const mine = certifications.filter((c) => c.userId === duty.responderId);
  const boundaries = new Set<number>([startMs, endMs]);
  for (const cert of mine) {
    for (const boundary of [toMs(cert.issuedOn), toMs(cert.expiresOn)]) {
      if (boundary > startMs && boundary < endMs) boundaries.add(boundary);
    }
  }

  const points = Array.from(boundaries).sort((a, b) => a - b);
  const segments: CertifiedSegment[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    const cert = effectiveCertificationAt(certifications, duty.responderId, segStart);
    segments.push({
      dutyId: duty.id,
      responderId: duty.responderId,
      responderName: duty.responderName,
      startMs: segStart,
      endMs: segEnd,
      level: cert ? cert.level : null,
      station: duty.station,
    });
  }

  return segments;
}

// -----------------------------------------------------------------------------
// Coverage sweep
// -----------------------------------------------------------------------------

export interface CoverageSlice {
  startMs: number;
  endMs: number;
  /** Responders on duty whose certification meets the tier minimum. */
  qualifiedCount: number;
  /** On duty but under-certified or uncertified. */
  unqualifiedCount: number;
  requiredCount: number;
  responderIds: string[];
}

export type CoverageGapKind = "no_cover" | "under_staffed" | "under_certified";

export interface CoverageGap {
  kind: CoverageGapKind;
  startMs: number;
  endMs: number;
  durationMinutes: number;
  qualifiedCount: number;
  requiredCount: number;
  shortfall: number;
  message: string;
}

export interface CoverageAnalysis {
  tier: EventRiskTier;
  requirement: TierRequirement;
  slices: CoverageSlice[];
  gaps: CoverageGap[];
  /** True when coverage meets the requirement across the whole window. */
  isCompliant: boolean;
  totalGapMinutes: number;
  /** Duty blocks that abut exactly, leaving no handover overlap. */
  fragileHandovers: Array<{
    atMs: number;
    outgoingResponderId: string;
    incomingResponderId: string;
  }>;
  /** Responders whose certification lapses during the event window. */
  expiringDuringEvent: Array<{
    responderId: string;
    responderName: string;
    expiresAtMs: number;
  }>;
}

const MS_PER_MINUTE = 60_000;

/**
 * Analyses coverage across an event window.
 *
 * The window matters: an event running 14:00–22:00 with responders rostered
 * only until 20:00 has a two-hour gap that a duty-interval-only sweep would
 * never see, because there are no intervals there to sweep.
 */
export function analyseCoverage(
  duties: ResponderDuty[],
  certifications: ResponderCertification[],
  eventStart: string,
  eventEnd: string,
  tier: EventRiskTier,
): CoverageAnalysis {
  const requirement = TIER_REQUIREMENTS[tier];
  const windowStart = toMs(eventStart);
  const windowEnd = toMs(eventEnd);

  const empty: CoverageAnalysis = {
    tier,
    requirement,
    slices: [],
    gaps: [],
    isCompliant: false,
    totalGapMinutes: 0,
    fragileHandovers: [],
    expiringDuringEvent: [],
  };

  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) {
    return empty;
  }

  // Segment every duty by certification change, then clip to the window.
  const segments = duties
    .flatMap((duty) => segmentDutyByCertification(duty, certifications))
    .map((segment) => ({
      ...segment,
      startMs: Math.max(segment.startMs, windowStart),
      endMs: Math.min(segment.endMs, windowEnd),
    }))
    .filter((segment) => segment.endMs > segment.startMs);

  // Boundaries always include the window edges, so uncovered head and tail
  // periods are analysed rather than falling outside the sweep.
  const boundaries = new Set<number>([windowStart, windowEnd]);
  for (const segment of segments) {
    boundaries.add(segment.startMs);
    boundaries.add(segment.endMs);
  }
  const points = Array.from(boundaries).sort((a, b) => a - b);

  const slices: CoverageSlice[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const sliceStart = points[i];
    const sliceEnd = points[i + 1];

    // Half-open [start, end): a block ending at 16:00 does not cover 16:00.
    const active = segments.filter((s) => s.startMs <= sliceStart && s.endMs > sliceStart);

    const qualified = active.filter(
      (s) => s.level !== null && meetsLevel(s.level, requirement.minimumLevel),
    );

    slices.push({
      startMs: sliceStart,
      endMs: sliceEnd,
      qualifiedCount: qualified.length,
      unqualifiedCount: active.length - qualified.length,
      requiredCount: requirement.requiredConcurrent,
      responderIds: active.map((s) => s.responderId).sort(),
    });
  }

  const gaps = mergeGaps(slices, requirement);

  return {
    tier,
    requirement,
    slices,
    gaps,
    isCompliant: gaps.length === 0,
    totalGapMinutes: gaps.reduce((sum, gap) => sum + gap.durationMinutes, 0),
    fragileHandovers: findFragileHandovers(duties, windowStart, windowEnd),
    expiringDuringEvent: findExpiringDuringEvent(duties, certifications, windowStart, windowEnd),
  };
}

/**
 * Turns under-covered slices into merged gap intervals.
 *
 * Adjacent under-covered slices are merged so the UI reports one 20-minute gap
 * rather than four touching five-minute fragments — but only when they share a
 * kind, since "nobody at all" and "one short" are different problems needing
 * different responses.
 */
function mergeGaps(slices: CoverageSlice[], requirement: TierRequirement): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  for (const slice of slices) {
    if (slice.qualifiedCount >= requirement.requiredConcurrent) continue;

    const kind: CoverageGapKind =
      slice.qualifiedCount === 0
        ? slice.unqualifiedCount > 0
          ? "under_certified"
          : "no_cover"
        : "under_staffed";

    const previous = gaps[gaps.length - 1];
    if (
      previous &&
      previous.endMs === slice.startMs &&
      previous.kind === kind &&
      previous.qualifiedCount === slice.qualifiedCount
    ) {
      previous.endMs = slice.endMs;
      previous.durationMinutes = (previous.endMs - previous.startMs) / MS_PER_MINUTE;
      previous.message = describeGap(previous);
      continue;
    }

    const gap: CoverageGap = {
      kind,
      startMs: slice.startMs,
      endMs: slice.endMs,
      durationMinutes: (slice.endMs - slice.startMs) / MS_PER_MINUTE,
      qualifiedCount: slice.qualifiedCount,
      requiredCount: requirement.requiredConcurrent,
      shortfall: requirement.requiredConcurrent - slice.qualifiedCount,
      message: "",
    };
    gap.message = describeGap(gap);
    gaps.push(gap);
  }

  return gaps;
}

function describeGap(gap: CoverageGap): string {
  const duration = formatMinutes(gap.durationMinutes);
  switch (gap.kind) {
    case "no_cover":
      return `No certified responder on duty for ${duration}.`;
    case "under_certified":
      return `${duration} with responders on duty but none certified to the required level.`;
    case "under_staffed":
      return `${duration} with only ${gap.qualifiedCount} of ${gap.requiredCount} required responders.`;
  }
}

/**
 * Blocks that abut exactly leave no handover window. Technically covered,
 * practically fragile — the outgoing responder walks away at the same instant
 * the incoming one is meant to arrive, and any lateness becomes a real gap.
 */
function findFragileHandovers(
  duties: ResponderDuty[],
  windowStart: number,
  windowEnd: number,
): CoverageAnalysis["fragileHandovers"] {
  const handovers: CoverageAnalysis["fragileHandovers"] = [];

  for (const outgoing of duties) {
    const endMs = toMs(outgoing.endsAt);
    if (!Number.isFinite(endMs) || endMs <= windowStart || endMs >= windowEnd) {
      continue;
    }

    for (const incoming of duties) {
      if (incoming.id === outgoing.id) continue;
      if (incoming.responderId === outgoing.responderId) continue;
      if (toMs(incoming.startsAt) !== endMs) continue;

      // Only fragile if nobody else is spanning the boundary.
      const spanning = duties.some(
        (other) =>
          other.id !== outgoing.id &&
          other.id !== incoming.id &&
          toMs(other.startsAt) < endMs &&
          toMs(other.endsAt) > endMs,
      );
      if (spanning) continue;

      handovers.push({
        atMs: endMs,
        outgoingResponderId: outgoing.responderId,
        incomingResponderId: incoming.responderId,
      });
    }
  }

  return handovers;
}

function findExpiringDuringEvent(
  duties: ResponderDuty[],
  certifications: ResponderCertification[],
  windowStart: number,
  windowEnd: number,
): CoverageAnalysis["expiringDuringEvent"] {
  const rostered = new Map(duties.map((d) => [d.responderId, d.responderName]));
  const expiring: CoverageAnalysis["expiringDuringEvent"] = [];
  const seen = new Set<string>();

  for (const cert of certifications) {
    if (!rostered.has(cert.userId)) continue;
    const expiresMs = toMs(cert.expiresOn);
    if (expiresMs <= windowStart || expiresMs >= windowEnd) continue;

    // Only a problem if they hold nothing else valid past that point.
    const stillValid = effectiveCertificationAt(certifications, cert.userId, expiresMs);
    if (stillValid) continue;

    const key = `${cert.userId}-${expiresMs}`;
    if (seen.has(key)) continue;
    seen.add(key);

    expiring.push({
      responderId: cert.userId,
      responderName: rostered.get(cert.userId)!,
      expiresAtMs: expiresMs,
    });
  }

  return expiring;
}

// -----------------------------------------------------------------------------
// Renewal horizon
// -----------------------------------------------------------------------------

export interface ExpiringCertification {
  certification: ResponderCertification;
  daysRemaining: number;
  isExpired: boolean;
}

/**
 * Certifications lapsing within a horizon, so a coordinator can chase renewals
 * before they silently invalidate a roster.
 */
export function certificationsExpiringWithin(
  certifications: ResponderCertification[],
  horizonDays: number,
  now: Date = new Date(),
): ExpiringCertification[] {
  const nowMs = now.getTime();
  const horizonMs = nowMs + horizonDays * 24 * 60 * MS_PER_MINUTE;

  return certifications
    .map((certification) => {
      const expiresMs = toMs(certification.expiresOn);
      return {
        certification,
        daysRemaining: Math.floor((expiresMs - nowMs) / (24 * 60 * MS_PER_MINUTE)),
        isExpired: expiresMs <= nowMs,
      };
    })
    .filter((entry) => toMs(entry.certification.expiresOn) <= horizonMs)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// -----------------------------------------------------------------------------
// Presentation helpers
// -----------------------------------------------------------------------------

export function formatMinutes(minutes: number): string {
  const abs = Math.round(Math.abs(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function tierLabel(tier: EventRiskTier): string {
  switch (tier) {
    case "low":
      return "Low risk";
    case "moderate":
      return "Moderate risk";
    case "high":
      return "High risk";
    case "extreme":
      return "Extreme risk";
  }
}

export function levelLabel(level: CertificationLevel): string {
  switch (level) {
    case "basic":
      return "Basic first aid";
    case "intermediate":
      return "Intermediate";
    case "advanced":
      return "Advanced / paramedic";
  }
}

export type ComplianceVerdict = "compliant" | "gaps_present" | "under_certified" | "no_roster";

export function complianceVerdict(analysis: CoverageAnalysis): ComplianceVerdict {
  if (analysis.slices.length === 0) return "no_roster";
  if (analysis.isCompliant) return "compliant";
  if (analysis.gaps.every((g) => g.kind === "under_certified")) {
    return "under_certified";
  }
  return "gaps_present";
}

export function verdictSummary(analysis: CoverageAnalysis): string {
  switch (complianceVerdict(analysis)) {
    case "no_roster":
      return "No responder duties have been rostered for this event.";
    case "compliant":
      return `Coverage meets the ${tierLabel(analysis.tier).toLowerCase()} requirement of ${analysis.requirement.requiredConcurrent} concurrent ${levelLabel(analysis.requirement.minimumLevel).toLowerCase()} responder${analysis.requirement.requiredConcurrent === 1 ? "" : "s"} throughout.`;
    case "under_certified":
      return `Responders are on duty throughout, but not enough hold ${levelLabel(analysis.requirement.minimumLevel).toLowerCase()} certification.`;
    case "gaps_present":
      return `${analysis.gaps.length} coverage gap${analysis.gaps.length === 1 ? "" : "s"} totalling ${formatMinutes(analysis.totalGapMinutes)}.`;
  }
}

export function formatClock(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
