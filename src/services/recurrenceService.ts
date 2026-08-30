/**
 * Recurrence Service
 * Parses RFC 5545 RRULE strings and generates event instances.
 * Uses the `rrule` library (already installed) for parsing.
 */

import { RRule, Weekday } from "rrule";

export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly";
export type DayOfWeek = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  days?: DayOfWeek[]; // for weekly/biweekly
  interval: number; // e.g. every 2 weeks
  count?: number; // total instances (or use until)
  until?: Date; // end date for the series
}

const DAY_MAP: Record<string, Weekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

const FREQ_MAP: Record<RecurrenceFrequency, RRule.Frequency> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  biweekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
};

const DAY_LABELS: Record<DayOfWeek, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

const FREQ_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

/**
 * Build an RRULE string from a structured config.
 */
export function buildRRule(config: RecurrenceConfig, dtStart: Date): string {
  const opts: Parameters<typeof RRule>[0] = {
    freq: FREQ_MAP[config.frequency],
    dtstart: dtStart,
    interval: config.frequency === "biweekly" ? 2 : config.interval || 1,
  };

  if (
    config.days &&
    config.days.length > 0 &&
    (config.frequency === "weekly" || config.frequency === "biweekly")
  ) {
    opts.byweekday = config.days.map((d) => DAY_MAP[d]);
  }

  if (config.count) {
    opts.count = config.count;
  } else if (config.until) {
    opts.until = config.until;
  } else {
    // Default: 12 instances max to prevent runaway series
    opts.count = 12;
  }

  const rule = new RRule(opts);
  return rule.toString();
}

/**
 * Parse an RRULE string and return all occurrences as Date objects.
 */
export function parseRRule(rruleStr: string, dtStart: Date, maxInstances = 52): Date[] {
  try {
    const rule = RRule.fromString(`RRULE:${rruleStr.replace(/^RRULE:/, "")}`);
    // Override dtstart if the rule doesn't have one
    const ruleWithStart = new RRule({
      ...rule.options,
      dtstart,
    });
    return ruleWithStart.all((_, i) => i < maxInstances);
  } catch {
    return [];
  }
}

/**
 * Generate projected event instance payloads for the database.
 * Returns objects ready for insertion into the events table.
 */
export function generateInstances(
  parentEvent: {
    title: string;
    description: string | null;
    location: string | null;
    banner_url: string | null;
    club_id: string | null;
    created_by: string;
    category_id: string | null;
    tags: string[];
  },
  rruleStr: string,
  dtStart: Date,
  durationMs: number,
  maxInstances = 52,
): Array<{
  title: string;
  description: string | null;
  location: string | null;
  banner_url: string | null;
  event_date: string;
  start_date: string;
  end_date: string;
  club_id: string | null;
  created_by: string;
  category_id: string | null;
  tags: string[];
  recurrence_index: number;
}> {
  const dates = parseRRule(rruleStr, dtStart, maxInstances);

  return dates.map((date, index) => {
    const startDate = date.toISOString();
    const endDate = new Date(date.getTime() + durationMs).toISOString();

    return {
      title: parentEvent.title,
      description: parentEvent.description,
      location: parentEvent.location,
      banner_url: parentEvent.banner_url,
      event_date: startDate,
      start_date: startDate,
      end_date: endDate,
      club_id: parentEvent.club_id,
      created_by: parentEvent.created_by,
      category_id: parentEvent.category_id,
      tags: parentEvent.tags,
      recurrence_index: index,
    };
  });
}

/**
 * Human-readable summary of a recurrence config.
 */
export function getRecurrenceSummary(config: RecurrenceConfig): string {
  const freq = FREQ_LABELS[config.frequency];
  const interval = config.frequency === "biweekly" ? 2 : config.interval || 1;

  let summary = interval > 1 ? `Every ${interval} ${freq.toLowerCase()}s` : freq;

  if (config.days && config.days.length > 0) {
    const dayNames = config.days.map((d) => DAY_LABELS[d]).join(", ");
    summary += ` on ${dayNames}`;
  }

  if (config.count) {
    summary += ` · ${config.count} instances`;
  } else if (config.until) {
    summary += ` · until ${config.until.toLocaleDateString()}`;
  }

  return summary;
}

/**
 * Check if a given RRULE string is valid.
 */
export function isValidRRule(rruleStr: string): boolean {
  try {
    RRule.fromString(`RRULE:${rruleStr.replace(/^RRULE:/, "")}`);
    return true;
  } catch {
    return false;
  }
}
