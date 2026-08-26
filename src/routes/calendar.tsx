import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days";
import EventsCalendar from "@/components/events/EventsCalendar";

interface EventCategory {
  name: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  banner_url: string | null;
  clubs: { name: string } | { name: string }[] | null;
  event_categories: EventCategory | EventCategory[] | null;
}

export default function GlobalCalendar() {
  const [supabase] = useState(() => createClient());

  const {
    data: events = [],
    isLoading,
    error,
  } = useQuery<CalendarEvent[]>({
    queryKey: ["global-campus-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          id,
          title,
          description,
          event_date,
          start_date,
          end_date,
          location,
          banner_url,
          clubs(name),
          event_categories(name)
        `,
        )
        .neq("status", "archived")
        .order("start_date", { ascending: true });

      if (error) throw error;

      return (data as unknown as CalendarEvent[]) || [];
    },
  });

  return (
    <main className="min-h-screen bg-cream px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <CalendarDays className="h-7 w-7" aria-hidden="true" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest">
              Campus Events
            </span>
          </div>

          <h1 className="text-4xl font-bold uppercase md:text-6xl">Global Campus Calendar</h1>

          <p className="mt-3 max-w-2xl font-mono text-sm text-neutral-600">
            Browse upcoming academic, social, sports, and campus events in one calendar.
          </p>
        </header>

        {isLoading && (
          <div className="neu-border bg-white p-10 text-center font-mono" role="status">
            Loading campus events...
          </div>
        )}

        {error && (
          <div className="neu-border bg-white p-10 text-center font-mono text-red-600" role="alert">
            Unable to load campus events.
          </div>
        )}

        {!isLoading && !error && events.length === 0 && (
          <div className="neu-border bg-white p-10 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-neutral-400" aria-hidden="true" />
            <h2 className="mt-3 font-mono text-lg font-bold uppercase">No events available</h2>
            <p className="mt-2 font-mono text-sm text-neutral-500">
              Campus events will appear here once they are published.
            </p>
          </div>
        )}

        {!isLoading && !error && events.length > 0 && <EventsCalendar events={events} />}
      </div>
    </main>
  );
}
