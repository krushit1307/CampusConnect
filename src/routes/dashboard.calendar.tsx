import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, lazy, Suspense } from "react";
import { User } from "@supabase/supabase-js";
import { CalendarDays } from "lucide-react";

const EventsCalendar = lazy(() => import("@/components/events/EventsCalendar"));

interface RsvpEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  banner_url?: string | null;
  clubs: { name: string } | { name: string }[] | null;
}

export default function DashboardCalendar() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });
  }, [supabase]);

  // Fetch only the events this user has RSVP'd to — same source as the
  // "My RSVPs" tab, but shaped for the calendar widget.
  const { data: rsvps = [], isLoading } = useQuery({
    queryKey: ["userRsvpsCalendar", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select(
          `
          id,
          event:events (
            id,
            title,
            description,
            event_date,
            start_date,
            end_date,
            location,
            banner_url,
            clubs (
              name
            )
          )
        `,
        )
        .eq("user_id", user?.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Postgrest may return the nested relation as an object or an array — normalize either way.
  const events: RsvpEvent[] = rsvps
    .map((r) => {
      const rawEvent = r.event;
      if (!rawEvent) return null;
      return Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
    })
    .filter((e): e is RsvpEvent => !!e);

  if (isLoading) {
    return (
      <div className="neu-border flex h-[600px] items-center justify-center bg-white p-12 text-center font-mono text-sm animate-pulse md:h-[700px]">
        Loading your calendar...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="neu-border bg-white p-8 text-center dark:bg-[#1a1a1a]">
        <CalendarDays className="mx-auto h-10 w-10 text-gray-400" aria-hidden="true" />
        <h3 className="mt-3 font-mono text-lg font-bold uppercase">No RSVP'd events yet</h3>
        <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
          Events you RSVP to will show up here on your calendar.
        </p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="neu-border bg-white p-12 text-center font-mono text-sm animate-pulse">
          Loading calendar view...
        </div>
      }
    >
      <EventsCalendar events={events} />
    </Suspense>
  );
}
