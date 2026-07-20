import { formatDate } from "../lib/utils";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, lazy, Suspense } from "react";
import { User } from "@supabase/supabase-js";
import { EventCard } from "@/components/EventCard";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { toast } from "sonner";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";
import { Loader2, Search, Calendar } from "lucide-react";
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
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  banner_url?: string | null;
  clubs: { name: string } | { name: string }[] | null;
  event_rsvps: { id: string; user_id: string }[] | null;
  saved_events: { id: string; user_id: string }[] | null;
  attendee_count?: number;
}

const EventsCalendar = lazy(() => import("@/components/events/EventsCalendar"));

export default function EventsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [sortLoaded, setSortLoaded] = useState(false);
  const [hidePastEvents, setHidePastEvents] = useState(false);
  const [hidePastLoaded, setHidePastLoaded] = useState(false);

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
    setHidePastLoaded(true);
  }, []);

  useEffect(() => {
    if (!sortLoaded) return;

    sessionStorage.setItem("event-sort-order", sortOrder);
  }, [sortOrder, sortLoaded]);

  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: queryData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["events", user?.id ?? "anonymous"],
    queryFn: async () => {
      const { data, count } = await supabase
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
        .range(0, PAGE_SIZE - 1);

      if (count !== null) {
        setTotalCount(count);
      }

      // Fallback to mock data in development if database is empty
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
        toast.error("Failed to load more events.");
        console.error("Error loading events page:", error);
      } else if (data) {
        if (data.length < PAGE_SIZE) {
          setHasMore(false);
        }
        if (data.length > 0) {
          setEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newUnique = data.filter((e) => !existingIds.has(e.id));
            return [...prev, ...newUnique];
          });
          setPage(nextPage);
        }
      }
    } catch (err) {
      console.error("Failed to load more events:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("realtime_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, () => {
        refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "saved_events" }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetch]);

  useEffect(() => {
    const handleRefetch = () => refetch();
    window.addEventListener("refetchEvents", handleRefetch);
    return () => window.removeEventListener("refetchEvents", handleRefetch);
  }, [refetch]);

  const toggleRsvp = useMutation({
    mutationFn: async ({ eventId, hasRsvpd }: { eventId: string; hasRsvpd: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      if (eventId.startsWith("mock-")) {
        // Skip database call for mock event cards in development
        console.log(`[CampusConnect] Mock RSVP toggled for event: ${eventId}`);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { error } = await supabase.functions.invoke("toggle-rsvp", {
        body: { eventId, hasRsvpd },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.hasRsvpd ? "RSVP cancelled successfully!" : "RSVP registered successfully!",
      );
      if (!variables.eventId.startsWith("mock-")) {
        refetch();
        window.dispatchEvent(new CustomEvent("refetchEvents"));
      }
    },
    onError: () => {
      toast.error("Failed to update RSVP.");
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: async ({ eventId, isSaved }: { eventId: string; isSaved: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      if (eventId.startsWith("mock-")) {
        console.log(`[CampusConnect] Mock Bookmark toggled for event: ${eventId}`);
        return;
      }
      const { error } = isSaved
        ? await supabase
            .from("saved_events")
            .delete()
            .match({ event_id: eventId, user_id: user.id })
        : await supabase.from("saved_events").insert({ event_id: eventId, user_id: user.id });

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.isSaved ? "Removed from saved events!" : "Saved to bookmarks!");
      refetch();
    },
    onError: () => {
      toast.error("Failed to update bookmark.");
    },
  });

  const handleRsvpToggle = async (eventId: string, hasRsvpd: boolean) => {
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

  const colors = ["bg-lime", "bg-sky", "bg-peach", "bg-lavender"];

  const filteredEvents = events.filter((e: EventItem) => {
    const matchesFilter =
      filter === "All" ||
      `${e.title} ${e.description || ""}`.toLowerCase().includes(filter.toLowerCase());

    const matchesSearch =
      !searchQuery.trim() ||
      `${e.title} ${e.description || ""} ${e.location || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (!a.event_date && !b.event_date) return 0;
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;

    const dateA = new Date(a.event_date).getTime();
    const dateB = new Date(b.event_date).getTime();

    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  return (
    <SiteShell>
      <PullToRefresh isRefreshing={isFetching} onRefresh={() => refetch()}>
        <section className="border-b-2 border-black bg-sky px-4 py-14 md:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
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
                What's on this week.
              </h1>
            </div>

            <div className="flex flex-col items-end gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events by name, location..."
                  className="neu-border w-full bg-white pl-9 pr-8 py-2 font-mono text-xs focus:outline-none placeholder:text-neutral-500"
                />
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1.5 font-mono text-sm font-bold text-neutral-500 hover:text-black cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Filter Tags */}
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
                {["All", "Workshop", "Talk", "Hackathon", "Social"].map((t, i) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`neu-border px-3 py-2 font-mono text-xs font-bold uppercase ${filter === t ? "bg-black text-cream" : "bg-white text-black"}`}
                  >
                    {t}
                  </button>
                ))}
                {(filter !== "All" || searchQuery) && (
                  <button
                    onClick={() => {
                      setFilter("All");
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

        <section className="bg-blue-900 px-4 py-12 md:px-6">
          {viewMode === "list" ? (
            <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-3 ">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <EventCardSkeleton key={i} />)
                : sortedEvents.map((e, index) => (
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
                  ))}
            </div>
          ) : (
            // Grid/Card View
            <div>{/* Your grid view here */}</div>
          )}
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
                      No events matched "{searchQuery}". Try clearing your filters or searching for
                      another term.
                    </p>
                    <button
                      onClick={() => {
                        setFilter("All");
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

              {/* Load More Pagination & Feed Progress Bar */}
              {!isLoading && (
                <div className="mt-12 text-center flex flex-col items-center justify-center gap-4">
                  {/* Visual Progress Bar */}
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
            <div className="mx-auto max-w-7xl">
              <Suspense
                fallback={
                  <div className="neu-border bg-white p-12 text-center font-mono text-sm animate-pulse">
                    Loading calendar view...
                  </div>
                }
              >
                <EventsCalendar events={sortedEvents} />
              </Suspense>
            </div>
          )}
        </section>
      </PullToRefresh>
    </SiteShell>
  );
}
