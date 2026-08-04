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
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <SiteShell>
      <section className="border-b-4 border-black bg-lime px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl">
          {isProfileLoading ? (
            <ProfileHeaderSkeleton />
          ) : (
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5">
                <div className="neu-border flex h-20 w-20 items-center justify-center bg-sky text-2xl font-black shadow-[4px_4px_0_0_#000]">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || "User avatar"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(profile?.full_name)
                  )}
                </div>

                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-black/70">
                    {greeting}
                  </span>
                  <h1 className="text-3xl font-black tracking-tight text-black md:text-4xl">
                    {profile?.full_name || "Student"}
                  </h1>
                  {profile?.handle && (
                    <p className="font-mono text-sm text-black/80">@{profile.handle}</p>
                  )}
                </div>
              </div>

              {profile?.bio && (
                <div className="neu-border max-w-md bg-white p-4 font-mono text-xs shadow-[4px_4px_0_0_#000]">
                  <p className="font-bold text-gray-500 uppercase mb-1">Bio</p>
                  <p className="text-black">{profile.bio}</p>
                </div>
              )}
            </div>
          )}

          {/* Sub-Navigation Tabs */}
          <div className="mt-8 flex flex-wrap gap-2 font-mono text-xs">
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
              to="/dashboard/clubs"
              className={({ isActive }) =>
                `neu-border px-4 py-2 font-bold uppercase tracking-wider transition-all shadow-[2px_2px_0_0_#000] ${
                  isActive
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
                }`
              }
            >
              My Clubs
            </NavLink>
            <NavLink
              to="/dashboard/events"
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
              to="/dashboard/saved"
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
