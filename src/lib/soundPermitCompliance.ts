/**
 * Amplified Sound Permit & Noise Curfew Compliance (#3399).
 *
 * `eventLogisticsRuleEngine.ts` knows about campus security forms and catering.
 * Nothing in the codebase knows about noise, which is the most reliably
 * enforced constraint on an outdoor campus event and the one students most
 * reliably discover too late — either because the permit window closed a week
 * ago, or because campus police stop the set at 21:00.
 *
 * Both outcomes are predictable at the moment the event is created, from data
 * the platform already holds: the venue, the times, and the academic calendar.
 *
 * Four limits stack, and they are not the same thing as each other:
 *
 *   - municipal ordinance hours, which differ on a weekend;
 *   - a campus quiet zone, where a lawn twenty metres from a residence hall is
 *     stricter than an open field, and a library is restricted all day rather
 *     than only at night;
 *   - exam-period silence, which runs to a different calendar entirely and is
 *     usually absolute;
 *   - the permit deadline, which is the part that cannot be fixed afterwards.
 *
 * The academic calendar is consumed from `academicCalendarGuard.ts` rather than
 * restated here. A second, drifting copy of the term dates would be worse than
 * no copy at all.
 */

import type { AcademicPeriod } from "./academicCalendarGuard";

export type NoiseZone =
  | "OPEN_FIELD"
  | "RESIDENTIAL_ADJACENT"
  | "ACADEMIC_ADJACENT"
  | "LIBRARY_ADJACENT"
  | "INDOOR_ISOLATED";

export type DayType = "WEEKNIGHT" | "WEEKEND" | "EXAM_PERIOD";

export type ReceptorType = "RESIDENCE" | "LIBRARY" | "ACADEMIC_BUILDING" | "NONE";

export type PermitStatus =
  "NOT_REQUIRED" | "SUBMITTED_IN_TIME" | "DEADLINE_PASSED" | "NOT_SUBMITTED";

export type ComplianceVerdict =
  | "COMPLIANT"
  /** Runs past the permitted hours; the end time can be moved. */
  | "EXCEEDS_PERMITTED_HOURS"
  /** Too loud at the receptor; the level or the distance can be changed. */
  | "EXCEEDS_SOUND_LIMIT"
  /** No amplified sound is permitted here at this time at all. */
  | "PROHIBITED_PERIOD"
  /** Recoverable failures aside, the paperwork can no longer be filed. */
  | "PERMIT_DEADLINE_MISSED";

/** Minutes from local midnight. 1440 is the end of the day. */
export interface PermittedWindow {
  startMinute: number;
  endMinute: number;
}

export interface ZoneProfile {
  zone: NoiseZone;
  label: string;
  /** A null window means no amplified sound is permitted at all on that day type. */
  windows: Record<DayType, PermittedWindow | null>;
  /** Maximum sound level permitted at the receptor, in dBA. */
  ceilingDb: number;
  /** Typical distance from a stage in this zone to the nearest sensitive receptor. */
  receptorDistanceMetres: number;
  /** Calendar days of notice the permit office needs. Zero means no permit. */
  permitLeadDays: number;
}

const HOUR = 60;

/**
 * Noise profiles by zone.
 *
 * A single campus-wide curfew is simultaneously too strict for an open field
 * at the edge of campus and far too lax for a lawn outside a residence hall
 * during exams, which is how organisers learn to ignore it. These are the
 * shapes institutions actually use; the table is exported so a campus can
 * substitute its own ordinance.
 */
export const ZONE_PROFILES: Record<NoiseZone, ZoneProfile> = {
  OPEN_FIELD: {
    zone: "OPEN_FIELD",
    label: "Open field / far from buildings",
    windows: {
      WEEKNIGHT: { startMinute: 8 * HOUR, endMinute: 22 * HOUR },
      WEEKEND: { startMinute: 8 * HOUR, endMinute: 23 * HOUR },
      EXAM_PERIOD: null,
    },
    ceilingDb: 75,
    receptorDistanceMetres: 50,
    permitLeadDays: 10,
  },
  RESIDENTIAL_ADJACENT: {
    zone: "RESIDENTIAL_ADJACENT",
    label: "Adjacent to residence halls",
    windows: {
      WEEKNIGHT: { startMinute: 9 * HOUR, endMinute: 21 * HOUR },
      WEEKEND: { startMinute: 9 * HOUR, endMinute: 22 * HOUR },
      EXAM_PERIOD: null,
    },
    ceilingDb: 60,
    receptorDistanceMetres: 20,
    permitLeadDays: 14,
  },
  ACADEMIC_ADJACENT: {
    zone: "ACADEMIC_ADJACENT",
    label: "Adjacent to teaching space",
    windows: {
      // Teaching runs through the day, so amplification waits until the
      // evening rather than being permitted from breakfast.
      WEEKNIGHT: { startMinute: 17 * HOUR, endMinute: 22 * HOUR },
      WEEKEND: { startMinute: 9 * HOUR, endMinute: 22 * HOUR },
      EXAM_PERIOD: null,
    },
    ceilingDb: 65,
    receptorDistanceMetres: 25,
    permitLeadDays: 14,
  },
  LIBRARY_ADJACENT: {
    zone: "LIBRARY_ADJACENT",
    label: "Adjacent to the library",
    windows: {
      // The library restriction applies all day, not only at night, which is
      // the case a single evening curfew gets wrong.
      WEEKNIGHT: null,
      WEEKEND: { startMinute: 12 * HOUR, endMinute: 18 * HOUR },
      EXAM_PERIOD: null,
    },
    ceilingDb: 55,
    receptorDistanceMetres: 15,
    permitLeadDays: 14,
  },
  INDOOR_ISOLATED: {
    zone: "INDOOR_ISOLATED",
    label: "Indoor, acoustically isolated",
    windows: {
      WEEKNIGHT: { startMinute: 8 * HOUR, endMinute: 23 * HOUR },
      WEEKEND: { startMinute: 8 * HOUR, endMinute: 24 * HOUR },
      EXAM_PERIOD: { startMinute: 8 * HOUR, endMinute: 22 * HOUR },
    },
    ceilingDb: 90,
    receptorDistanceMetres: 30,
    permitLeadDays: 0,
  },
};

export const ALL_ZONES: ReadonlyArray<NoiseZone> = Object.keys(ZONE_PROFILES) as NoiseZone[];

export interface SoundEvent {
  eventId: string;
  startsAt: string;
  endsAt: string;
  zone: NoiseZone;
  /** Whether amplification is used at all. Without it none of this applies. */
  amplified: boolean;
  /** Sound level produced at the reference distance below, in dBA. */
  sourceLevelDb?: number;
  /** Distance the source level is quoted at. Front-of-house is typically 10m. */
  sourceReferenceMetres?: number;
  /** Overrides the zone's typical receptor distance for this specific site. */
  receptorDistanceMetres?: number;
  /** When the permit application was filed, if it has been. */
  permitSubmittedAt?: string | null;
}

export interface WindowFinding {
  dayType: DayType;
  permitted: PermittedWindow | null;
  nonCompliantMinutes: number;
  /** The latest end time at which the whole event would be compliant. */
  latestCompliantEnd: string | null;
}

export interface LevelFinding {
  sourceLevelDb: number;
  levelAtReceptorDb: number;
  ceilingDb: number;
  excessDb: number;
  /** Distance at which the current source level would meet the ceiling. */
  compliantDistanceMetres: number;
}

export interface PermitFinding {
  required: boolean;
  leadDays: number;
  deadline: string | null;
  status: PermitStatus;
}

export interface SoundComplianceResult {
  verdict: ComplianceVerdict;
  compliant: boolean;
  zone: NoiseZone;
  window: WindowFinding;
  level: LevelFinding | null;
  permit: PermitFinding;
  /** Concrete fixes rather than a restatement of the fault. */
  remedies: string[];
  reasons: string[];
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

function toTime(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * The institution's UTC offset at a given instant, in minutes.
 *
 * Derived from the instant rather than assumed, so an event either side of a
 * daylight-saving change is measured against the curfew that actually applied
 * on the night.
 */
function offsetMinutesAt(instantMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(new Date(instantMs));
  const value = (type: string) =>
    Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );

  return (asUtc - instantMs) / MS_PER_MINUTE;
}

/** Local calendar date, YYYY-MM-DD, for an instant. */
export function localDateKey(iso: string, timeZone = "UTC"): string {
  const instantMs = toTime(iso);
  const shifted = instantMs + offsetMinutesAt(instantMs, timeZone) * MS_PER_MINUTE;
  return new Date(shifted).toISOString().slice(0, 10);
}

/** Minutes since local midnight for an instant. */
export function localMinuteOfDay(iso: string, timeZone = "UTC"): number {
  const instantMs = toTime(iso);
  const shifted = new Date(instantMs + offsetMinutesAt(instantMs, timeZone) * MS_PER_MINUTE);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/**
 * The instant corresponding to a local date and minute-of-day.
 *
 * Two passes, because the offset used to convert may itself change across the
 * boundary being converted. Without the correction an event on a clock-change
 * night is measured an hour out, which is exactly when a curfew dispute happens.
 */
function instantFromLocal(dateKey: string, minuteOfDay: number, timeZone: string): number {
  const naive = Date.parse(`${dateKey}T00:00:00Z`) + minuteOfDay * MS_PER_MINUTE;
  const firstGuess = naive - offsetMinutesAt(naive, timeZone) * MS_PER_MINUTE;
  const correctedOffset = offsetMinutesAt(firstGuess, timeZone);
  return naive - correctedOffset * MS_PER_MINUTE;
}

function nextDateKey(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Maps a distance to a sensitive receptor onto a zone.
 *
 * Distance is the real driver, so the zone can be derived rather than only
 * hand-assigned. A stage placed fifteen metres from a residence hall is in a
 * residential zone whatever the venue record calls it.
 */
export function zoneForDistance(metres: number, receptor: ReceptorType): NoiseZone {
  if (receptor === "NONE" || metres >= 100) return "OPEN_FIELD";
  if (receptor === "LIBRARY") return "LIBRARY_ADJACENT";
  if (receptor === "RESIDENCE") return metres <= 50 ? "RESIDENTIAL_ADJACENT" : "OPEN_FIELD";
  return metres <= 50 ? "ACADEMIC_ADJACENT" : "OPEN_FIELD";
}

/**
 * Which set of hours applies on a given local date.
 *
 * Exam periods come from the academic calendar the platform already keeps, so
 * moving an exam period moves the noise restriction with it.
 */
export function classifyDay(
  dateKey: string,
  periods: ReadonlyArray<AcademicPeriod> = [],
  reading = true,
): DayType {
  const inExam = periods.some(
    (period) =>
      (period.type === "EXAM_PERIOD" || (reading && period.type === "READING_WEEK")) &&
      dateKey >= period.startDate &&
      dateKey <= period.endDate,
  );

  if (inExam) return "EXAM_PERIOD";

  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  // Friday and Saturday nights carry the weekend allowance, since that is the
  // night the extra hour is actually wanted.
  return day === 5 || day === 6 ? "WEEKEND" : "WEEKNIGHT";
}

/** The permitted window for a zone on a given day type. */
export function permittedWindow(zone: NoiseZone, dayType: DayType): PermittedWindow | null {
  return ZONE_PROFILES[zone].windows[dayType];
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return end > start ? (end - start) / MS_PER_MINUTE : 0;
}

/**
 * How much of the event falls outside the permitted hours, and the latest end
 * time that would fix it.
 *
 * Reporting the overlap rather than a yes/no is the difference between "your
 * event is non-compliant" and "you are ninety minutes over; finish at 22:00" —
 * only one of which an organiser can act on. An event spanning several days is
 * evaluated day by day, since the day type can change underneath it.
 */
export function evaluateHours(
  event: SoundEvent,
  periods: ReadonlyArray<AcademicPeriod> = [],
  timeZone = "UTC",
): WindowFinding {
  const startMs = toTime(event.startsAt);
  const endMs = toTime(event.endsAt);
  const totalMinutes = Math.max(0, (endMs - startMs) / MS_PER_MINUTE);

  const startDate = localDateKey(event.startsAt, timeZone);
  const endDate = localDateKey(event.endsAt, timeZone);

  let permittedMinutes = 0;
  let latestCompliantEnd: number = startMs;
  let contiguous = true;

  for (let dateKey = startDate; dateKey <= endDate; dateKey = nextDateKey(dateKey)) {
    const dayType = classifyDay(dateKey, periods);
    const window = permittedWindow(event.zone, dayType);
    if (!window) {
      contiguous = false;
      continue;
    }

    const windowStart = instantFromLocal(dateKey, window.startMinute, timeZone);
    const windowEnd = instantFromLocal(dateKey, window.endMinute, timeZone);

    permittedMinutes += overlapMinutes(startMs, endMs, windowStart, windowEnd);

    // The latest compliant end only extends while cover has been unbroken
    // from the event start; a permitted island after a prohibited gap does not
    // make the earlier part acceptable.
    if (contiguous && windowStart <= latestCompliantEnd && windowEnd > latestCompliantEnd) {
      latestCompliantEnd = Math.min(windowEnd, endMs);
    } else if (contiguous && windowStart > latestCompliantEnd) {
      contiguous = false;
    }
  }

  const nonCompliantMinutes = Math.max(0, Math.round(totalMinutes - permittedMinutes));

  return {
    dayType: classifyDay(startDate, periods),
    permitted: permittedWindow(event.zone, classifyDay(startDate, periods)),
    nonCompliantMinutes,
    latestCompliantEnd:
      nonCompliantMinutes === 0 ? event.endsAt : new Date(latestCompliantEnd).toISOString(),
  };
}

/**
 * Sound level at a distance, given a level quoted at another distance.
 *
 * Inverse-square for a point source: 6 dB per doubling of distance. This is
 * deliberately an approximation — it ignores ground effect, barriers and
 * directivity — and it is documented as one. The goal is catching the event
 * that is 20 dB over, not replacing an acoustic survey.
 */
export function attenuate(sourceDb: number, fromMetres: number, toMetres: number): number {
  if (fromMetres <= 0 || toMetres <= 0) return sourceDb;
  return sourceDb - 20 * Math.log10(toMetres / fromMetres);
}

/** The distance at which a given source level would meet a ceiling. */
export function compliantDistance(sourceDb: number, fromMetres: number, ceilingDb: number): number {
  if (fromMetres <= 0) return fromMetres;
  return fromMetres * Math.pow(10, (sourceDb - ceilingDb) / 20);
}

/** How loud it is at the receptor, and by how much that misses. */
export function evaluateLevel(event: SoundEvent): LevelFinding | null {
  if (event.sourceLevelDb === undefined) return null;

  const profile = ZONE_PROFILES[event.zone];
  const from = event.sourceReferenceMetres ?? 10;
  const to = event.receptorDistanceMetres ?? profile.receptorDistanceMetres;

  const atReceptor = attenuate(event.sourceLevelDb, from, to);

  return {
    sourceLevelDb: event.sourceLevelDb,
    levelAtReceptorDb: Math.round(atReceptor * 10) / 10,
    ceilingDb: profile.ceilingDb,
    excessDb: Math.max(0, Math.round((atReceptor - profile.ceilingDb) * 10) / 10),
    compliantDistanceMetres:
      Math.round(compliantDistance(event.sourceLevelDb, from, profile.ceilingDb) * 10) / 10,
  };
}

/**
 * The last day a permit application can be filed for this event.
 *
 * Calendar days rather than business days, because permit deadlines are
 * published as "fourteen days before the event" and applying a different
 * arithmetic than the office does would produce a deadline that is wrong in
 * the direction that matters.
 */
export function permitDeadline(startsAt: string, leadDays: number): string | null {
  if (leadDays <= 0) return null;
  return new Date(toTime(startsAt) - leadDays * MS_PER_DAY).toISOString();
}

export function evaluatePermit(event: SoundEvent, now: string): PermitFinding {
  const profile = ZONE_PROFILES[event.zone];
  const deadline = permitDeadline(event.startsAt, profile.permitLeadDays);

  if (!event.amplified || profile.permitLeadDays === 0) {
    return { required: false, leadDays: profile.permitLeadDays, deadline, status: "NOT_REQUIRED" };
  }

  const base = { required: true, leadDays: profile.permitLeadDays, deadline };

  if (event.permitSubmittedAt) {
    const inTime = deadline === null || toTime(event.permitSubmittedAt) <= toTime(deadline);
    return { ...base, status: inTime ? "SUBMITTED_IN_TIME" : "DEADLINE_PASSED" };
  }

  if (deadline !== null && toTime(now) > toTime(deadline)) {
    return { ...base, status: "DEADLINE_PASSED" };
  }

  return { ...base, status: "NOT_SUBMITTED" };
}

/**
 * The whole check.
 *
 * A missed permit deadline outranks everything else because it is the only
 * failure here that cannot be fixed by changing the event: an end time can be
 * moved and a PA can be turned down, but last week cannot be revisited.
 */
export function evaluateSoundCompliance(params: {
  event: SoundEvent;
  periods?: ReadonlyArray<AcademicPeriod>;
  timeZone?: string;
  now: string;
}): SoundComplianceResult {
  const { event, now } = params;
  const periods = params.periods ?? [];
  const timeZone = params.timeZone ?? "UTC";

  const window = evaluateHours(event, periods, timeZone);
  const level = evaluateLevel(event);
  const permit = evaluatePermit(event, now);
  const profile = ZONE_PROFILES[event.zone];

  const reasons: string[] = [];
  const remedies: string[] = [];

  if (!event.amplified) {
    return {
      verdict: "COMPLIANT",
      compliant: true,
      zone: event.zone,
      window,
      level,
      permit,
      remedies: [],
      reasons: [],
    };
  }

  if (permit.status === "DEADLINE_PASSED") {
    reasons.push(
      `The amplified sound permit for a ${profile.label.toLowerCase()} site was due ` +
        `${profile.permitLeadDays} days before the event, by ${permit.deadline}.`,
    );
    remedies.push(
      "Ask the permit office whether a late application can be accepted; if not, the event runs unamplified.",
    );
    remedies.push("An indoor, acoustically isolated venue needs no permit at all.");

    return {
      verdict: "PERMIT_DEADLINE_MISSED",
      compliant: false,
      zone: event.zone,
      window,
      level,
      permit,
      remedies,
      reasons,
    };
  }

  const startDayType = classifyDay(localDateKey(event.startsAt, timeZone), periods);

  if (window.permitted === null && window.nonCompliantMinutes > 0) {
    reasons.push(
      startDayType === "EXAM_PERIOD"
        ? "No amplified sound is permitted during the exam period."
        : `No amplified sound is permitted in a ${profile.label.toLowerCase()} zone on a ${startDayType.toLowerCase()}.`,
    );
    remedies.push("Move the event to a weekend, an open field, or an isolated indoor venue.");

    return {
      verdict: "PROHIBITED_PERIOD",
      compliant: false,
      zone: event.zone,
      window,
      level,
      permit,
      remedies,
      reasons,
    };
  }

  if (window.nonCompliantMinutes > 0) {
    reasons.push(
      `${window.nonCompliantMinutes} minutes of the event fall outside the permitted hours for this zone.`,
    );
    if (window.latestCompliantEnd) {
      remedies.push(`Finish amplified sound by ${window.latestCompliantEnd}.`);
    }

    return {
      verdict: "EXCEEDS_PERMITTED_HOURS",
      compliant: false,
      zone: event.zone,
      window,
      level,
      permit,
      remedies,
      reasons,
    };
  }

  if (level && level.excessDb > 0) {
    reasons.push(
      `Estimated ${level.levelAtReceptorDb} dBA at the nearest receptor against a ${level.ceilingDb} dBA ceiling.`,
    );
    remedies.push(`Reduce the source level by ${level.excessDb} dB.`);
    remedies.push(
      `Alternatively move the stage to at least ${level.compliantDistanceMetres} m from the receptor.`,
    );

    return {
      verdict: "EXCEEDS_SOUND_LIMIT",
      compliant: false,
      zone: event.zone,
      window,
      level,
      permit,
      remedies,
      reasons,
    };
  }

  if (permit.status === "NOT_SUBMITTED") {
    remedies.push(`Submit the amplified sound permit application by ${permit.deadline}.`);
  }

  return {
    verdict: "COMPLIANT",
    compliant: true,
    zone: event.zone,
    window,
    level,
    permit,
    remedies,
    reasons,
  };
}

export interface PermitTask {
  ruleKey: string;
  title: string;
  description: string;
  isCritical: boolean;
  daysPriorToEvent: number;
}

/**
 * The permit application as a logistics task.
 *
 * Emitted in the shape `EVENT_LOGISTICS_RULES` already uses so it lands in the
 * task list organisers actually look at, rather than on a new surface nobody
 * has learned to check.
 */
export function soundPermitTask(event: SoundEvent): PermitTask | null {
  const profile = ZONE_PROFILES[event.zone];
  if (!event.amplified || profile.permitLeadDays === 0) return null;

  return {
    ruleKey: "amplified_sound_permit",
    title: "Submit Amplified Sound Permit Application",
    description:
      `Required for amplified sound in a ${profile.label.toLowerCase()} zone. ` +
      `The permit office needs ${profile.permitLeadDays} days' notice, and a late ` +
      `application cannot be backdated.`,
    isCritical: true,
    daysPriorToEvent: profile.permitLeadDays,
  };
}
