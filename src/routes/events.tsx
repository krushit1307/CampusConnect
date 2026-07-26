import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { useEffect, useState, useRef, lazy, Suspense, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { EventCard } from "@/components/EventCard";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { toast } from "sonner";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";
import { Search, Loader2, Calendar as CalendarIcon, Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { matchesDateFilter } from "@/lib/eventUtils";
import { getMultiIcsContent } from "@/lib/utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EventFilters, FilterState } from "@/components/EventFilters";
import { ScrollAwareFab } from "@/components/ScrollAwareFab";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 20;

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
  banner_url?: string | null;
  created_at?: string | null;
  clubs: { name: string } | { name: string }[] | null;
  event_rsvps: { id: string; user_id: string }[] | null;
  saved_events: { id: string; user_id: string }[] | null;
  max_attendees?: number | null;
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
  const emailVerified = useEmailVerification();
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [sortLoaded, setSortLoaded] = useState(false);
  const [hidePastEvents, setHidePastEvents] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: "all",
    categories: [],
    openCapacityOnly: false,
  });

  const [dateFilterType, setDateFilterType] = useState<
    "all" | "this-week" | "next-month" | "specific"
  >("all");
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);

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
  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

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
    queryKey: ["events", filters.dateRange, filters.categories],
    queryFn: async () => {
      let selectString = `
          id,
          title,
          description,
          event_date,
          start_date,
          end_date,
          location,
          banner_url,
          created_at,
          max_attendees,
          clubs(name),
          event_rsvps(id,user_id),
          saved_events(id,user_id)
      `;

      if (filters.categories.length > 0) {
        selectString += `, event_categories!inner(name)`;
      } else {
        selectString += `, event_categories(name)`;
      }

      let query = supabase
        .from("events")
        .select(selectString, { count: "exact" })
        .neq("status", "archived");

      if (filters.dateRange === "this-week") {
        const now = new Date();
        query = query
          .gte("start_date", startOfWeek(now).toISOString())
          .lte("start_date", endOfWeek(now).toISOString());
      } else if (filters.dateRange === "next-month") {
        const nextMonth = addMonths(new Date(), 1);
        query = query
          .gte("start_date", startOfMonth(nextMonth).toISOString())
          .lte("start_date", endOfMonth(nextMonth).toISOString());
      }

      if (filters.categories.length > 0) {
        query = query.in("event_categories.name", filters.categories);
      }

      query = query.order("event_date", { ascending: true }).range(0, PAGE_SIZE - 1);

      const { data, count, error } = await query;

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
      return data as unknown as EventItem[];
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

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const nextPage = page + 1;
    const start = nextPage * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    try {
      let selectString = `
          id, title, description, event_date, start_date, end_date, location, banner_url, created_at, max_attendees,
          clubs (name),
          event_rsvps (id, user_id),
          saved_events (id, user_id)
      `;

      if (filters.categories.length > 0) {
        selectString += `, event_categories!inner(name)`;
      } else {
        selectString += `, event_categories(name)`;
      }

      let query = supabase
        .from("events")
        .select(selectString, { count: "exact" })
        .neq("status", "archived");

      if (filters.dateRange === "this-week") {
        const now = new Date();
        query = query
          .gte("start_date", startOfWeek(now).toISOString())
          .lte("start_date", endOfWeek(now).toISOString());
      } else if (filters.dateRange === "next-month") {
        const nextMonth = addMonths(new Date(), 1);
        query = query
          .gte("start_date", startOfMonth(nextMonth).toISOString())
          .lte("start_date", endOfMonth(nextMonth).toISOString());
      }

      if (filters.categories.length > 0) {
        query = query.in("event_categories.name", filters.categories);
      }

      query = query.order("event_date", { ascending: true }).range(start, end);

      const { data, count, error } = await query;

      if (count !== null) {
        setTotalCount(count);
      }

      if (error) {
        throw error;
      }

      const newEvents = data as unknown as EventItem[];
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
  }, [isLoadingMore, hasMore, page, supabase]);

  // Infinite scroll: auto-trigger load when sentinel enters the viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, handleLoadMore]);

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
      toast.success(
        variables.hasRsvpd ? "RSVP cancelled successfully!" : "RSVP registered successfully!",
      );
      if (!variables.hasRsvpd && user && !variables.eventId.startsWith("mock-")) {
        const { count } = await supabase
          .from("event_rsvps")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (count === 1) {
          setShowConfetti(true);

          if (confettiTimeoutRef.current) {
            clearTimeout(confettiTimeoutRef.current);
          }

          confettiTimeoutRef.current = setTimeout(() => {
            setShowConfetti(false);
            confettiTimeoutRef.current = null;
          }, 5000);
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
    onSuccess: (_data, variables) => {
      toast.success(variables.isSaved ? "Removed from saved events!" : "Saved to bookmarks!");
      refetch();
    },
    onError: () => {
      toast.error("Failed to update bookmark");
    },
  });

  const handleRsvpToggle = async (eventId: string, hasRsvpd: boolean) => {
    if (!emailVerified && !hasRsvpd) {
      toast.error("Please verify your email to RSVP");
      return;
    }
    // Overlap warning: only check when joining (not leaving), and only if we
    // have start/end times for the target event.
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

      // Handle legacy specific text filter, though we mostly use the new sidebar
      if (filter !== "All" && !text.includes(filter.toLowerCase())) return false;

      // Handle Open Capacity check client-side
      if (filters.openCapacityOnly) {
        if (event.max_attendees === null || event.max_attendees === undefined) return true; // unlimited
        const currentRsvps = Array.isArray(event.event_rsvps) ? event.event_rsvps.length : 0;
        if (currentRsvps >= event.max_attendees) return false; // full
      }

      return true;
    })
    .filter((event) => {
      if (!hidePastEvents) return true;
      const date = event.end_date ?? event.event_date;
      if (!date) return true;
      return new Date(date) > new Date();
    })
    .filter((event) => {
      // Legacy specific date fallback for UI that wasn't removed yet
      if (dateFilterType === "specific" && specificDate) {
        const dateStr = event.start_date ?? event.event_date;
        return matchesDateFilter(dateStr, dateFilterType, specificDate);
      }
      return true;
    });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    const dateA = new Date(a.event_date).getTime();
    const dateB = new Date(b.event_date).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  const handleExportCalendar = useCallback(() => {
    const icsContent = getMultiIcsContent(sortedEvents);
    if (!icsContent) {
      toast.error("No events to export");
      return;
    }
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campus_events.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Calendar exported successfully!");
  }, [sortedEvents]);

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
        <SidebarProvider>
          <div className="flex flex-col md:flex-row w-full bg-cream">
            <EventFilters filters={filters} setFilters={setFilters} />
            <div className="flex-1 w-full flex flex-col min-h-screen">
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
                        aria-label="Search events"
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
                          type="button"
                          aria-label="Clear event search"
                          onClick={() => {
                            setSearchInput("");
                            setSearchQuery("");
                            searchInputRef.current?.focus();
                          }}
                          className="absolute right-2.5 top-1.5 font-mono text-sm font-bold text-neutral-500 hover:text-black cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                        ></button>
                      )}
                      {showRecent && recentSearches.length > 0 && (
                        <div className="absolute z-20 mt-2 w-full neu-border bg-white p-3 shadow-md">
                          <div className="mb-2 flex justify-between font-mono text-xs font-bold">
                            <span>Recent searches</span>
                            <button
                              type="button"
                              onClick={clearSearchHistory}
                              className="text-red-500 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                            >
                              Clear History
                            </button>
                          </div>
                          {recentSearches.map((item) => (
                            <button
                              type="button"
                              key={item}
                              onClick={() => {
                                setSearchInput(item);
                                setSearchQuery(item);
                                saveSearch(item);
                                setShowRecent(false);
                              }}
                              className="block w-full text-left px-2 py-1 hover:bg-cream font-mono text-xs text-black cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
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

                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Choose event date filter"
                            className="neu-border flex items-center gap-2 bg-white px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-cream text-black md:mr-2 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                          >
                            {" "}
                            <CalendarIcon className="h-4 w-4" />
                            {dateFilterType === "all"
                              ? "Any Date"
                              : dateFilterType === "this-week"
                                ? "This Week"
                                : dateFilterType === "next-month"
                                  ? "Next Month"
                                  : specificDate
                                    ? format(specificDate, "MMM d, yyyy")
                                    : "Specific Date"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white"
                          align="start"
                        >
                          <div className="flex flex-col border-b-2 border-black p-2 gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setDateFilterType("all");
                                setSpecificDate(undefined);
                              }}
                              className={`text-left px-2 py-1.5 text-sm font-mono hover:bg-cream cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${dateFilterType === "all" ? "font-bold bg-cream" : ""}`}
                            >
                              Any Date
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDateFilterType("this-week");
                                setSpecificDate(undefined);
                              }}
                              className={`text-left px-2 py-1.5 text-sm font-mono hover:bg-cream cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${dateFilterType === "this-week" ? "font-bold bg-cream" : ""}`}
                            >
                              This Week
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDateFilterType("next-month");
                                setSpecificDate(undefined);
                              }}
                              className={`text-left px-2 py-1.5 text-sm font-mono hover:bg-cream cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${dateFilterType === "next-month" ? "font-bold bg-cream" : ""}`}
                            >
                              Next Month
                            </button>
                          </div>
                          <div className="p-2">
                            <div className="px-2 py-1.5 text-sm font-mono font-bold uppercase">
                              Specific Date
                            </div>
                            <Calendar
                              mode="single"
                              selected={specificDate}
                              onSelect={(date) => {
                                if (date) {
                                  setSpecificDate(date);
                                  setDateFilterType("specific");
                                }
                              }}
                              initialFocus
                            />
                          </div>
                        </PopoverContent>
                      </Popover>

                      {["All", "Workshop", "Talk", "Hackathon", "Social"].map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setFilter(t)}
                          aria-pressed={filter === t}
                          className={`neu-border px-3 py-2 font-mono text-xs font-bold uppercase transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                            filter === t
                              ? filterColors[t] || "bg-black text-cream"
                              : "bg-white text-black"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                      {(filter !== "All" || searchQuery || dateFilterType !== "all") && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilter("All");
                            setSearchInput("");
                            setSearchQuery("");
                            setDateFilterType("all");
                            setSpecificDate(undefined);
                          }}
                          className="neu-border bg-white px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-cream cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
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
                          aria-pressed={viewMode === "list"}
                          className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
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
                          aria-pressed={viewMode === "calendar"}
                          className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black} ${
                            viewMode === "calendar"
                              ? "bg-black text-cream"
                              : "bg-white text-black hover:bg-cream"
                          }`}
                        >
                          Calendar
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportCalendar}
                        className="neu-border flex items-center gap-2 bg-white px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-cream text-black cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                      >
                        <Download className="h-4 w-4" />
                        Export Calendar
                      </button>

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
                        Array.from({ length: 6 }).map((_, i) => (
                          <EventCardSkeleton key={i} index={i} />
                        ))
                      ) : sortedEvents.length === 0 && filter !== "All" ? (
                        <div className="col-span-full mx-auto max-w-md text-center neu-border bg-white p-8 animate-in fade-in-0 zoom-in-95 duration-300">
                          <CalendarIcon
                            className="mx-auto h-10 w-10 text-neutral-500"
                            aria-hidden="true"
                          />
                          <h3 className="mt-3 font-mono text-lg font-bold uppercase">
                            No {filter} events found.
                          </h3>
                          <p className="mt-1 font-mono text-xs text-neutral-600">
                            Try a different category, or clear the filter to see everything.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setFilter("All");
                              setDateFilterType("all");
                              setSpecificDate(undefined);
                            }}
                            className="mt-4 neu-border bg-yellow px-5 py-2 font-mono text-xs font-bold uppercase transition-all hover:bg-black hover:text-white cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                          >
                            Clear filter
                          </button>
                        </div>
                      ) : sortedEvents.length === 0 ? (
                        <div className="col-span-full mx-auto max-w-md text-center neu-border bg-white p-8">
                          <p className="text-3xl">🔍</p>
                          <h3 className="mt-2 font-mono text-lg font-bold uppercase">
                            No Events Found
                          </h3>
                          <p className="mt-1 font-mono text-xs text-neutral-600">
                            No events matched &quot;{searchQuery}&quot;. Try clearing your filters
                            or searching for another term.
                          </p>
                          <button
                            onClick={() => {
                              setFilter("All");
                              setSearchInput("");
                              setSearchQuery("");
                              setDateFilterType("all");
                              setSpecificDate(undefined);
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
                            onRsvpToggle={(eventId, hasRsvpd) =>
                              handleRsvpToggle(eventId, hasRsvpd)
                            }
                            isRsvpPending={toggleRsvp.isPending}
                            onBookmarkToggle={(eventId, isSaved) =>
                              handleBookmarkToggle(eventId, isSaved)
                            }
                            isBookmarkPending={toggleBookmark.isPending}
                          />
                        ))
                      )}
                    </div>

                    {isLoadingMore && (
                      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <EventCardSkeleton key={`loading-more-${i}`} index={i + 6} />
                        ))}
                      </div>
                    )}

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

                        {/* Sentinel element triggers infinite scroll */}
                        <div ref={sentinelRef} aria-hidden="true" />

                        {hasMore ? (
                          <button
                            type="button"
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                            className="neu-border bg-yellow px-10 py-3.5 font-mono text-sm font-bold uppercase transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
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
            </div>
          </div>

          <ScrollAwareFab>
            <CreateEventDialog user={user} variant="fab" />
          </ScrollAwareFab>
        </SidebarProvider>
      </PullToRefresh>
    </SiteShell>
  );
}
