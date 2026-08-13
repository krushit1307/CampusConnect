/**
 * Emergency Roll-Call & Evacuation Headcount (#3136).
 *
 * Turns live check-in data into a list a marshal can actually work at an
 * assembly point: who was inside when the incident was declared, who has been
 * accounted for, and who still needs a sweep team.
 *
 * Deliberately pure and synchronous - no network calls - because the assembly
 * point is usually a car park with no signal. Marks are applied locally and
 * replayed through the existing offline mutation queue when connectivity
 * returns, which is why every transition carries its own timestamp and is
 * safe to re-apply out of order.
 */

export type RollCallStatus = "UNACCOUNTED" | "SAFE" | "ASSISTED" | "MISSING";

export type MarkRejectionReason = "ILLEGAL_TRANSITION" | "STALE_WRITE" | "UNKNOWN_ATTENDEE";

/**
 * Legal state transitions. Marshals make mistakes under pressure, so there is
 * a correction path back out of SAFE, but a person can never move from SAFE
 * straight to MISSING without first being un-marked - that combination is
 * almost always a scanning error rather than a real change.
 */
export const LEGAL_TRANSITIONS: Record<RollCallStatus, ReadonlyArray<RollCallStatus>> = {
  UNACCOUNTED: ["SAFE", "ASSISTED", "MISSING"],
  SAFE: ["UNACCOUNTED", "ASSISTED"],
  ASSISTED: ["SAFE", "MISSING"],
  MISSING: ["SAFE", "ASSISTED"],
};

export interface AttendanceRecord {
  userId: string;
  userName: string;
  /** ISO timestamp of check-in. */
  checkedInAt: string;
  /** ISO timestamp of check-out, when the attendee has already left. */
  checkedOutAt?: string | null;
  /** Last known zone inside the venue. */
  lastKnownZoneId?: string | null;
  /** Declared mobility accommodation - these people are swept for first. */
  requiresMobilityAssistance?: boolean;
}

export interface RollCallEntry {
  userId: string;
  userName: string;
  status: RollCallStatus;
  zoneId: string;
  requiresMobilityAssistance: boolean;
  /** Marshal who set the current status. */
  markedBy: string | null;
  /** ISO timestamp of the current status. */
  markedAt: string | null;
}

export interface RollCallMark {
  userId: string;
  status: RollCallStatus;
  markedBy: string;
  /** ISO timestamp taken on the marshal's device at the moment of marking. */
  markedAt: string;
  /** Zone the marshal is reporting from, when it differs from the last known one. */
  zoneId?: string;
}

export interface MarkOutcome {
  applied: boolean;
  entry: RollCallEntry;
  reason?: MarkRejectionReason;
  detail?: string;
}

export interface ZoneTally {
  zoneId: string;
  total: number;
  accounted: number;
  unaccounted: number;
  assisted: number;
  missing: number;
  /** True when no attendee in this zone has been marked at all. */
  isSilent: boolean;
}

export interface RollCallTally {
  total: number;
  accounted: number;
  unaccounted: number;
  assisted: number;
  missing: number;
  isComplete: boolean;
  zones: ZoneTally[];
}

export interface IncidentReport {
  incidentId: string;
  declaredAt: string;
  closedAt: string | null;
  tally: RollCallTally;
  /** Everyone not confirmed safe, in sweep priority order. */
  outstanding: RollCallEntry[];
  /** Full audit line per attendee, for the post-incident record. */
  auditTrail: Array<{
    userId: string;
    userName: string;
    finalStatus: RollCallStatus;
    markedBy: string | null;
    markedAt: string | null;
  }>;
}

export const UNKNOWN_ZONE_ID = "unassigned";

function toTime(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
}

/** Whether a status change is permitted. Re-marking the same status is a no-op, not an error. */
export function isLegalTransition(from: RollCallStatus, to: RollCallStatus): boolean {
  if (from === to) return true;
  return LEGAL_TRANSITIONS[from].includes(to);
}

/**
 * Builds the roll-call roster at the moment an incident is declared.
 *
 * Only people who were checked in and had not checked out count as being
 * inside. Someone who already went home must never appear as missing - that
 * is the failure mode that sends a sweep team back into a burning building
 * looking for somebody who is at the pub.
 */
export function buildRoster(records: AttendanceRecord[], declaredAt: string): RollCallEntry[] {
  const declaredTime = toTime(declaredAt);

  return records
    .filter((record) => {
      const inTime = toTime(record.checkedInAt);
      if (Number.isNaN(inTime) || inTime > declaredTime) return false;

      const outTime = toTime(record.checkedOutAt);
      return Number.isNaN(outTime) || outTime > declaredTime;
    })
    .map((record) => ({
      userId: record.userId,
      userName: record.userName,
      status: "UNACCOUNTED" as RollCallStatus,
      zoneId: record.lastKnownZoneId || UNKNOWN_ZONE_ID,
      requiresMobilityAssistance: record.requiresMobilityAssistance === true,
      markedBy: null,
      markedAt: null,
    }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
}

/**
 * Applies a single mark to a roster.
 *
 * Two marshals will inevitably mark the same person from different zones.
 * Resolution is last-write-wins on the mark's own timestamp, which also means
 * a queued offline write that arrives late cannot clobber a newer state - the
 * specific case being a stale UNACCOUNTED overwriting a confirmed SAFE.
 */
export function applyMark(entries: RollCallEntry[], mark: RollCallMark): MarkOutcome {
  const index = entries.findIndex((entry) => entry.userId === mark.userId);

  if (index === -1) {
    return {
      applied: false,
      entry: {
        userId: mark.userId,
        userName: "",
        status: "UNACCOUNTED",
        zoneId: UNKNOWN_ZONE_ID,
        requiresMobilityAssistance: false,
        markedBy: null,
        markedAt: null,
      },
      reason: "UNKNOWN_ATTENDEE",
      detail: `${mark.userId} is not on the roster for this incident.`,
    };
  }

  const current = entries[index];

  if (!isLegalTransition(current.status, mark.status)) {
    return {
      applied: false,
      entry: current,
      reason: "ILLEGAL_TRANSITION",
      detail: `${current.status} cannot move directly to ${mark.status}.`,
    };
  }

  const markTime = toTime(mark.markedAt);
  const currentTime = toTime(current.markedAt);

  if (!Number.isNaN(currentTime) && markTime <= currentTime) {
    return {
      applied: false,
      entry: current,
      reason: "STALE_WRITE",
      detail: `A newer mark for ${current.userName} already exists.`,
    };
  }

  const updated: RollCallEntry = {
    ...current,
    status: mark.status,
    zoneId: mark.zoneId || current.zoneId,
    markedBy: mark.markedBy,
    markedAt: mark.markedAt,
  };

  entries[index] = updated;
  return { applied: true, entry: updated };
}

/**
 * Replays a batch of marks, which is what happens when a marshal's device
 * comes back online. Marks are sorted by timestamp first so the replay order
 * matches real-world order regardless of how the queue drained.
 */
export function applyMarkBatch(
  entries: RollCallEntry[],
  marks: RollCallMark[],
): { applied: number; rejected: MarkOutcome[] } {
  const ordered = [...marks].sort(
    (a, b) => toTime(a.markedAt) - toTime(b.markedAt) || a.userId.localeCompare(b.userId),
  );

  let applied = 0;
  const rejected: MarkOutcome[] = [];

  for (const mark of ordered) {
    const outcome = applyMark(entries, mark);
    if (outcome.applied) {
      applied += 1;
    } else {
      rejected.push(outcome);
    }
  }

  return { applied, rejected };
}

/** SAFE and ASSISTED both mean "we have eyes on this person". */
function isAccounted(status: RollCallStatus): boolean {
  return status === "SAFE" || status === "ASSISTED";
}

/**
 * Per-zone and event-wide counts. Zones matter because that is how an
 * evacuation is actually run: each marshal owns an assembly point and needs
 * their own number, not just the site total.
 */
export function calculateTally(entries: RollCallEntry[]): RollCallTally {
  const byZone = new Map<string, RollCallEntry[]>();

  for (const entry of entries) {
    const list = byZone.get(entry.zoneId) ?? [];
    list.push(entry);
    byZone.set(entry.zoneId, list);
  }

  const zones: ZoneTally[] = [...byZone.entries()]
    .map(([zoneId, zoneEntries]) => ({
      zoneId,
      total: zoneEntries.length,
      accounted: zoneEntries.filter((e) => isAccounted(e.status)).length,
      unaccounted: zoneEntries.filter((e) => e.status === "UNACCOUNTED").length,
      assisted: zoneEntries.filter((e) => e.status === "ASSISTED").length,
      missing: zoneEntries.filter((e) => e.status === "MISSING").length,
      isSilent: zoneEntries.every((e) => e.markedAt === null),
    }))
    .sort((a, b) => a.zoneId.localeCompare(b.zoneId));

  const accounted = entries.filter((e) => isAccounted(e.status)).length;

  return {
    total: entries.length,
    accounted,
    unaccounted: entries.filter((e) => e.status === "UNACCOUNTED").length,
    assisted: entries.filter((e) => e.status === "ASSISTED").length,
    missing: entries.filter((e) => e.status === "MISSING").length,
    isComplete: entries.length > 0 && accounted === entries.length,
    zones,
  };
}

/**
 * Orders the marshal's list so the people a sweep team needs first appear
 * first: anyone flagged missing, then attendees with a declared mobility
 * accommodation, then anyone in a zone nobody has reported from at all.
 */
export function prioritiseRoster(entries: RollCallEntry[]): RollCallEntry[] {
  const silentZones = new Set(
    calculateTally(entries)
      .zones.filter((zone) => zone.isSilent)
      .map((zone) => zone.zoneId),
  );

  const rank = (entry: RollCallEntry): number => {
    if (entry.status === "MISSING") return 0;
    if (entry.status === "UNACCOUNTED" && entry.requiresMobilityAssistance) return 1;
    if (entry.status === "UNACCOUNTED" && silentZones.has(entry.zoneId)) return 2;
    if (entry.status === "UNACCOUNTED") return 3;
    if (entry.status === "ASSISTED") return 4;
    return 5;
  };

  return [...entries].sort(
    (a, b) =>
      rank(a) - rank(b) || a.userName.localeCompare(b.userName) || a.userId.localeCompare(b.userId),
  );
}

/** Everyone not yet confirmed accounted for, in sweep priority order. */
export function outstandingAttendees(entries: RollCallEntry[]): RollCallEntry[] {
  return prioritiseRoster(entries).filter((entry) => !isAccounted(entry.status));
}

/**
 * The artefact the university safety office asks for after the event: a
 * complete record of who was inside, what happened to them, and who signed
 * off on each decision.
 */
export function buildIncidentReport(
  incidentId: string,
  declaredAt: string,
  entries: RollCallEntry[],
  closedAt: string | null = null,
): IncidentReport {
  return {
    incidentId,
    declaredAt,
    closedAt,
    tally: calculateTally(entries),
    outstanding: outstandingAttendees(entries),
    auditTrail: [...entries]
      .sort((a, b) => a.userName.localeCompare(b.userName) || a.userId.localeCompare(b.userId))
      .map((entry) => ({
        userId: entry.userId,
        userName: entry.userName,
        finalStatus: entry.status,
        markedBy: entry.markedBy,
        markedAt: entry.markedAt,
      })),
  };
}

/**
 * An incident may only be closed once every attendee is accounted for. This is
 * a deliberate guard: closing with people outstanding is exactly the mistake
 * that must not be one tap away.
 */
export function canCloseIncident(entries: RollCallEntry[]): {
  canClose: boolean;
  blockers: string[];
} {
  const outstanding = outstandingAttendees(entries);

  return {
    canClose: entries.length > 0 && outstanding.length === 0,
    blockers: outstanding.map(
      (entry) =>
        `${entry.userName} is still ${entry.status.toLowerCase()} in zone ${entry.zoneId}.`,
    ),
  };
}
