export type CampusCalendarEventType = "holiday" | "exam_period" | "admin";

export interface ParsedCampusCalendarEvent {
  sourceUid: string;
  title: string;
  startDate: string;
  endDate: string;
  type: CampusCalendarEventType;
}

function unfoldIcsLines(ics: string): string[] {
  const physicalLines = ics.replace(/\r\n?/g, "\n").split("\n");
  const lines: string[] = [];

  for (const line of physicalLines) {
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  return lines;
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function propertyValue(line: string): string {
  const separator = line.indexOf(":");
  return separator === -1 ? "" : unescapeIcsText(line.slice(separator + 1));
}

function propertyName(line: string): string {
  return (line.split(":", 1)[0]?.split(";", 1)[0] ?? "").toUpperCase();
}

function parseIcsDate(line: string): Date | null {
  const value = propertyValue(line);
  const isDateOnly = /^\d{8}$/.test(value);
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;

  const [, year, month, day, hour = "00", minute = "00", second = "00", utc] = match;
  const date =
    utc || isDateOnly
      ? new Date(
          Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
          ),
        )
      : new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second),
        );

  return Number.isNaN(date.getTime()) ? null : date;
}

function classifyCalendarEvent(title: string): CampusCalendarEventType {
  const normalized = title.toLowerCase();
  if (/(final|midterm|exam|reading|dead week)/.test(normalized)) return "exam_period";
  if (/(break|holiday|no class|recess|vacation)/.test(normalized)) return "holiday";
  return "admin";
}

export function parseAcademicCalendarIcs(ics: string): ParsedCampusCalendarEvent[] {
  const events: ParsedCampusCalendarEvent[] = [];
  let current: Record<string, string> | null = null;

  const flush = () => {
    if (!current) return;
    const sourceUid = current.UID;
    const title = current.SUMMARY;
    const startLine = current.DTSTART_LINE;
    const endLine = current.DTEND_LINE;
    if (!sourceUid || !title || !startLine) return;

    const start = parseIcsDate(startLine);
    const end = endLine ? parseIcsDate(endLine) : start;
    if (!start || !end) return;

    // All-day ICS DTEND values are exclusive. Convert them to an inclusive
    // end timestamp so a warning also appears on the final day of a break.
    const endDate = /^DTEND;VALUE=DATE:/i.test(endLine ?? "") ? new Date(end.getTime() - 1) : end;
    if (endDate < start) return;

    events.push({
      sourceUid,
      title,
      startDate: start.toISOString(),
      endDate: endDate.toISOString(),
      type: classifyCalendarEvent(title),
    });
  };

  for (const line of   return events;
}

export type RestrictedDateCategory = "MIDTERMS" | "FINALS" | "READING_DAYS";

/**
 * Narrower classification than classifyCalendarEvent(), used to decide which
 * synced events also belong in the `restricted_dates` table (#3890).
 */
export function classifyRestrictedCategory(title: string): RestrictedDateCategory | null {
  const normalized = title.toLowerCase();
  if (/final/.test(normalized)) return "FINALS";
  if (/midterm/.test(normalized)) return "MIDTERMS";
  if (/(reading day|reading week|dead week)/.test(normalized)) return "READING_DAYS";
  return null;
}unfoldIcsLines(ics)) {
    const name = propertyName(line);
    if (name === "BEGIN" && propertyValue(line).toUpperCase() === "VEVENT") {
      current = {};
    } else if (name === "END" && propertyValue(line).toUpperCase() === "VEVENT") {
      flush();
      current = null;
    } else if (
      current &&
      (name === "UID" || name === "SUMMARY" || name === "DTSTART" || name === "DTEND")
    ) {
      current[name === "DTSTART" ? "DTSTART_LINE" : name === "DTEND" ? "DTEND_LINE" : name] =
        name === "UID" || name === "SUMMARY" ? propertyValue(line) : line;
    }
  }

  return events;
}
