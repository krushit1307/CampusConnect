// src/lib/noticeBoardPermits.ts
// -----------------------------------------------------------------------------
// Issue #3755 — Interactive Campus Notice Board Poster Permit & Takedown System
//
// Interval-capacity booking for physical notice boards. Pure functions — no
// React, no Supabase — because the correctness of the whole feature rests on
// one non-obvious rule, and that rule needs exhaustive tests:
//
//   A permit for 5–12 June is grantable only if the board has a free slot on
//   EVERY day in that range. Checking "is the board free today" is not the same
//   question, and getting it wrong either double-books the board or refuses
//   requests that would have fit.
//
// Dates, not timestamps
//   Permits are day-granular. A permit running 5–12 June occupies the board for
//   the whole of both end days. We use half-open interval arithmetic internally
//   ([start, end+1)) so that a permit ending on the 12th and one starting on the
//   12th are correctly treated as overlapping — they are both on the board that
//   day — while the exclusive upper bound keeps the sweep logic simple.
// -----------------------------------------------------------------------------

export type PermitStatus = "pending" | "approved" | "rejected" | "withdrawn" | "taken_down";

export interface NoticeBoard {
  id: string;
  name: string;
  building: string;
  locationDetail?: string | null;
  /** How many posters physically fit. The whole point of the feature. */
  slotCapacity: number;
  isActive: boolean;
  requiresApproval: boolean;
}

export interface PosterPermit {
  id: string;
  boardId: string;
  clubId: string;
  clubName: string;
  title: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  startsOn: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  endsOn: string;
  slotsRequested: number;
  status: PermitStatus;
  takedownOwnerName?: string | null;
  takenDownAt?: string | null;
}

export interface PermitPolicy {
  /** Longest a single permit may run. Stops a semester-long monopoly. */
  maxDurationDays: number;
  /** How many approved permits one club may hold on one board at once. */
  maxConcurrentPerClub: number;
  /** Days before expiry at which takedown becomes "due soon". */
  takedownReminderDays: number;
}

export const DEFAULT_PERMIT_POLICY: PermitPolicy = {
  maxDurationDays: 21,
  maxConcurrentPerClub: 2,
  takedownReminderDays: 2,
};

const MS_PER_DAY = 86_400_000;

/** Parses a YYYY-MM-DD date into a UTC-midnight epoch. */
export function parseDay(isoDate: string): number {
  // Force UTC so a permit is not silently shifted a day by the viewer's
  // timezone — a poster permit is the same calendar day everywhere on campus.
  const normalized = isoDate.length === 10 ? `${isoDate}T00:00:00.000Z` : isoDate;
  return new Date(normalized).getTime();
}

export function isValidDay(isoDate: string): boolean {
  return !Number.isNaN(parseDay(isoDate));
}

/** Inclusive day count: 5th–5th is 1 day, 5th–12th is 8 days. */
export function durationDays(startsOn: string, endsOn: string): number {
  const start = parseDay(startsOn);
  const end = parseDay(endsOn);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.floor((end - start) / MS_PER_DAY) + 1;
}

/**
 * Half-open [start, endExclusive) bounds for a permit, where endExclusive is
 * the day *after* the last occupied day.
 */
export function permitBounds(permit: PosterPermit): {
  start: number;
  endExclusive: number;
} {
  return {
    start: parseDay(permit.startsOn),
    endExclusive: parseDay(permit.endsOn) + MS_PER_DAY,
  };
}

/**
 * Do two permits share at least one day on the board?
 *
 * The case that matters: a permit ending on the 12th and one starting on the
 * 12th DO overlap — both posters are up that day. A naive `end < start` check
 * on inclusive dates gets this backwards.
 */
export function permitsOverlap(a: PosterPermit, b: PosterPermit): boolean {
  const boundsA = permitBounds(a);
  const boundsB = permitBounds(b);
  return boundsA.start < boundsB.endExclusive && boundsB.start < boundsA.endExclusive;
}

/** Permits that occupy board space: approved, and not yet taken down. */
export function isOccupying(permit: PermitStatus): boolean {
  return permit === "approved";
}

// -----------------------------------------------------------------------------
// Capacity checking
// -----------------------------------------------------------------------------

export interface OccupancyDay {
  /** UTC-midnight epoch for the day. */
  dayMs: number;
  slotsUsed: number;
  capacity: number;
  permitIds: string[];
}

/**
 * Day-by-day occupancy for a board across a range.
 *
 * Day granularity is deliberate: a notice board has a handful of slots and a
 * permit spans days, so the naive per-day loop is both correct and cheap, and
 * far easier to verify than a sweep over boundaries.
 */
export function buildOccupancy(
  board: NoticeBoard,
  permits: PosterPermit[],
  rangeStart: string,
  rangeEnd: string,
): OccupancyDay[] {
  const start = parseDay(rangeStart);
  const end = parseDay(rangeEnd);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];

  const occupying = permits.filter((p) => p.boardId === board.id && isOccupying(p.status));

  const days: OccupancyDay[] = [];
  for (let dayMs = start; dayMs <= end; dayMs += MS_PER_DAY) {
    const onThisDay = occupying.filter((p) => {
      const bounds = permitBounds(p);
      return bounds.start <= dayMs && dayMs < bounds.endExclusive;
    });

    days.push({
      dayMs,
      slotsUsed: onThisDay.reduce((sum, p) => sum + Math.max(0, p.slotsRequested), 0),
      capacity: board.slotCapacity,
      permitIds: onThisDay.map((p) => p.id).sort(),
    });
  }

  return days;
}

export type PermitRejectionReason =
  | "board_inactive"
  | "invalid_dates"
  | "end_before_start"
  | "exceeds_max_duration"
  | "exceeds_club_concurrent_cap"
  | "insufficient_capacity"
  | "slots_exceed_board";

export interface PermitDecision {
  grantable: boolean;
  reason: PermitRejectionReason | null;
  message: string;
  /** Days on which the board would be over capacity. */
  conflictingDays: number[];
  /** Peak slot usage across the requested range, including this request. */
  peakUsage: number;
  capacity: number;
  /**
   * The earliest start date at which this exact request would fit, or null if
   * no date inside the search horizon works. Turning a refusal into an offer.
   */
  earliestAlternativeStart: string | null;
}

/**
 * Decides whether a permit request can be granted.
 *
 * Returns a decision object rather than throwing, because every rejection needs
 * to travel back to the requesting club with a reason and, where possible, an
 * alternative date.
 */
export function evaluatePermitRequest(
  board: NoticeBoard,
  existingPermits: PosterPermit[],
  request: {
    clubId: string;
    startsOn: string;
    endsOn: string;
    slotsRequested: number;
  },
  policy: PermitPolicy = DEFAULT_PERMIT_POLICY,
  searchHorizonDays = 60,
): PermitDecision {
  const base: PermitDecision = {
    grantable: false,
    reason: null,
    message: "",
    conflictingDays: [],
    peakUsage: 0,
    capacity: board.slotCapacity,
    earliestAlternativeStart: null,
  };

  if (!board.isActive) {
    return {
      ...base,
      reason: "board_inactive",
      message: `${board.name} is not currently accepting postings.`,
    };
  }

  if (!isValidDay(request.startsOn) || !isValidDay(request.endsOn)) {
    return {
      ...base,
      reason: "invalid_dates",
      message: "The requested dates could not be read.",
    };
  }

  if (parseDay(request.endsOn) < parseDay(request.startsOn)) {
    return {
      ...base,
      reason: "end_before_start",
      message: "The permit would end before it begins.",
    };
  }

  const requestedSlots = Math.max(1, request.slotsRequested);

  if (requestedSlots > board.slotCapacity) {
    return {
      ...base,
      reason: "slots_exceed_board",
      message: `${board.name} has only ${board.slotCapacity} slot${board.slotCapacity === 1 ? "" : "s"}; ${requestedSlots} were requested.`,
    };
  }

  const days = durationDays(request.startsOn, request.endsOn);
  if (days > policy.maxDurationDays) {
    return {
      ...base,
      reason: "exceeds_max_duration",
      message: `Permits may run for at most ${policy.maxDurationDays} days; this one runs ${days}.`,
    };
  }

  // Concurrency cap: how many approved permits does this club already hold on
  // this board that overlap the requested window?
  const clubOverlapping = existingPermits.filter(
    (p) =>
      p.boardId === board.id &&
      p.clubId === request.clubId &&
      isOccupying(p.status) &&
      permitsOverlap(p, {
        ...placeholderPermit(request),
        boardId: board.id,
        clubId: request.clubId,
      }),
  );

  if (clubOverlapping.length >= policy.maxConcurrentPerClub) {
    return {
      ...base,
      reason: "exceeds_club_concurrent_cap",
      message: `Your club already holds ${clubOverlapping.length} permit${clubOverlapping.length === 1 ? "" : "s"} on ${board.name} for these dates; the limit is ${policy.maxConcurrentPerClub}.`,
    };
  }

  // The capacity check proper: every day in the range must have room.
  const occupancy = buildOccupancy(board, existingPermits, request.startsOn, request.endsOn);

  const conflictingDays = occupancy
    .filter((day) => day.slotsUsed + requestedSlots > board.slotCapacity)
    .map((day) => day.dayMs);

  const peakUsage = occupancy.reduce(
    (max, day) => Math.max(max, day.slotsUsed + requestedSlots),
    requestedSlots,
  );

  if (conflictingDays.length > 0) {
    return {
      ...base,
      reason: "insufficient_capacity",
      message: `${board.name} is full on ${conflictingDays.length} of the ${days} requested day${days === 1 ? "" : "s"}.`,
      conflictingDays,
      peakUsage,
      earliestAlternativeStart: findEarliestFit(
        board,
        existingPermits,
        request,
        days,
        searchHorizonDays,
      ),
    };
  }

  return {
    ...base,
    grantable: true,
    message: `${board.name} has room for this posting across all ${days} day${days === 1 ? "" : "s"}.`,
    peakUsage,
  };
}

/** Minimal permit shape for overlap comparison against a pending request. */
function placeholderPermit(request: {
  startsOn: string;
  endsOn: string;
  slotsRequested: number;
}): PosterPermit {
  return {
    id: "__request__",
    boardId: "",
    clubId: "",
    clubName: "",
    title: "",
    startsOn: request.startsOn,
    endsOn: request.endsOn,
    slotsRequested: request.slotsRequested,
    status: "approved",
  };
}

/**
 * Walks forward day by day looking for the first start date at which the whole
 * requested duration would fit. Turns "no" into "not until the 19th", which is
 * the difference between a system that blocks people and one that helps them.
 */
export function findEarliestFit(
  board: NoticeBoard,
  existingPermits: PosterPermit[],
  request: { startsOn: string; slotsRequested: number },
  durationInDays: number,
  horizonDays: number,
): string | null {
  const requestedSlots = Math.max(1, request.slotsRequested);
  const originalStart = parseDay(request.startsOn);
  if (Number.isNaN(originalStart) || durationInDays <= 0) return null;

  for (let offset = 1; offset <= horizonDays; offset += 1) {
    const candidateStart = originalStart + offset * MS_PER_DAY;
    const candidateEnd = candidateStart + (durationInDays - 1) * MS_PER_DAY;

    const occupancy = buildOccupancy(
      board,
      existingPermits,
      toDayString(candidateStart),
      toDayString(candidateEnd),
    );

    const fits = occupancy.every((day) => day.slotsUsed + requestedSlots <= board.slotCapacity);
    if (fits) return toDayString(candidateStart);
  }

  return null;
}

export function toDayString(dayMs: number): string {
  return new Date(dayMs).toISOString().slice(0, 10);
}

/**
 * The busiest window on a board over a range, so managers can see at a glance
 * when a board is saturated.
 */
export function peakOccupancyWindow(
  occupancy: OccupancyDay[],
): { startMs: number; endMs: number; slotsUsed: number } | null {
  if (occupancy.length === 0) return null;

  const peak = occupancy.reduce((max, day) => Math.max(max, day.slotsUsed), 0);

  // The contiguous run at peak usage — a single saturated fortnight reads
  // better than fourteen identical rows.
  let startMs: number | null = null;
  let endMs: number | null = null;
  for (const day of occupancy) {
    if (day.slotsUsed === peak) {
      if (startMs === null) startMs = day.dayMs;
      endMs = day.dayMs;
    } else if (startMs !== null) {
      break;
    }
  }

  if (startMs === null || endMs === null) return null;
  return { startMs, endMs, slotsUsed: peak };
}

// -----------------------------------------------------------------------------
// Takedown lifecycle
// -----------------------------------------------------------------------------

export type TakedownState =
  | "scheduled" // approved, not yet started
  | "active" // currently on the board
  | "due_soon" // expiring within the reminder horizon
  | "overdue" // past its end date, still up
  | "completed"; // taken down

export interface TakedownStatus {
  permitId: string;
  state: TakedownState;
  /** Negative once the permit has expired. */
  daysRemaining: number;
  ownerName: string | null;
  message: string;
}

export function takedownStatus(
  permit: PosterPermit,
  today: Date = new Date(),
  policy: PermitPolicy = DEFAULT_PERMIT_POLICY,
): TakedownStatus {
  const owner = permit.takedownOwnerName ?? null;
  const todayMs = parseDay(toDayString(today.getTime()));
  const startMs = parseDay(permit.startsOn);
  const endMs = parseDay(permit.endsOn);
  const daysRemaining = Math.floor((endMs - todayMs) / MS_PER_DAY);

  if (permit.takenDownAt) {
    return {
      permitId: permit.id,
      state: "completed",
      daysRemaining,
      ownerName: owner,
      message: `Taken down on ${permit.takenDownAt.slice(0, 10)}.`,
    };
  }

  if (todayMs < startMs) {
    return {
      permitId: permit.id,
      state: "scheduled",
      daysRemaining,
      ownerName: owner,
      message: `Goes up on ${permit.startsOn}.`,
    };
  }

  if (daysRemaining < 0) {
    return {
      permitId: permit.id,
      state: "overdue",
      daysRemaining,
      ownerName: owner,
      message: owner
        ? `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago — ${owner} to remove.`
        : `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago and nobody is assigned to remove it.`,
    };
  }

  if (daysRemaining <= policy.takedownReminderDays) {
    return {
      permitId: permit.id,
      state: "due_soon",
      daysRemaining,
      ownerName: owner,
      message:
        daysRemaining === 0
          ? `Comes down today${owner ? ` — ${owner}` : ""}.`
          : `Comes down in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}${owner ? ` — ${owner}` : ""}.`,
    };
  }

  return {
    permitId: permit.id,
    state: "active",
    daysRemaining,
    ownerName: owner,
    message: `On the board until ${permit.endsOn}.`,
  };
}

/** Permits still up past their end date, worst offender first. */
export function overdueTakedowns(
  permits: PosterPermit[],
  today: Date = new Date(),
  policy: PermitPolicy = DEFAULT_PERMIT_POLICY,
): TakedownStatus[] {
  return permits
    .filter((p) => isOccupying(p.status))
    .map((p) => takedownStatus(p, today, policy))
    .filter((s) => s.state === "overdue")
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export interface ClubTakedownRecord {
  clubId: string;
  clubName: string;
  totalPermits: number;
  onTimeTakedowns: number;
  lateTakedowns: number;
  currentlyOverdue: number;
  /** 0..1. Null when the club has no completed permits to judge. */
  complianceRate: number | null;
}

/**
 * Per-club takedown compliance, so a board manager reviewing a club's next
 * request can see whether that club actually removes its posters.
 */
export function clubTakedownRecords(
  permits: PosterPermit[],
  today: Date = new Date(),
  policy: PermitPolicy = DEFAULT_PERMIT_POLICY,
): ClubTakedownRecord[] {
  const byClub = new Map<string, ClubTakedownRecord>();

  for (const permit of permits) {
    if (permit.status === "pending" || permit.status === "rejected") continue;

    const existing = byClub.get(permit.clubId) ?? {
      clubId: permit.clubId,
      clubName: permit.clubName,
      totalPermits: 0,
      onTimeTakedowns: 0,
      lateTakedowns: 0,
      currentlyOverdue: 0,
      complianceRate: null,
    };

    existing.totalPermits += 1;

    if (permit.takenDownAt) {
      const takenDownMs = parseDay(permit.takenDownAt.slice(0, 10));
      const dueMs = parseDay(permit.endsOn);
      if (takenDownMs <= dueMs + MS_PER_DAY) existing.onTimeTakedowns += 1;
      else existing.lateTakedowns += 1;
    } else if (takedownStatus(permit, today, policy).state === "overdue") {
      existing.currentlyOverdue += 1;
    }

    byClub.set(permit.clubId, existing);
  }

  for (const record of byClub.values()) {
    const judged = record.onTimeTakedowns + record.lateTakedowns + record.currentlyOverdue;
    record.complianceRate = judged === 0 ? null : record.onTimeTakedowns / judged;
  }

  return Array.from(byClub.values()).sort((a, b) => {
    const aRate = a.complianceRate ?? 1;
    const bRate = b.complianceRate ?? 1;
    return aRate - bRate;
  });
}

// -----------------------------------------------------------------------------
// Presentation helpers
// -----------------------------------------------------------------------------

export function formatDay(dayMs: number): string {
  const date = new Date(dayMs);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function takedownStateLabel(state: TakedownState): string {
  switch (state) {
    case "scheduled":
      return "Scheduled";
    case "active":
      return "On the board";
    case "due_soon":
      return "Coming down";
    case "overdue":
      return "Overdue";
    case "completed":
      return "Removed";
  }
}

/** Utilisation of a board across a range, as a 0..1 ratio of slot-days used. */
export function utilisationRate(occupancy: OccupancyDay[]): number {
  if (occupancy.length === 0) return 0;
  const capacityDays = occupancy.reduce((sum, day) => sum + day.capacity, 0);
  if (capacityDays === 0) return 0;
  const usedDays = occupancy.reduce((sum, day) => sum + day.slotsUsed, 0);
  return Math.min(1, usedDays / capacityDays);
}
