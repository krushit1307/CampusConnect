import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { PollBoard } from "@/components/polls/PollBoard";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Campus Polls & Quick Surveys Page
 *
 * Create real-time polls for campus-wide or club-specific decisions.
 * Supports single-choice, multiple-choice, and yes/no poll types
 * with optional anonymous voting and expiration.
 */
export default function PollsPage() {
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
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          if (profile?.role === "club_admin") setIsAdmin(true);
        }
      } catch (err) {
        console.error("Failed to load user for polls page:", err);
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
          <p className="text-sm text-gray-500 font-mono">Loading polls...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Campus Polls | CampusConnect</title>
        <meta
          name="description"
          content="Create and vote on campus polls. Real-time results for community decisions."
        />
        <meta property="og:title" content="Campus Polls | CampusConnect" />
      </Helmet>
      <PollBoard
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
