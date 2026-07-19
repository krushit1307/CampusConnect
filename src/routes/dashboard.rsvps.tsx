import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { EventCard } from "@/components/EventCard";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";
import { toast } from "sonner";

export default function DashboardRsvps() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
      }
    });
  }, [supabase]);

  // Fetch events the user has RSVP'd to, including all RSVPs for total count
  const {
    data: rsvps = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["userRsvps", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select(
          `
          id,
          checked_in,
          event:events (
            id,
            title,
            description,
            event_date,
            location,
            banner_url,
            clubs (
              name
            ),
            event_rsvps (
              id,
              user_id
            ),
            saved_events (
              id,
              user_id
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

  const toggleRsvp = useMutation({
    mutationFn: async ({ eventId, hasRsvpd }: { eventId: string; hasRsvpd: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("toggle-rsvp", {
        body: { eventId, hasRsvpd },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update RSVP. Please try again.");
    },
  });

  // Extract event objects and clean type
  // Postgrest returns event as an object or array. We normalize it.
  const events = rsvps
    .map((r) => {
      const rawEvent = r.event;
      if (!rawEvent) return null;
      // In case postgrest returns it as an array
      const event = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
      return event;
    })
    .filter((e): e is NonNullable<typeof e> => !!e);

  // Sort events by date ascending
  events.sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
  });

  const now = new Date().toISOString();
  const upcomingRsvps = events.filter((e) => e.event_date && e.event_date >= now);
  const pastRsvps = events.filter((e) => !e.event_date || e.event_date < now);

  const displayedEvents = activeTab === "upcoming" ? upcomingRsvps : pastRsvps;

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Filtering Tabs */}
      <div className="flex gap-2 border-b-2 border-black pb-4 dark:border-cream">
        <button
          onClick={() => setActiveTab("upcoming")}
          aria-pressed={activeTab === "upcoming"}
          className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all hover:scale-105 active:scale-95 ${
            activeTab === "upcoming"
              ? "bg-black text-cream dark:bg-cream dark:text-black"
              : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
          }`}
        >
          Upcoming ({upcomingRsvps.length})
        </button>
        <button
          onClick={() => setActiveTab("past")}
          aria-pressed={activeTab === "past"}
          className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all hover:scale-105 active:scale-95 ${
            activeTab === "past"
              ? "bg-black text-cream dark:bg-cream dark:text-black"
              : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
          }`}
        >
          Past ({pastRsvps.length})
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : displayedEvents.length === 0 ? (
        <div className="neu-border bg-white p-8 text-center dark:bg-[#1a1a1a]">
          <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
            No {activeTab} RSVPs found.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayedEvents.map((e, index) => (
            <EventCard
              key={e.id}
              event={e}
              index={index}
              user={user}
              onRsvpToggle={(eventId, hasRsvpd) => toggleRsvp.mutate({ eventId, hasRsvpd })}
              isRsvpPending={toggleRsvp.isPending}
              onBookmarkToggle={() => {
                toast.error("Bookmarking from RSVPs tab is not supported yet.");
              }}
              isBookmarkPending={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
