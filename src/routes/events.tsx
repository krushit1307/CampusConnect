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
import { Search, Loader2, Calendar } from "lucide-react";

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

// Helper: Check if two event date ranges overlap
function eventsOverlap(
  startAStr: string | null,
  endAStr: string | null,
  startBStr: string | null,
  endBStr: string | null,
): boolean {
  if (!startAStr || !endAStr || !startBStr || !endBStr) return false;
  const startA = new Date(startAStr).getTime();
  const endA = new Date(endAStr).getTime();
  const startB = new Date(startBStr).getTime();
  const endB = new Date(endBStr).getTime();
  return startA < endB && startB < endA;
}

export default function EventsPage() {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [sortLoaded, setSortLoaded] = useState(false);
  const [hidePastEvents, setHidePastEvents] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Search history state (from upstream/main)
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  useEffect(() => {
    const savedSort = sessionStorage.getItem("event-sort-order");
    if (savedSort === "newest" || savedSort === "oldest") {
      setSortOrder(savedSort);
    }
    setSortLoaded(true);

    const savedHidePast = sessionStorage.getItem("hide-past-events");
    if (savedHidePast === "true") {
      setHidePastEvents(true);
    }

    // Load search history (from upstream/main)
    const history = localStorage.getItem("event-search-history");
    if (history) {
      try {
        const parsedHistory = JSON.parse(history);
        if (Array.isArray(parsedHistory)) {
          setRecentSearches(
            parsedHistory.filter((item): item is string => typeof item === "string"),
          );
        }
      } catch (error) {
        console.error("Failed to load search history:", error);
        localStorage.removeItem("event-search-history");
      }
    }
  }, []);

  useEffect(() => {
    if (!sortLoaded) return;
    sessionStorage.setItem("event-sort-order", sortOrder);
  }, [sortOrder, sortLoaded]);

  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const saveSearch = (value = searchInput) => {
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
      const { data, count, error } = await supabase
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
          created_at,
          clubs(name),
          event_rsvps(id,user_id),
          saved_events(id,user_id)
        `,
          { count: "exact" },
        )
        .order("event_date", { ascending: true })
        .range(0, PAGE_SIZE - 1);

      if (count !== null) {
        setTotalCount(count);
      }

      if (import.meta.env.DEV && (!data || data.length === 0)) {
        return [
          {
            id: "mock-1",
            title: "Hackathon 2024",
            description: "Annual college hackathon. Build something awesome in 24 hours!",
            event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000,
            ).toISOString(),
            location: "Main Auditorium",
            clubs: { name: "Tech Club" },
            event_rsvps: [{ id: "rsvp-1", user_id: "user-1" }],
            saved_events: [],
          },
          {
            id: "mock-2",
            title: "Watercolor Workshop",
            description: "Learn the basics of watercolor painting.",
            event_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            start_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date(
              Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
            ).toISOString(),
            location: "Art Studio 3",
            clubs: { name: "Art & Design" },
            event_rsvps: [],
            saved_events: [],
          },
          {
            id: "mock-3",
            title: "Open Mic Night",
            description: "Showcase your talent or just come to enjoy the performances.",
            event_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            start_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date(
              Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000,
            ).toISOString(),
            location: "Student Center",
            clubs: { name: "Music Society" },
            event_rsvps: [
              { id: "rsvp-2", user_id: "user-2" },
              { id: "rsvp-3", user_id: "user-3" },
            ],
            saved_events: [],
          },
        ];
      }
      return data;
    },
  });

  const [events, setEvents] = useState<EventItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (queryData) {
      setEvents(queryData);
      setPage(0);
      if (queryData.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    }
  }, [queryData]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const nextPage = page + 1;
    const start = nextPage * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    try {
      const { data, count, error } = await supabase
        .from("club_analytics_view")
        .select(
          `
          id, title, description, event_date, start_date, end_date, location, banner_url,
          clubs (name),
          event_rsvps (id, user_id),
          saved_events (id, user_id)
        `,
          { count: "exact" },
        )
        .order("event_date", { ascending: true })
        .range(start, end);

      if (count !== null) {
        setTotalCount(count);
      }

      if (error) {
        throw error;
      }

      const newEvents = data as EventItem[];
      setEvents((prev) => [...prev, ...newEvents]);
      setPage(nextPage);

      if (newEvents.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load more events:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

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
      if (!user) throw new Error("Must be logged in");
      if (eventId.startsWith("mock-")) {
        return;
      }

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

      if (error) {
        throw error;
      }
    },
    onSuccess: async (_data, variables) => {
      if (!variables.hasRsvpd && user && !variables.eventId.startsWith("mock-")) {
        const { count } = await supabase
          .from("event_rsvps")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (count === 1) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }
      }
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

  const handleRsvpToggle = async (eventId: string, hasRsvpd: boolean) => {
    if (!hasRsvpd && user) {
      const targetEvent = events.find((e) => e.id === eventId);
      if (targetEvent?.start_date && targetEvent?.end_date) {
        const overlapping = events.find((e) => {
          if (e.id === eventId) return false;
          const rsvps = Array.isArray(e.event_rsvps) ? e.event_rsvps : [];
          const isRsvpd = rsvps.some((r) => r.user_id === user.id);
          return (
            isRsvpd &&
            eventsOverlap(
              targetEvent.start_date ?? null,
              targetEvent.end_date ?? null,
              e.start_date ?? null,
              e.end_date ?? null,
            )
          );
        });

        if (overlapping) {
          toast(`Note: This event overlaps with ${overlapping.title} on your schedule!`);
        }
      }
    }

    const originalEvents = [...events];
    setEvents((prevEvents) =>
      prevEvents.map((e) => {
        if (e.id === eventId) {
          const rsvpsList = Array.isArray(e.event_rsvps) ? e.event_rsvps : [];
          if (hasRsvpd) {
            return {
              ...e,
              event_rsvps: rsvpsList.filter((r) => r.user_id !== (user?.id || "")),
            };
          } else {
            return {
              ...e,
              event_rsvps: [...rsvpsList, { id: "temp-rsvp-id", user_id: user?.id || "" }],
            };
          }
        }
        return e;
      }),
    );

    try {
      await toggleRsvp.mutateAsync({ eventId, hasRsvpd });
    } catch {
      setEvents(originalEvents);
    }
  };

  const handleBookmarkToggle = async (eventId: string, isSaved: boolean) => {
    const originalEvents = [...events];
    setEvents((prevEvents) =>
      prevEvents.map((e) => {
        if (e.id === eventId) {
          const savedList = Array.isArray(e.saved_events) ? e.saved_events : [];
          if (isSaved) {
            return {
              ...e,
              saved_events: savedList.filter((s) => s.user_id !== (user?.id || "")),
            };
          } else {
            return {
              ...e,
              saved_events: [...savedList, { id: "temp-id", user_id: user?.id || "" }],
            };
          }
        }
        return e;
      }),
    );

    try {
      await toggleBookmark.mutateAsync({ eventId, isSaved });
    } catch {
      setEvents(originalEvents);
    }
  };

  const filterColors: Record<string, string> = {
    All: "bg-black text-cream",
    Workshop: "bg-lime text-black",
    Talk: "bg-sky text-black",
    Hackathon: "bg-lavender text-black",
    Social: "bg-peach text-black",
  };

  const filteredEvents = events
    .filter((event) => {
      const text =
        `${event.title} ${event.description ?? ""} ${event.location ?? ""}`.toLowerCase();
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
    const dateA = new Date(a.event_date).getTime();
    const dateB = new Date(b.event_date).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
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
        <section className="border-b-2 border-black bg-sky px-4 py-14 md:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="eyebrow font-bold">All events · Fall semester</p>
                {totalCount !== null && (
                  <span className="neu-border bg-white px-2 py-0.5 text-[11px] font-mono font-extrabold text-black">
                    ⚡ {totalCount} TOTAL DB EVENTS
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-6xl">
                What&apos;s on this week.
              </h1>
            </div>

            <div className="flex flex-col items-end gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setShowRecent(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveSearch(searchInput);
                      setShowRecent(false);
                    }
                  }}
                  onFocus={() => setShowRecent(true)}
                  onBlur={() => setTimeout(() => setShowRecent(false), 200)}
                  placeholder="Search events by name, location..."
                  className="neu-border w-full bg-white pl-9 pr-8 py-2 font-mono text-xs focus:outline-none placeholder:text-neutral-500"
                />
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput("");
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1.5 font-mono text-sm font-bold text-neutral-500 hover:text-black cursor-pointer"
                  >
                    ×
                  </button>
                )}
                {showRecent && recentSearches.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full neu-border bg-white p-3 shadow-md">
                    <div className="mb-2 flex justify-between font-mono text-xs font-bold">
                      <span>Recent searches</span>
                      <button onClick={clearSearchHistory} className="text-red-500 hover:underline">
                        Clear History
                      </button>
                    </div>
                    {recentSearches.map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          setSearchInput(item);
                          setSearchQuery(item);
                          saveSearch(item);
                          setShowRecent(false);
                        }}
                        className="block w-full text-left px-2 py-1 hover:bg-cream font-mono text-xs text-black cursor-pointer"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="sr-only" aria-live="polite">
                {sortedEvents.length} event{sortedEvents.length !== 1 ? "s" : ""} found
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="neu-border flex cursor-pointer select-none items-center gap-2 bg-white px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-white md:mr-2 text-black">
                  <input
                    type="checkbox"
                    checked={hidePastEvents}
                    onChange={(e) => setHidePastEvents(e.target.checked)}
                    className="h-4 w-4 accent-black cursor-pointer text-black"
                  />
                  Hide Past Events
                </label>
                {["All", "Workshop", "Talk", "Hackathon", "Social"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    aria-pressed={filter === t}
                    className={`neu-border px-3 py-2 font-mono text-xs font-bold uppercase transition-colors duration-200 ${
                      filter === t
                        ? filterColors[t] || "bg-black text-cream"
                        : "bg-white text-black"
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {(filter !== "All" || searchQuery) && (
                  <button
                    onClick={() => {
                      setFilter("All");
                      setSearchInput("");
                      setSearchQuery("");
                    }}
                    className="neu-border bg-white px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-cream cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <div className="neu-border flex bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors cursor-pointer ${
                      viewMode === "list"
                        ? "bg-black text-cream"
                        : "bg-white text-black hover:bg-cream"
                    }`}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("calendar")}
                    className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors cursor-pointer ${
                      viewMode === "calendar"
                        ? "bg-black text-cream"
                        : "bg-white text-black hover:bg-cream"
                    }`}
                  >
                    Calendar
                  </button>
                </div>

                <Select
                  value={sortOrder}
                  onValueChange={(value) => setSortOrder(value as "newest" | "oldest")}
                >
                  <SelectTrigger className="neu-border w-44 bg-white font-mono text-xs text-black">
                    <SelectValue placeholder="Sort by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
                <CreateEventDialog user={user} />
              </div>
            </div>
          </div>
        </section>
        <section className="bg-cream px-4 py-12 md:px-6">
          {viewMode === "list" ? (
            <>
              <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <EventCardSkeleton key={i} />)
                ) : sortedEvents.length === 0 && filter !== "All" ? (
                  <div className="col-span-full mx-auto max-w-md text-center neu-border bg-white p-8 animate-in fade-in-0 zoom-in-95 duration-300">
                    <Calendar className="mx-auto h-10 w-10 text-neutral-500" aria-hidden="true" />
                    <h3 className="mt-3 font-mono text-lg font-bold uppercase">
                      No {filter} events found.
                    </h3>
                    <p className="mt-1 font-mono text-xs text-neutral-600">
                      Try a different category, or clear the filter to see everything.
                    </p>
                    <button
                      onClick={() => setFilter("All")}
                      className="mt-4 neu-border bg-yellow px-5 py-2 font-mono text-xs font-bold uppercase transition-all hover:bg-black hover:text-white cursor-pointer"
                    >
                      Clear filter
                    </button>
                  </div>
                ) : sortedEvents.length === 0 ? (
                  <div className="col-span-full mx-auto max-w-md text-center neu-border bg-white p-8">
                    <p className="text-3xl">🔍</p>
                    <h3 className="mt-2 font-mono text-lg font-bold uppercase">No Events Found</h3>
                    <p className="mt-1 font-mono text-xs text-neutral-600">
                      No events matched &quot;{searchQuery}&quot;. Try clearing your filters or
                      searching for another term.
                    </p>
                    <button
                      onClick={() => {
                        setFilter("All");
                        setSearchInput("");
                        setSearchQuery("");
                      }}
                      className="mt-4 neu-border bg-yellow px-5 py-2 font-mono text-xs font-bold uppercase transition-all hover:bg-black hover:text-white cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  sortedEvents.map((e, index) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      index={index}
                      user={user}
                      onRsvpToggle={(eventId, hasRsvpd) => handleRsvpToggle(eventId, hasRsvpd)}
                      isRsvpPending={toggleRsvp.isPending}
                      onBookmarkToggle={(eventId, isSaved) =>
                        handleBookmarkToggle(eventId, isSaved)
                      }
                      isBookmarkPending={toggleBookmark.isPending}
                    />
                  ))
                )}
              </div>

              {!isLoading && (
                <div className="mt-12 text-center flex flex-col items-center justify-center gap-4">
                  {totalCount !== null && totalCount > 0 && (
                    <div className="w-full max-w-md space-y-1.5">
                      <div className="flex justify-between items-center font-mono text-xs font-bold uppercase">
                        <span>Feed Progress</span>
                        <span>
                          {events.length} of {totalCount} events loaded (
                          {Math.min(100, Math.round((events.length / totalCount) * 100))}%)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-white neu-border overflow-hidden p-0.5">
                        <div
                          className="h-full bg-yellow border border-black transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.round((events.length / totalCount) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {hasMore ? (
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="neu-border bg-yellow px-10 py-3.5 font-mono text-sm font-bold uppercase transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading Next 20 Events...</span>
                        </>
                      ) : (
                        <>
                          <span>Load More Events</span>
                          {totalCount !== null && totalCount > events.length && (
                            <span className="rounded bg-black px-2 py-0.5 text-xs text-yellow font-mono font-bold">
                              {totalCount - events.length} remaining
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  ) : (
                    events.length > 0 && (
                      <div className="neu-border bg-white px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
                        <span>✨ All {events.length} events loaded from database</span>
                      </div>
                    )
                  )}
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
