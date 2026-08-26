import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { StudyGroupBoard } from "@/components/study-groups/StudyGroupBoard";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function StudyGroupsPage() {
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
        console.error("Failed to load user for study groups:", err);
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm text-gray-500 font-mono">Loading study groups...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Study Groups | CampusConnect</title>
        <meta
          name="description"
          content="Create and join study groups for your courses on CampusConnect."
        />
        <meta property="og:title" content="Study Groups | CampusConnect" />
      </Helmet>
      <StudyGroupBoard
        currentUserId={user?.id ?? null}
        currentUserName={
          user?.user_metadata?.full_name ??
          user?.user_metadata?.name ??
          user?.email?.split("@")[0] ??
          "Student"
        }
        currentUserAvatar={user?.user_metadata?.avatar_url ?? null}
      />
    </>
  );
}
