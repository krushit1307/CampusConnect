import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { User } from "@supabase/supabase-js";
import { EventCard } from "@/components/EventCard";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { toast } from "sonner";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 20;

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
  event_rsvps: { id: string; user_id: string }[] | null;
  saved_events: { id: string; user_id: string }[] | null;
}
import EventsCalendar from "@/components/events/EventsCalendar";

export default function EventsPage() {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);

  const [filter, setFilter] = useState("All");

  const [searchQuery, setSearchQuery] = useState("");

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [showRecent, setShowRecent] = useState(false);
  const [showConfetti] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [hidePastEvents, setHidePastEvents] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [supabase]);
  useEffect(() => {
    const history = localStorage.getItem("event-search-history");

    if (!history) return;

    try {
      const parsedHistory = JSON.parse(history);

      if (Array.isArray(parsedHistory)) {
        setRecentSearches(parsedHistory.filter((item): item is string => typeof item === "string"));
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
      localStorage.removeItem("event-search-history");
    }
  }, []);
  const saveSearch = (value = searchQuery) => {
    const trimmed = value.trim();

    if (!trimmed) return;

    const updated = [trimmed, ...recentSearches.filter((item) => item !== trimmed)].slice(0, 5);

    setRecentSearches(updated);

    localStorage.setItem("event-search-history", JSON.stringify(updated));
  };
  const clearSearchHistory = () => {
    setRecentSearches([]);

    localStorage.removeItem("event-search-history");
  };
  const {
    data: queryData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["events"],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_analytics_view")
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
          event_rsvps(id,user_id),
          saved_events(id,user_id)
        `,
          { count: "exact" },
        )
        .order("event_date", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      return (data ?? []) as EventItem[];
    },
  });
  const events = (queryData ?? []) as EventItem[];
  useEffect(() => {
    const channel = supabase
      .channel("events-update")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_rsvps",
        },
        () => refetch(),
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "saved_events",
        },
        () => refetch(),
      )

      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetch]);
  const toggleRsvp = useMutation({
    mutationFn: async ({ eventId, hasRsvpd }: { eventId: string; hasRsvpd: boolean }) => {
      if (!user) throw new Error("Login required");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("toggle-rsvp", {
        body: {
          eventId,
          hasRsvpd,
        },

        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
    },

    onSuccess: () => {
      refetch();
    },

    onError: () => {
      toast.error("Failed to update RSVP");
    },
  });
  const toggleBookmark = useMutation({
    mutationFn: async ({ eventId, isSaved }: { eventId: string; isSaved: boolean }) => {
      if (!user) throw new Error("Login required");

      const query = isSaved
        ? supabase.from("saved_events").delete().match({
            event_id: eventId,
            user_id: user.id,
          })
        : supabase.from("saved_events").insert({
            event_id: eventId,
            user_id: user.id,
          });
      const { error } = await query;

      if (error) throw error;
    },

    onSuccess: () => {
      refetch();
    },

    onError: () => {
      toast.error("Failed to update bookmark");
    },
  });
  const filteredEvents = events
    .filter((event) => {
      const text = `${event.title}
      ${event.description ?? ""}
      ${event.location ?? ""}`.toLowerCase();
      const matchesSearch = text.includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (filter === "All") return true;
      return text.includes(filter.toLowerCase());
    })
    .filter((event) => {
      if (!hidePastEvents) return true;
      const date = event.end_date ?? event.event_date;
      if (!date) return true;
      return new Date(date) > new Date();
    });
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    const first = new Date(a.event_date).getTime();
    const second = new Date(b.event_date).getTime();
    return sortOrder === "newest" ? second - first : first - second;
  });

  return (
    <SiteShell>
      {showConfetti && (
        <div className="confetti-container" aria-hidden="true">
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={i} className="confetti-piece" style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
      )}
      <PullToRefresh isRefreshing={isFetching} onRefresh={() => refetch()}>
        <section
          className="
        border-b-2
        border-black
        bg-sky
        px-4
        py-14
        md:px-6"
        >
          <div
            className="
      mx-auto
      flex
      max-w-7xl
      flex-col
      gap-5
      "
          >
            <div>
              <p className="eyebrow font-bold">All events · Fall semester</p>
              <h1
                className="
      mt-2
      text-3xl
      font-bold
      sm:text-4xl
      md:text-6xl"
              >
                What's on this week.
              </h1>
            </div>
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowRecent(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveSearch();
                    setShowRecent(false);
                  }
                }}
                onFocus={() => setShowRecent(true)}
                onBlur={() => setTimeout(() => setShowRecent(false), 200)}
                placeholder="Search events..."
                className="
    neu-border
    w-full
    bg-white
    px-4
    py-3
    font-mono
    text-sm
  "
              />
              {showRecent && recentSearches.length > 0 && (
                <div
                  className="
        absolute
        z-20
        mt-2
        w-full
        neu-border
        bg-white
        p-3
        "
                >
                  <div
                    className="
        mb-2
        flex
        justify-between
        font-mono
        text-xs
        font-bold
        "
                  >
                    <span>Recent searches</span>
                    <button onClick={clearSearchHistory} className="text-red-500 hover:underline">
                      Clear History
                    </button>
                  </div>
                  {recentSearches.map((item) => (
                    <button
                      key={item}

                      onClick={() => {
                        setSearchQuery(item);

                        const updated = [
                          item,
                          ...recentSearches.filter((search) => search !== item),
                        ].slice(0, 5);

                        setRecentSearches(updated);

                        localStorage.setItem("event-search-history", JSON.stringify(updated));

                        setShowRecent(false);
                      }}
                      className="
            block
            w-full
            text-left
            px-2
            py-1
            hover:bg-cream
            "
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div
              className="
      flex
      flex-wrap
      gap-2
      "
            >
              <label
                className="
      neu-border
      bg-white
      px-3
      py-2
      font-mono
      text-xs
      font-bold
      "
              >
                <input
                  type="checkbox"

                  checked={hidePastEvents}

                  onChange={(e) => setHidePastEvents(e.target.checked)}
                />{" "}
                Hide Past Events
              </label>
              {["All", "Workshop", "Talk", "Hackathon", "Social"].map((type) => (
                <button
                  key={type}

                  onClick={() => setFilter(type)}

                  className={`
      neu-border
      px-3
      py-2
      font-mono
      text-xs
      font-bold
      ${filter === type ? "bg-black text-cream" : "bg-white"}
      `}
                >
                  {type}
                </button>
              ))}
            </div>
            <div
              className="
      flex
      flex-wrap
      gap-2
      "
            >
              <button
                onClick={() => setViewMode("list")}
                className="
      neu-border
      bg-white
      px-3
      py-2
      font-mono
      text-xs
      "
              >
                List
              </button>

              <button
                onClick={() => setViewMode("calendar")}

                className="
      neu-border
      bg-white
      px-3
      py-2
      font-mono
      text-xs
      "
              >
                Calendar
              </button>
              <Select
                value={sortOrder}

                onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}
              >
                <SelectTrigger
                  className="
      neu-border
      bg-white
      w-40
      "
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
              </Select>
              <CreateEventDialog user={user} />
            </div>
          </div>
        </section>
        <section
          className="
      bg-cream
      px-4
      py-12
      md:px-6"
        >
          {viewMode === "list" ? (
            <>
              <div
                className="
      mx-auto
      grid
      max-w-7xl
      gap-6
      md:grid-cols-2
      lg:grid-cols-3"
              >
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => <EventCardSkeleton key={i} />)
                  : sortedEvents.map((event, index) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        index={index}
                        user={user}
                        onRsvpToggle={(id, status) =>
                          toggleRsvp.mutate({
                            eventId: id,
                            hasRsvpd: status,
                          })
                        }
                        isRsvpPending={toggleRsvp.isPending}
                        onBookmarkToggle={(id, status) =>
                          toggleBookmark.mutate({
                            eventId: id,
                            isSaved: status,
                          })
                        }
                        isBookmarkPending={toggleBookmark.isPending}
                      />
                    ))}
              </div>

              {!isLoading && sortedEvents.length > 0 && (
                <div className="mt-12 text-center">
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                    Showing {sortedEvents.length} events
                  </p>
                </div>
              )}
            </>
          ) : (
            <EventsCalendar events={sortedEvents} />
          )}
        </section>
      </PullToRefresh>
    </SiteShell>
  );
}
