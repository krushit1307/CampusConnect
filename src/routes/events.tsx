import { formatDate } from "../lib/utils";

import { SiteShell } from "@/components/site/SiteShell";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { EventCard } from "@/components/EventCard";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { toast } from "sonner";
import Search from "lucide-react/dist/esm/icons/search";
import { useDebounce } from "@/hooks/use-debounce";
import { AutocompleteDropdown, AutocompleteResult } from "@/components/AutocompleteDropdown";
import { useNavigate } from "react-router-dom";
import { getRsvpIdempotencyKey, clearRsvpIdempotencyKey } from "@/lib/rsvpIdempotency";
import { PullToRefresh } from "@/components/PullToRefresh";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default EventsPage;

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  banner_url?: string | null;
  clubs: { name: string } | { name: string }[] | null;
  event_rsvps: { id: string; user_id: string }[] | null;
  saved_events: { id: string; user_id: string }[] | null;
}

const SORT_KEY = "event-sort-order";

function EventsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "newest" | "oldest">("asc");
  const [sortLoaded, setSortLoaded] = useState(false);
  const [hidePastEvents, setHidePastEvents] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map" | "calendar">("list");

  useEffect(() => {
    if (!sortLoaded) return;

    sessionStorage.setItem("event-sort-order", sortOrder);
  }, [sortOrder, sortLoaded]);

  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(5);
  useEffect(() => {
    sessionStorage.setItem(SORT_KEY, sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const { data: autocompleteResults, isLoading: isAutocompleteLoading } = useQuery({
    queryKey: ["events-autocomplete", debouncedSearchQuery],
    queryFn: async () => {
      if (!debouncedSearchQuery.trim()) return [];
      const { data, error } = await supabase
        .from("events")
        .select("id, title, location")
        .or(`title.ilike.%${debouncedSearchQuery}%,location.ilike.%${debouncedSearchQuery}%`)
        .limit(5);

      if (error) {
        console.error("Autocomplete error:", error);
        return [];
      }
      return (data || []).map((event: Record<string, unknown>) => ({
        id: event.id as string,
        title: event.title as string,
      }));
    },
  });
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const {
    data: queryData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(
          `
          id, title, description, event_date, location, banner_url, created_at, announce_date,
          clubs (name, average_lead_time_days),
          event_rsvps (id, user_id),
          saved_events (id, user_id)
        `,
        )
        .order("event_date", { ascending: sortOrder === "oldest" });

      if (import.meta.env.DEV && (!data || data.length === 0)) {
        return [
          {
            id: "mock-1",
            title: "Hackathon 2024",
            description: "Annual college hackathon. Build something awesome in 24 hours!",
            event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            location: "Main Auditorium",
            clubs: { name: "Tech Club" },
            event_rsvps: [{ id: "rsvp-1", user_id: "user-1" }],
            saved_events: [],
          },
          {
            id: "mock-2",
            title: "Watercolor Workshop",
            description: "Learn the basics of watercolor painting.",
            event_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
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

  const events = queryData || [];

  const { data: nearbyEvents, isFetching: isFetchingNearby } = useQuery({
    queryKey: ["events-nearby", userCoords, radiusMiles],
    queryFn: async () => {
      if (!userCoords) return [];
      const radiusMeters = radiusMiles * 1609.34; // miles -> meters, since the RPC expects meters
      const { data, error } = await getEventsNearby(userCoords.lat, userCoords.lng, radiusMeters);
      if (error) {
        toast.error("Could not load nearby events.");
        return [];
      }
      return data || [];
    },
    enabled: nearMeActive && !!userCoords,
  });

  const handleFindNearMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Browser GPS reports latitude first, then longitude — we keep that
        // order here; getEventsNearby/get_events_nearby handle converting it
        // into the Lng-then-Lat order PostGIS's ST_MakePoint requires.
        setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setNearMeActive(true);
      },
      () => {
        toast.error("Unable to retrieve your location.");
      },
    );
  };
  useEffect(() => {
    const channel = supabase
      .channel("realtime_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, () => {
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["upcomingEvents"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "saved_events" }, () => {
        queryClient.invalidateQueries({ queryKey: ["events"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  const toggleRsvp = useMutation({
    mutationFn: async ({ eventId, hasRsvpd }: { eventId: string; hasRsvpd: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      if (eventId.startsWith("mock-")) {
        console.log(`[CampusConnect] Mock RSVP toggled for event: ${eventId}`);
        return;
      }
      const idempotencyKey = getRsvpIdempotencyKey(eventId);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { error } = await supabase.functions.invoke("toggle-rsvp", {
        body: { eventId, hasRsvpd },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Idempotency-Key": idempotencyKey,
        },
      });
      if (error) throw error;
      clearRsvpIdempotencyKey(eventId);
    },
    onMutate: async ({ eventId, hasRsvpd }) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      const previousEvents = queryClient.getQueryData<EventItem[]>(["events"]);

      if (previousEvents) {
        queryClient.setQueryData<EventItem[]>(
          ["events"],
          previousEvents.map((e) => {
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
      }

      return { previousEvents };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEvents) queryClient.setQueryData(["events"], context.previousEvents);
      toast.error("Failed to update RSVP.");
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.hasRsvpd ? "RSVP cancelled successfully!" : "RSVP registered successfully!",
      );
      if (!variables.eventId.startsWith("mock-")) {
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["upcomingEvents"] });
      }
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

      if (error) throw new Error(error.message);
    },
    onMutate: async ({ eventId, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      const previousEvents = queryClient.getQueryData<EventItem[]>(["events"]);

      if (previousEvents) {
        queryClient.setQueryData<EventItem[]>(
          ["events"],
          previousEvents.map((e) => {
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
      }

      return { previousEvents };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEvents) queryClient.setQueryData(["events"], context.previousEvents);
      toast.error("Failed to update bookmark.");
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.isSaved ? "Removed from saved events!" : "Saved to bookmarks!");
      if (!variables.eventId.startsWith("mock-")) {
        queryClient.invalidateQueries({ queryKey: ["events"] });
      }
    },
  });

  const filteredEvents = events.filter((e) => {
    if (hidePastEvents && e.event_date && new Date(e.event_date) < new Date()) return false;
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      return e.title.toLowerCase().includes(q) || (e.location?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  void navigate;

  return (
    <SiteShell>
      <PullToRefresh
        isRefreshing={isFetching}
        onRefresh={async () => {
          await refetch();
        }}
      >
        {" "}
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
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsAutocompleteOpen(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) setIsAutocompleteOpen(true);
                  }}
                  placeholder="Search events by name, location..."
                  className="neu-border w-full bg-white pl-9 pr-8 py-2 font-mono text-xs focus:outline-none placeholder:text-neutral-500"
                />
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setIsAutocompleteOpen(false);
                    }}
                    className="absolute right-2.5 top-1.5 font-mono text-sm font-bold text-neutral-500 hover:text-black cursor-pointer"
                  >
                    ×
                  </button>
                )}
                <AutocompleteDropdown
                  query={debouncedSearchQuery}
                  isOpen={isAutocompleteOpen && debouncedSearchQuery.length > 0}
                  isLoading={isAutocompleteLoading}
                  results={autocompleteResults || []}
                  onSelect={(result) => {
                    setSearchQuery(result.title);
                    setFilter("All");
                    setIsAutocompleteOpen(false);
                  }}
                  onClose={() => setIsAutocompleteOpen(false)}
                />
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
                    className={`neu-border px-3 py-2 font-mono text-xs font-bold uppercase ${filter === t ? "bg-black text-cream" : "bg-white text-black"}`}
                  >
                    {t}
                  </button>
                ))}
                {filter !== "All" && (
                  <button
                    onClick={() => setFilter("All")}
                    className="neu-border bg-white px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-cream cursor-pointer"
                  >
                    Clear All
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
                  onValueChange={(value) => setSortOrder(value as "asc" | "desc")}
                >
                  <SelectTrigger className="neu-border w-44 bg-white font-mono text-xs text-black">
                    <SelectValue placeholder="Sort by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Oldest First</SelectItem>
                    <SelectItem value="desc">Newest First</SelectItem>
                  </SelectContent>
                </Select>

                <CreateEventDialog user={user} />
              </div>
            </div>
          </div>
        </section>
        <section className="bg-cream px-4 py-12 md:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isFetching && !isLoading && (
              <div className="col-span-full text-center font-mono text-xs text-gray-500">
                Refreshing...
              </div>
            )}
            {isLoading ? (
              <div className="col-span-full font-mono text-center py-10">Loading events...</div>
            ) : (
              filteredEvents.map((e, index) => (
                <EventCard
                  key={e.id}
                  event={e}
                  index={index}
                  user={user}
                  onRsvpToggle={(eventId, hasRsvpd) => toggleRsvp.mutate({ eventId, hasRsvpd })}
                  isRsvpPending={toggleRsvp.isPending}
                  onBookmarkToggle={(eventId, isSaved) =>
                    toggleBookmark.mutate({ eventId, isSaved })
                  }
                  isBookmarkPending={toggleBookmark.isPending}
                />
              ))
            )}
          </div>
          <div className="mx-auto max-w-7xl mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => refetch()}
              className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream"
            >
              Refresh
            </button>
          </div>
        </section>
      </PullToRefresh>
    </SiteShell>
  );
}
