import { getGoogleCalendarUrl, getIcsContent } from "@/lib/utils";

export function downloadIcs(event: {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
}) {
  // Hit our new backend endpoint which forces the file download
  window.location.href = `/api/events/${event.id}/calendar.ics`;
}

export { getGoogleCalendarUrl, getIcsContent };
