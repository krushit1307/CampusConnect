import { formatDate } from "../lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { EventCard } from "@/components/EventCard";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — CampusConnect" },
      {
        name: "description",
        content: "Discover and RSVP to workshops, talks, hackathons, and meetups on campus.",
      },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const { data: queryData, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(
          `
          id, title, description, event_date, location, banner_url,
          clubs (name),
          event_rsvps (id, user_id),
          saved_events (id, user_id)
        `,
        )
        .order("event_date", { ascending: true });

      // Fallback to mock data in development if database is empty
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
        // Skip database call for mock event cards in development
        console.log(`[CampusConnect] Mock RSVP toggled for event: ${eventId}`);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("toggle-rsvp", {
        body: { eventId, hasRsvpd },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (error) {
        throw error;
      }
    },
    onMutate: async ({ eventId, hasRsvpd }) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });

      const previousEvents = queryClient.getQueryData<any[]>(["events"]);

      if (previousEvents) {
        queryClient.setQueryData<any[]>(
          ["events"],
          previousEvents.map((e) => {
            if (e.id === eventId) {
              const rsvpsList = Array.isArray(e.event_rsvps) ? e.event_rsvps : [];
              if (hasRsvpd) {
                return {
                  ...e,
                  event_rsvps: rsvpsList.filter((r: any) => r.user_id !== user?.id),
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
    onError: (_err, _newVariables, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(["events"], context.previousEvents);
      }
      toast.error("Failed to update RSVP.");
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.hasRsvpd ? "RSVP cancelled successfully!" : "RSVP registered successfully!");
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
        ? await supabase.from("saved_events").delete().match({ event_id: eventId, user_id: user.id })
        : await supabase.from("saved_events").insert({ event_id: eventId, user_id: user.id });

      if (error) {
        throw new Error(error.message);
      }
    },
    onMutate: async ({ eventId, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });

      const previousEvents = queryClient.getQueryData<any[]>(["events"]);

      if (previousEvents) {
        queryClient.setQueryData<any[]>(
          ["events"],
          previousEvents.map((e) => {
            if (e.id === eventId) {
              const savedList = Array.isArray(e.saved_events) ? e.saved_events : [];
              if (isSaved) {
                return {
                  ...e,
                  saved_events: savedList.filter((s: any) => s.user_id !== user?.id),
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
    onError: (_err, _newVariables, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(["events"], context.previousEvents);
      }
      toast.error("Failed to update bookmark.");
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.isSaved ? "Removed from saved events!" : "Saved to bookmarks!");
      if (!variables.eventId.startsWith("mock-")) {
        queryClient.invalidateQueries({ queryKey: ["events"] });
      }
    },
  });

  const colors = ["bg-lime", "bg-sky", "bg-peach", "bg-lavender"];

  const filteredEvents = filter === "All" ? events : events.filter(() => true);

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-sky px-4 py-14 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow font-bold">All events · Fall semester</p>
            <h1 className="mt-2 text-4xl font-bold md:text-6xl">What's on this week.</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["All", "Workshop", "Talk", "Hackathon", "Social"].map((t, i) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`neu-border px-3 py-2 font-mono text-xs font-bold uppercase ${filter === t ? "bg-black text-cream" : "bg-white"}`}
              >
                {t}
              </button>
            ))}
            <CreateEventDialog user={user} />
          </div>
        </div>
      </section>
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                onBookmarkToggle={(eventId, isSaved) => toggleBookmark.mutate({ eventId, isSaved })}
                isBookmarkPending={toggleBookmark.isPending}
              />
            ))
          )}
        </div>
      </section>
    </SiteShell>
  );
}
