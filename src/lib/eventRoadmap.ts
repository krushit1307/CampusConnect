export interface EventSession {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  track: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
}

export interface RoadmapCalendarSession {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  starts_at: string;
  ends_at: string;
}

export interface TimelineWindow {
  start: number;
  end: number;
  duration: number;
}

export function getTimelineWindow(sessions: EventSession[]): TimelineWindow | null {
  const timestamps = sessions.flatMap((session) => [
    Date.parse(session.starts_at),
    Date.parse(session.ends_at),
  ]);
  const validTimestamps = timestamps.filter(Number.isFinite);
  if (validTimestamps.length === 0) return null;

  const start = Math.min(...validTimestamps);
  const end = Math.max(...validTimestamps);
  return { start, end, duration: Math.max(end - start, 60 * 60 * 1000) };
}

export function getTimelinePosition(
  session: Pick<EventSession, "starts_at" | "ends_at">,
  window: TimelineWindow,
) {
  const start = Date.parse(session.starts_at);
  const end = Date.parse(session.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { left: 0, width: 0 };
  }

  const left = ((start - window.start) / window.duration) * 100;
  const width = ((end - start) / window.duration) * 100;
  return {
    left: Math.max(0, Math.min(left, 100)),
    width: Math.max(1.5, Math.min(width, 100 - Math.max(0, left))),
  };
}

export function getSessionDayKey(session: Pick<EventSession, "starts_at">) {
  const date = new Date(session.starts_at);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

export function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatSessionDay(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Unknown day";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function sessionsOverlap(
  first: Pick<EventSession, "starts_at" | "ends_at">,
  second: Pick<EventSession, "starts_at" | "ends_at">,
) {
  const firstStart = Date.parse(first.starts_at);
  const firstEnd = Date.parse(first.ends_at);
  const secondStart = Date.parse(second.starts_at);
  const secondEnd = Date.parse(second.ends_at);
  if (![firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite)) return false;
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function findScheduleConflict(session: EventSession, selectedSessions: EventSession[]) {
  const conflict = selectedSessions.find(
    (selected) => selected.id !== session.id && sessionsOverlap(session, selected),
  );
  if (!conflict) return null;
  return `This overlaps with “${conflict.title}” (${formatSessionTime(conflict.starts_at)}–${formatSessionTime(conflict.ends_at)}).`;
}

function formatUtcCompact(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function getRoadmapIcsContent(eventTitle: string, sessions: RoadmapCalendarSession[]) {
  const validSessions = sessions.filter(
    (session) => formatUtcCompact(session.starts_at) && formatUtcCompact(session.ends_at),
  );
  if (validSessions.length === 0) return null;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CampusConnect//Event Roadmap//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const session of validSessions) {
    const start = formatUtcCompact(session.starts_at);
    const end = formatUtcCompact(session.ends_at);
    if (!start || !end) continue;
    const description = [session.description?.trim(), `Event: ${eventTitle}`]
      .filter(Boolean)
      .join("\n\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${session.id}@campusconnect.app`,
      `DTSTAMP:${formatUtcCompact(new Date().toISOString())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcsText(session.title)}`,
      ...(description ? [`DESCRIPTION:${escapeIcsText(description)}`] : []),
      ...(session.location ? [`LOCATION:${escapeIcsText(session.location)}`] : []),
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadRoadmapIcs(eventTitle: string, sessions: RoadmapCalendarSession[]) {
  const content = getRoadmapIcsContent(eventTitle, sessions);
  if (!content) return false;

  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    eventTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event-roadmap"
  }.ics`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
