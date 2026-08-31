import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AchievementBoard } from "@/components/achievements/AchievementBoard";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Campus Achievements & Badges Page
 *
 * Gamified badge system rewarding students for event attendance,
 * club participation, volunteering, and community contributions.
 */
export default function AchievementsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) setUser(session.user);
      } catch (err) {
        console.error("Failed to load user for achievements page:", err);
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
          <p className="text-sm text-gray-500 font-mono">Loading achievements...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800 mb-2">Log in to view achievements</p>
          <p className="text-sm text-gray-500">Sign in to track your badges and progress.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Achievements | CampusConnect</title>
        <meta
          name="description"
          content="Track your campus achievements, badges, and leaderboard ranking."
        />
        <meta property="og:title" content="Achievements | CampusConnect" />
      </Helmet>
      <AchievementBoard
        userId={user.id}
        userName={user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Student"}
      />
    </>
  );
}
