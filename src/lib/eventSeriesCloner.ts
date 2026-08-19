export interface SeriesEventTemplate {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  capacity?: number;
  venue_id?: string;
  series_id: string;
}

export interface ShiftedEventPreview {
  originalEventId: string;
  title: string;
  originalDate: string;
  shiftedDate: string;
  daysShifted: number;
  intervalDaysFromPrevious: number;
  status: "draft";
}

/**
 * Calculates time delta in milliseconds between earliest original event and new start date (#3538).
 */
export function calculateTimeDeltaMs(earliestOriginalDateStr: string, newStartDateStr: string): number {
  const origTime = new Date(earliestOriginalDateStr).getTime();
  const newTime = new Date(newStartDateStr).getTime();
  if (isNaN(origTime) || isNaN(newTime)) return 0;
  return newTime - origTime;
}

/**
 * Shifts an ISO timestamp string forward or backward by deltaMs while preserving exact relative time (#3538).
 */
export function shiftTimestamp(timestampStr: string, deltaMs: number): string {
  const origDate = new Date(timestampStr);
  if (isNaN(origDate.getTime())) return timestampStr;
  const shiftedDate = new Date(origDate.getTime() + deltaMs);
  return shiftedDate.toISOString();
}

/**
 * Generates a live preview of shifted events for an entire series (#3538).
 * Preserves exact relative temporal spacing between consecutive events.
 */
export function generateShiftedSeriesPreview(
  events: SeriesEventTemplate[],
  newStartDateStr: string
): ShiftedEventPreview[] {
  if (!events || events.length === 0 || !newStartDateStr) return [];

  // Sort events chronologically
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );

  const earliestDateStr = sorted[0].event_date;
  const deltaMs = calculateTimeDeltaMs(earliestDateStr, newStartDateStr);
  const daysShifted = Math.round(deltaMs / (1000 * 60 * 60 * 24));

  return sorted.map((evt, index) => {
    const shiftedDate = shiftTimestamp(evt.event_date, deltaMs);
    let intervalDaysFromPrevious = 0;

    if (index > 0) {
      const prevShifted = new Date(shiftTimestamp(sorted[index - 1].event_date, deltaMs)).getTime();
      const currentShifted = new Date(shiftedDate).getTime();
      intervalDaysFromPrevious = Math.round((currentShifted - prevShifted) / (1000 * 60 * 60 * 24));
    }

    return {
      originalEventId: evt.id,
      title: evt.title,
      originalDate: evt.event_date,
      shiftedDate,
      daysShifted,
      intervalDaysFromPrevious,
      status: "draft",
    };
  });
}
