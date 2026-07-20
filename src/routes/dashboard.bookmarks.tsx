import { Bookmark, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EventCard } from "@/components/EventCard";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";
import { useMutation, useQuery } from "@/hooks/useReactQueryReplacement";
import { normalizeSavedEvents } from "@/lib/bookmarks";
import { createClient } from "@/lib/supabase/client";

interface BookmarkedEvent {
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
}

interface SavedEventRow {
  id: string;
  user_id: string;
  event: BookmarkedEvent | BookmarkedEvent[] | null;
}

export default function DashboardBookmarks() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (currentUser) setUser(currentUser);
    });
  }, [supabase]);

  const {
    data: bookmarkedEvents = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["bookmarked-events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_events")
        .select(
          `
          id,
          user_id,
          event:events (
            id,
            title,
            description,
            event_date,
            start_date,
            end_date,
            location,
            banner_url,
            clubs (name),
            event_rsvps (id, user_id)
          )
        `,
        )
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return normalizeSavedEvents((data ?? []) as SavedEventRow[]);
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`bookmarks-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "saved_events",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch, supabase, user?.id]);

  const unsaveEvent = useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      if (!user) throw new Error("You must be signed in to update bookmarks.");

      const { error } = await supabase
        .from("saved_events")
        .delete()
        .match({ event_id: eventId, user_id: user.id });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from bookmarks.");
      void refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove bookmark.");
    },
  });

  const toggleRsvp = useMutation({
    mutationFn: async ({ eventId, hasRsvpd }: { eventId: string; hasRsvpd: boolean }) => {
      if (!user) throw new Error("You must be signed in to update an RSVP.");

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
      void refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update RSVP.");
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b-2 border-black pb-5 dark:border-cream sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow font-bold">Saved for later</p>
          <h2 className="mt-2 text-3xl font-black">My Bookmarks</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            Keep track of events you want to revisit, then remove them whenever they are no longer
            relevant.
          </p>
        </div>

        <span className="neu-border inline-flex w-fit items-center gap-2 bg-white px-3 py-2 font-mono text-xs font-bold uppercase dark:bg-black">
          <Bookmark aria-hidden="true" size={15} fill="currentColor" />
          {bookmarkedEvents.length} saved
        </span>
      </div>

      {isLoading || isFetching ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading bookmarks">
          {Array.from({ length: 3 }).map((_, index) => (
            <EventCardSkeleton key={index} />
          ))}
        </div>
      ) : bookmarkedEvents.length === 0 ? (
        <section className="neu-border relative overflow-hidden bg-lavender px-6 py-14 text-center sm:px-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
            <CalendarDays aria-hidden="true" size={30} strokeWidth={2.5} />
          </div>
          <h3 className="mt-6 text-2xl font-black">No bookmarked events yet</h3>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-700">
            Explore upcoming campus events and tap the bookmark icon on any event you want to save
            here.
          </p>
          <Link
            to="/events"
            className="neu-border neu-press mt-6 inline-flex bg-black px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-cream"
          >
            Explore events →
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {bookmarkedEvents.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              index={index}
              user={user}
              onRsvpToggle={(eventId, hasRsvpd) => toggleRsvp.mutate({ eventId, hasRsvpd })}
              isRsvpPending={toggleRsvp.isPending}
              onBookmarkToggle={(eventId) => unsaveEvent.mutate({ eventId })}
              isBookmarkPending={unsaveEvent.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
