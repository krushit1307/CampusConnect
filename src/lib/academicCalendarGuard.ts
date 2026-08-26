/**
 * Academic Calendar Blackout Guard (#3137).
 *
 * Validates a proposed event window against the institution's academic
 * calendar before the event is published, so clubs stop scheduling socials
 * into the middle of finals week.
 *
 * All comparisons are made on calendar dates in the institution's timezone
 * rather than on raw UTC timestamps. An event at 23:00 local on the last day
 * before an exam period must not be classified as falling inside it because
 * UTC has already rolled over into the next day.
 */

export type AcademicPeriodType =
  "TERM" | "READING_WEEK" | "EXAM_PERIOD" | "CLOSURE" | "ORIENTATION" | "HOLIDAY";

/**
 * Severity of a period. A hard block on everything gets ignored or worked
 * around, so the calendar grades its rules instead.
 */
export type EnforcementLevel = "BLOCKED" | "WARN" | "INFO";

export type GuardDecision = "ALLOWED" | "WARN" | "BLOCKED";

/** Enforcement applied when a period does not override it explicitly. */
export const DEFAULT_ENFORCEMENT: Record<AcademicPeriodType, EnforcementLevel> = {
  EXAM_PERIOD: "BLOCKED",
  CLOSURE: "BLOCKED",
  READING_WEEK: "WARN",
  ORIENTATION: "INFO",
  HOLIDAY: "INFO",
  TERM: "INFO",
};

/**
 * Event categories that are always permitted, even inside a blocked period.
 * A study session or a wellbeing drop-in during exam week is exactly the kind
 * of event students need most; blocking it would be the opposite of the point.
 */
export const DEFAULT_EXEMPT_CATEGORIES: ReadonlyArray<string> = [
  "study-session",
  "wellbeing",
  "academic-support",
  "welfare",
];

export interface QuietHours {
  /** Local hour the quiet window opens, 0-23. */
  startHour: number;
  /** Local hour the quiet window closes, 0-23. May wrap past midnight. */
  endHour: number;
}

export interface AcademicPeriod {
  id: string;
  name: string;
  type: AcademicPeriodType;
  /** Inclusive calendar date, YYYY-MM-DD, in the institution's timezone. */
  startDate: string;
  /** Inclusive calendar date, YYYY-MM-DD. */
  endDate: string;
  /** Overrides the default enforcement for this period type. */
  enforcement?: EnforcementLevel;
  /** Hours during which no event may run, regardless of the period severity. */
  quietHours?: QuietHours;
}

export interface EventWindow {
  startsAt: string;
  endsAt: string;
  /** Used to match against the exemption list. */
  category?: string;
}

export interface PeriodConflict {
  periodId: string;
  periodName: string;
  periodType: AcademicPeriodType;
  enforcement: EnforcementLevel;
  /** First and last overlapping calendar dates, in the institution's timezone. */
  overlapStartDate: string;
  overlapEndDate: string;
  overlapDays: number;
  /** True when the conflict was raised by the quiet-hours rule specifically. */
  violatesQuietHours: boolean;
  message: string;
}

export interface AlternativeWindow {
  startsAt: string;
  endsAt: string;
  label: string;
}

export interface GuardResult {
  decision: GuardDecision;
  conflicts: PeriodConflict[];
  /** Set when an exemption downgraded what would otherwise have been a block. */
  exemptionApplied: boolean;
  /** Nearest viable windows either side of the blocking period. */
  alternatives: AlternativeWindow[];
  summary: string;
}

export interface GuardOptions {
  /** IANA timezone of the institution. Defaults to UTC. */
  timeZone?: string;
  exemptCategories?: ReadonlyArray<string>;
}

const MS_PER_DAY = 86_400_000;

/**
 * Calendar date and hour of an instant, as observed in the given timezone.
 * Intl is used rather than manual offset arithmetic so daylight saving is
 * handled correctly without pulling in a date library.
 */
export function zonedParts(iso: string, timeZone = "UTC"): { date: string; hour: number } {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Invalid timestamp: ${iso}`);
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(instant);
  const lookup = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${lookup("year")}-${lookup("month")}-${lookup("day")}`,
    hour: Number.parseInt(lookup("hour"), 10),
  };
}

/** Days between two YYYY-MM-DD dates, inclusive of both ends. */
export function inclusiveDayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/** Shifts a YYYY-MM-DD date by a whole number of days. */
export function shiftDate(date: string, days: number): string {
  const base = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(base)) return date;
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Expands an hour window into the concrete hours it covers, wrapping midnight. */
function expandHours(startHour: number, endHour: number): Set<number> {
  const hours = new Set<number>();
  let cursor = startHour % 24;

  // A window that ends on the hour it starts is treated as a single hour.
  for (let step = 0; step <= 24; step += 1) {
    hours.add(cursor);
    if (cursor === endHour % 24) break;
    cursor = (cursor + 1) % 24;
  }

  return hours;
}

/** Whether an event's local hours touch a quiet window. */
export function intersectsQuietHours(
  eventStartHour: number,
  eventEndHour: number,
  quiet: QuietHours,
): boolean {
  const quietSet = expandHours(quiet.startHour, quiet.endHour);
  const eventSet = expandHours(eventStartHour, eventEndHour);

  for (const hour of eventSet) {
    if (quietSet.has(hour)) return true;
  }
  return false;
}

/** Enforcement in force for a period, falling back to the type default. */
export function enforcementFor(period: AcademicPeriod): EnforcementLevel {
  return period.enforcement ?? DEFAULT_ENFORCEMENT[period.type] ?? "INFO";
}

const SEVERITY_ORDER: Record<EnforcementLevel, number> = { INFO: 0, WARN: 1, BLOCKED: 2 };

/**
 * Every academic period the proposed window touches, with the actual
 * overlapping span. An event that starts the evening before an exam period and
 * runs into it is caught here; testing only the start date would miss it.
 */
export function findOverlappingPeriods(
  window: EventWindow,
  periods: AcademicPeriod[],
  options: GuardOptions = {},
): PeriodConflict[] {
  const timeZone = options.timeZone ?? "UTC";
  const start = zonedParts(window.startsAt, timeZone);
  const end = zonedParts(window.endsAt, timeZone);

  const conflicts: PeriodConflict[] = [];

  for (const period of periods) {
    // Inclusive date-range overlap. ISO dates compare correctly as strings.
    if (start.date > period.endDate || end.date < period.startDate) continue;

    const overlapStartDate = start.date > period.startDate ? start.date : period.startDate;
    const overlapEndDate = end.date < period.endDate ? end.date : period.endDate;

    const violatesQuietHours = period.quietHours
      ? intersectsQuietHours(start.hour, end.hour, period.quietHours)
      : false;

    // The quiet-hours rule escalates the period's own severity: a 2am social
    // during finals is blocked even when the surrounding period is only a warn.
    const baseEnforcement = enforcementFor(period);
    const enforcement: EnforcementLevel = violatesQuietHours ? "BLOCKED" : baseEnforcement;

    conflicts.push({
      periodId: period.id,
      periodName: period.name,
      periodType: period.type,
      enforcement,
      overlapStartDate,
      overlapEndDate,
      overlapDays: inclusiveDayCount(overlapStartDate, overlapEndDate),
      violatesQuietHours,
      message: violatesQuietHours
        ? `Overlaps ${period.name} during its quiet hours (${period.quietHours!.startHour}:00-${period.quietHours!.endHour}:00).`
        : `Overlaps ${period.name} for ${inclusiveDayCount(overlapStartDate, overlapEndDate)} day(s).`,
    });
  }

  return conflicts.sort(
    (a, b) =>
      SEVERITY_ORDER[b.enforcement] - SEVERITY_ORDER[a.enforcement] ||
      a.overlapStartDate.localeCompare(b.overlapStartDate) ||
      a.periodId.localeCompare(b.periodId),
  );
}

/**
 * Nearest viable windows either side of the blocking period, preserving the
 * event's original duration and local time of day. Returning these turns a
 * rejection into a one-click fix rather than a guessing game.
 */
export function suggestAlternatives(
  window: EventWindow,
  blockingPeriods: AcademicPeriod[],
  options: GuardOptions = {},
): AlternativeWindow[] {
  if (blockingPeriods.length === 0) return [];

  const timeZone = options.timeZone ?? "UTC";
  const startParts = zonedParts(window.startsAt, timeZone);
  const durationMs = new Date(window.endsAt).getTime() - new Date(window.startsAt).getTime();

  const earliestStart = blockingPeriods
    .map((period) => period.startDate)
    .sort((a, b) => a.localeCompare(b))[0];
  const latestEnd = blockingPeriods
    .map((period) => period.endDate)
    .sort((a, b) => b.localeCompare(a))[0];

  const alternatives: AlternativeWindow[] = [];

  const buildWindow = (targetDate: string, label: string): AlternativeWindow => {
    // Keep the original time of day by shifting the whole window by whole days.
    const dayDelta = Math.round(
      (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${startParts.date}T00:00:00Z`)) /
        MS_PER_DAY,
    );
    const newStart = new Date(new Date(window.startsAt).getTime() + dayDelta * MS_PER_DAY);
    return {
      startsAt: newStart.toISOString(),
      endsAt: new Date(newStart.getTime() + durationMs).toISOString(),
      label,
    };
  };

  alternatives.push(buildWindow(shiftDate(earliestStart, -1), "Last clear day before the period"));
  alternatives.push(buildWindow(shiftDate(latestEnd, 1), "First clear day after the period"));

  return alternatives;
}

/**
 * Full evaluation of a proposed event window.
 *
 * Exempt categories downgrade a block rather than skipping the check outright,
 * so the organiser still sees that the event lands in exam week - they just
 * are not stopped from running it.
 */
export function evaluateEventWindow(
  window: EventWindow,
  periods: AcademicPeriod[],
  options: GuardOptions = {},
): GuardResult {
  const exemptCategories = options.exemptCategories ?? DEFAULT_EXEMPT_CATEGORIES;
  const isExempt =
    window.category !== undefined &&
    exemptCategories.some((category) => category.toLowerCase() === window.category!.toLowerCase());

  const rawConflicts = findOverlappingPeriods(window, periods, options);

  const conflicts = isExempt
    ? rawConflicts.map((conflict) =>
        conflict.enforcement === "BLOCKED"
          ? {
              ...conflict,
              enforcement: "INFO" as EnforcementLevel,
              message: `${conflict.message} Permitted because "${window.category}" is an exempt category.`,
            }
          : conflict,
      )
    : rawConflicts;

  const exemptionApplied = isExempt && rawConflicts.some((c) => c.enforcement === "BLOCKED");

  let decision: GuardDecision = "ALLOWED";
  if (conflicts.some((c) => c.enforcement === "BLOCKED")) {
    decision = "BLOCKED";
  } else if (conflicts.some((c) => c.enforcement === "WARN")) {
    decision = "WARN";
  }

  const blockingPeriods =
    decision === "BLOCKED"
      ? periods.filter((period) =>
          conflicts.some((c) => c.periodId === period.id && c.enforcement === "BLOCKED"),
        )
      : [];

  return {
    decision,
    conflicts,
    exemptionApplied,
    alternatives: suggestAlternatives(window, blockingPeriods, options),
    summary: buildSummary(decision, conflicts, exemptionApplied),
  };
}

function buildSummary(
  decision: GuardDecision,
  conflicts: PeriodConflict[],
  exemptionApplied: boolean,
): string {
  if (conflicts.length === 0) {
    return "No academic calendar conflicts.";
  }

  const names = conflicts.map((c) => c.periodName).join(", ");

  if (decision === "BLOCKED") {
    return `Cannot be scheduled: conflicts with ${names}.`;
  }
  if (decision === "WARN") {
    return `Scheduling is discouraged: overlaps ${names}.`;
  }
  if (exemptionApplied) {
    return `Permitted by category exemption despite overlapping ${names}.`;
  }
  return `Overlaps ${names}.`;
}
