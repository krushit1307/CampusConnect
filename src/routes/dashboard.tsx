import { NavLink, Outlet } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { ProfileHeaderSkeleton } from "@/components/ProfileHeaderSkeleton";
import { withAuth, WithAuthProps } from "@/hoc/withAuth";

function DashboardContent({ user }: WithAuthProps) {
  const [supabase] = useState(() => createClient());

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <SiteShell>
      <section className="border-b-4 border-black bg-lime px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl">
          {isProfileLoading ? (
            <ProfileHeaderSkeleton />
          ) : (
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center border-2 border-black bg-white font-display text-2xl font-black text-black shadow-[4px_4px_0_0_#000]">
                  {getInitials(profile?.full_name || user?.email)}
                </div>
                <div>
                  <h1 className="font-display text-3xl font-black uppercase text-black">
                    {greeting},{" "}
                    {profile?.full_name || profile?.first_name || user?.email?.split("@")[0]}!
                  </h1>
                  <p className="font-mono text-sm text-black/70">
                    Welcome to your CampusConnect portal.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3 font-mono text-xs">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `neu-border px-4 py-2 font-bold uppercase tracking-wider transition-all shadow-[2px_2px_0_0_#000] ${
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
                `neu-border px-4 py-2 font-bold uppercase tracking-wider transition-all shadow-[2px_2px_0_0_#000] ${
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
                `neu-border px-4 py-2 font-bold uppercase tracking-wider transition-all shadow-[2px_2px_0_0_#000] ${
                  isActive
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
                }`
              }
            >
              Saved Events
            </NavLink>
            <NavLink
              to="/dashboard/calendar"
              className={({ isActive }) =>
                `neu-border px-4 py-2 font-bold uppercase tracking-wider transition-all shadow-[2px_2px_0_0_#000] ${
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

export default withAuth(DashboardContent);
