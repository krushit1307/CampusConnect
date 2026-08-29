import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { SuggestionBoard } from "@/components/suggestions/SuggestionBoard";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Event Suggestions & Voting Board Page
 *
 * Students propose campus events, upvote their favorites, and club admins
 * review the highest-voted suggestions for approval and implementation.
 *
 * Features:
 * - Create new event suggestions with categories, dates, locations, and budgets
 * - Upvote/downvote suggestions with optimistic updates
 * - Filter by category, status, and search text
 * - Sort by newest, most voted, or most discussed
 * - Comment on suggestions for discussion
 * - Admin review panel to approve/reject/track suggestions
 * - Stats dashboard showing aggregate metrics and category breakdown
 */
export default function SuggestionBoardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);

          // Check if user is club_admin
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

          if (profile?.role === "club_admin") {
            setIsAdmin(true);
          }
        }
      } catch (err) {
        console.error("Failed to load user for suggestions page:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-gray-500 font-mono">Loading suggestions...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Event Suggestions | CampusConnect</title>
        <meta
          name="description"
          content="Propose campus event ideas, vote on favorites, and help shape your campus experience on CampusConnect."
        />
        <meta property="og:title" content="Event Suggestions | CampusConnect" />
        <meta property="og:description" content="Vote on and propose campus event ideas." />
      </Helmet>
      <SuggestionBoard
        currentUserId={user?.id ?? null}
        currentUserName={
          user?.user_metadata?.full_name ??
          user?.user_metadata?.name ??
          user?.email?.split("@")[0] ??
          "Anonymous"
        }
        currentUserAvatar={user?.user_metadata?.avatar_url ?? null}
        isAdmin={isAdmin}
      />
    </>
  );
}
