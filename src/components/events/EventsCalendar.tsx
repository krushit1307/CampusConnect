import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { parseUtcToLocal, formatEventInTimeZone } from "@/lib/timezone";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface EventCategory {
  name: string;
}

interface EventItem {
  id: string;
  short_id?: string | null;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
  banner_url?: string | null;
  clubs: { name: string } | { name: string }[] | null;
  event_categories?: EventCategory | EventCategory[] | null;
}

interface EventsCalendarProps {
  events: EventItem[];
  timeZone?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: EventItem;
}

function getCategory(event: EventItem) {
  const category = event.event_categories;

  if (!category) return "Other";

  if (Array.isArray(category)) {
    return category[0]?.name ?? "Other";
  }

  return category.name;
}

function getCategoryClass(category: string) {
  switch (category.toLowerCase()) {
    case "academic":
      return "calendar-event-academic";
    case "social":
      return "calendar-event-social";
    case "sports":
      return "calendar-event-sports";
    default:
      return "calendar-event-default";
  }
}

export default function EventsCalendar({ events, timeZone }: EventsCalendarProps) {
  const [view, setView] = useState<View>("month");
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const formattedEvents: CalendarEvent[] = events
    .filter((event) => event.start_date || event.event_date)
    .map((event) => {
      const rawStart = event.start_date ?? event.event_date!;
      const start = parseUtcToLocal(rawStart, timeZone) || new Date(rawStart);

      const end = event.end_date
        ? parseUtcToLocal(event.end_date, timeZone) || new Date(event.end_date)
        : new Date(start.getTime() + 60 * 60 * 1000);

      return {
        id: event.short_id || event.id,
        title: event.title,
        start,
        end,
        allDay: false,
        resource: event,
      };
    });

  const selectedStart = selectedEvent
    ? parseUtcToLocal(selectedEvent.start_date ?? selectedEvent.event_date, timeZone)
    : null;

  const selectedEnd = selectedEvent?.end_date
    ? parseUtcToLocal(selectedEvent.end_date, timeZone)
    : null;

  return (
    <>
      <div className="neu-border h-[600px] w-full bg-white p-4 md:h-[700px]">
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Calendar view">
          <Button
            type="button"
            size="sm"
            variant={view === "month" ? "primary" : "outline"}
            aria-pressed={view === "month"}
            onClick={() => setView("month")}
          >
            Month
          </Button>

          <Button
            type="button"
            size="sm"
            variant={view === "week" ? "primary" : "outline"}
            aria-pressed={view === "week"}
            onClick={() => setView("week")}
          >
            Week
          </Button>

          <Button
            type="button"
            size="sm"
            variant={view === "day" ? "primary" : "outline"}
            aria-pressed={view === "day"}
            onClick={() => setView("day")}
          >
            Day
          </Button>
        </div>

        <Calendar
          localizer={localizer}
          events={formattedEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "calc(100% - 48px)" }}
          views={["month", "week", "day"]}
          view={view}
          onView={(newView: View) => setView(newView)}
          eventPropGetter={(calendarEvent: CalendarEvent) => ({
            className: getCategoryClass(getCategory(calendarEvent.resource)),
          })}
          onSelectEvent={(calendarEvent: CalendarEvent) => {
            setSelectedEvent(calendarEvent.resource);
          }}
        />
      </div>

      <Dialog
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
      >
        <DialogContent className="neu-border bg-white sm:max-w-lg">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-xl font-bold uppercase">
                  {selectedEvent.title}
                </DialogTitle>

                <DialogDescription>{getCategory(selectedEvent)} campus event</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {selectedEvent.banner_url && (
                  <img
                    src={selectedEvent.banner_url}
                    alt=""
                    className="max-h-56 w-full object-cover"
                  />
                )}

                <div className="flex items-start gap-2 font-mono text-sm">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />

                  <div>
                    {selectedStart && !Number.isNaN(selectedStart.getTime()) && (
                      <p>{format(selectedStart, "PPP p")}</p>
                    )}

                    {selectedEnd && !Number.isNaN(selectedEnd.getTime()) && (
                      <p className="text-neutral-500">Ends {format(selectedEnd, "PPP p")}</p>
                    )}
                  </div>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-start gap-2 font-mono text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}

                {selectedEvent.description && (
                  <p className="font-mono text-sm leading-6 text-neutral-600">
                    {selectedEvent.description}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
