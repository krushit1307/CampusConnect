import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { ProfileHeaderSkeleton } from "@/components/ProfileHeaderSkeleton";

export default function Dashboard() {
  const [supabase] = useState(() => createClient());
  const navigate = useNavigate();

  const { data: user, isLoading: isAuthLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user || null;
    },
  });

  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isAuthLoading, navigate]);

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (isAuthLoading || !user) {
    return (
      <SiteShell>
        <section className="border-b-2 border-black bg-lime px-4 py-10 md:px-6">
          <div className="mx-auto max-w-7xl">
            <ProfileHeaderSkeleton />
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-lime px-4 py-10 md:px-6">
        <div className="mx-auto max-w-7xl">
          {isProfileLoading ? (
            <ProfileHeaderSkeleton />
          ) : (
            <>
              <p className="eyebrow font-bold break-all">Signed in as {user.email}</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-5xl">
                {greeting}, {profile?.full_name?.split(" ")[0] || "there"}.
              </h1>
            </>
          )}

          {/* Sub-navigation Tabs */}
          <div className="mt-8 flex flex-wrap gap-3">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `neu-border px-5 py-2 font-mono text-sm font-bold uppercase transition-all ${
                  isActive
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
                }`
              }
            >
              Overview
            </NavLink>
            <NavLink
              to="/dashboard/rsvps"
              className={({ isActive }) =>
                `neu-border px-5 py-2 font-mono text-sm font-bold uppercase transition-all ${
                  isActive
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
                }`
              }
            >
              My RSVPs
            </NavLink>
            <NavLink
              to="/dashboard/bookmarks"
              className={({ isActive }) =>
                `neu-border px-5 py-2 font-mono text-sm font-bold uppercase transition-all ${
                  isActive
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
                }`
              }
            >
              My Bookmarks
            </NavLink>
            <NavLink
              to="/dashboard/calendar"
              className={({ isActive }) =>
                `neu-border px-5 py-2 font-mono text-sm font-bold uppercase transition-all ${
                  isActive
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
                }`
              }
            >
              My Calendar
            </NavLink>
          </div>
        </div>
      </section>
      <section className="bg-cream px-4 py-10 md:px-6">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </section>
    </SiteShell>
  );
}
