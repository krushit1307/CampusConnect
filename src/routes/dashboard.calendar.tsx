import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, lazy, Suspense } from "react";
import { User } from "@supabase/supabase-js";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { CalendarSkeleton } from "@/components/DashboardWidgetSkeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const EventsCalendar = lazy(() => import("@/components/events/EventsCalendar"));

interface EventCategory {
  id: string;
  name: string;
}

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
  category_id: string | null;
  event_categories: EventCategory | EventCategory[] | null;
}

interface RsvpQueryRow {
  id: string;
  event: RsvpEvent | RsvpEvent[] | null;
}

function isRsvpEvent(item: unknown): item is RsvpEvent {
  return item !== null && typeof item === "object" && "id" in item && "title" in item;
}

function normalizeEvent(raw: RsvpEvent): RsvpEvent {
  return {
    ...raw,
    clubs: Array.isArray(raw.clubs) ? raw.clubs[0] : raw.clubs,
    event_categories: Array.isArray(raw.event_categories)
      ? raw.event_categories[0]
      : raw.event_categories,
  };
}

export default function DashboardCalendar() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });
  }, [supabase]);

  const { data: categories = [] } = useQuery<EventCategory[]>({
    queryKey: ["eventCategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_categories")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data as EventCategory[]) || [];
    },
  });

  const { data: rsvps = [], isLoading } = useQuery<RsvpQueryRow[]>({
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
            category_id,
            clubs (
              name
            ),
            event_categories (
              id,
              name
            )
          )
        `,
        )
        .eq("user_id", user?.id);

      if (error) throw error;
      return (data as unknown as RsvpQueryRow[]) || [];
    },
    enabled: !!user?.id,
  });

  const events = rsvps
    .map((r) => {
      const rawEvent = r.event;
      if (!rawEvent) return null;
      const e = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
      return normalizeEvent(e);
    })
    .filter(isRsvpEvent);

  const filteredEvents =
    selectedCategories.length === 0
      ? events
      : events.filter((e) => e.category_id && selectedCategories.includes(e.category_id));

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function clearFilters() {
    setSelectedCategories([]);
  }

  if (isLoading) {
    return <CalendarSkeleton />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <span>Categories</span>
              <ChevronDown size={14} />
              {selectedCategories.length > 0 && (
                <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">
                  {selectedCategories.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-2">
              {categories.map((cat) => (
                <label
                  key={cat.id}
                  className="flex cursor-pointer items-center gap-2 font-mono text-sm"
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                  />
                  <span>{cat.name}</span>
                </label>
              ))}
              {categories.length === 0 && (
                <p className="font-mono text-xs text-gray-500">No categories found.</p>
              )}
            </div>
            {selectedCategories.length > 0 && (
              <button
                onClick={clearFilters}
                className="mt-3 flex w-full items-center justify-center gap-1 font-mono text-xs text-gray-500 hover:text-black dark:hover:text-white"
              >
                <X size={12} />
                Clear filters
              </button>
            )}
          </PopoverContent>
        </Popover>

        {selectedCategories.length > 0 && (
          <span className="font-mono text-xs text-gray-500">
            Showing {filteredEvents.length} of {events.length} events
          </span>
        )}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="neu-border bg-white p-8 text-center dark:bg-[#1a1a1a]">
          <CalendarDays className="mx-auto h-10 w-10 text-gray-400" aria-hidden="true" />
          <h3 className="mt-3 font-mono text-lg font-bold uppercase">
            {selectedCategories.length > 0 ? "No matching events" : "No RSVP'd events yet"}
          </h3>
          <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
            {selectedCategories.length > 0
              ? "Try selecting different categories."
              : "Events you RSVP to will show up here on your calendar."}
          </p>
        </div>
      ) : (
        <Suspense fallback={<CalendarSkeleton />}>
          <EventsCalendar events={filteredEvents} />
        </Suspense>
      )}
    </div>
  );
}
