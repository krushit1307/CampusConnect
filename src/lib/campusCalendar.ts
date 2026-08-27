export type CampusCalendarEventType = "holiday" | "exam_period" | "admin";

export interface CampusCalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  type: CampusCalendarEventType;
}

export function findCampusCalendarConflicts(
  events: CampusCalendarEvent[],
  startDate?: string,
  endDate?: string,
): CampusCalendarEvent[] {
  if (!startDate || !endDate) return [];

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];

  return events.filter((event) => {
    const eventStart = new Date(event.start_date).getTime();
    const eventEnd = new Date(event.end_date).getTime();
    return (
      Number.isFinite(eventStart) &&
      Number.isFinite(eventEnd) &&
      start <= eventEnd &&
      end >= eventStart
    );
  });
}

export function calendarEventTypeLabel(type: CampusCalendarEventType): string {
  switch (type) {
    case "exam_period":
      return "Exam period";
    case "holiday":
      return "Break or holiday";
    default:
      return "Academic calendar period";
  }
}
