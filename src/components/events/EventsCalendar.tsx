import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
  banner_url?: string | null;
  clubs: { name: string } | { name: string }[] | null;
}

interface EventsCalendarProps {
  events: EventItem[];
}

export default function EventsCalendar({ events }: EventsCalendarProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("month");

  const formattedEvents = events.map((e) => {
    const start = e.start_date
      ? new Date(e.start_date)
      : e.event_date
        ? new Date(e.event_date)
        : new Date();
    const end = e.end_date ? new Date(e.end_date) : new Date(start.getTime() + 60 * 60 * 1000);

    return {
      id: e.id,
      title: e.title,
      start,
      end,
      allDay: false,
    };
  });

  return (
    <div className="neu-border bg-white p-4 h-[600px] md:h-[700px] w-full">
      <div className="mb-4 flex gap-2">
        <Button
          size="sm"
          className={view === "month" ? "bg-primary text-primary-foreground" : "border"}
          onClick={() => setView("month")}
        >
          Month
        </Button>

        <Button
          size="sm"
          className={view === "week" ? "bg-primary text-primary-foreground" : "border"}
          onClick={() => setView("week")}
        >
          Week
        </Button>
      </div>

      <Calendar
        localizer={localizer}
        events={formattedEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        views={["month", "week"]}
        view={view}
        onView={(newView) => setView(newView)}
        eventPropGetter={() => ({
          className: "calendar-rsvp-event",
        })}
        onSelectEvent={(event: { id: string }) => {
          navigate(`/events/${event.id}`);
        }}
      />
    </div>
  );
}
