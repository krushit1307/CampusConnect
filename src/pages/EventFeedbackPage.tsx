import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { EventFeedbackBoard } from "@/components/feedback/EventFeedbackBoard";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function EventFeedbackPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState("Event");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) setUser(session.user);

        if (eventId) {
          const { data: event } = await supabase
            .from("events")
            .select("title")
            .eq("id", eventId)
            .single();
          if (event) setEventTitle((event as any).title);
        }
      } catch (err) {
        console.error("Failed to load feedback page:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
          <p className="text-sm text-gray-500 font-mono">Loading reviews...</p>
        </div>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-gray-500">No event specified.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Reviews for {eventTitle} | CampusConnect</title>
        <meta
          name="description"
          content={`Read and write reviews for ${eventTitle} on CampusConnect.`}
        />
        <meta property="og:title" content={`Reviews for ${eventTitle} | CampusConnect`} />
      </Helmet>
      <EventFeedbackBoard
        eventId={eventId}
        eventTitle={eventTitle}
        currentUserId={user?.id ?? null}
        currentUserName={
          user?.user_metadata?.full_name ??
          user?.user_metadata?.name ??
          user?.email?.split("@")[0] ??
          "Anonymous"
        }
        currentUserAvatar={user?.user_metadata?.avatar_url ?? null}
      />
    </>
  );
}
