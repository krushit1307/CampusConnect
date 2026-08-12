import { NavLink, Outlet } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { ProfileHeaderSkeleton } from "@/components/ProfileHeaderSkeleton";
import { toast } from "sonner";
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

  interface UserBadge {
    id: string;
    user_id: string;
    badge_name: string;
    awarded_at: string;
  }

  const { data: badges = [] } = useQuery({
    queryKey: ["user_badges", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("*")
        .eq("user_id", user?.id);
      if (error) throw error;
      return (data || []) as UserBadge[];
    },
    enabled: !!user?.id,
  });

  interface CustomWindow extends Window {
    confetti?: (options?: {
      particleCount?: number;
      spread?: number;
      origin?: { y: number };
    }) => void;
  }

  const triggerConfetti = async () => {
    try {
      const customWindow = window as unknown as CustomWindow;
      if (!customWindow.confetti) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load confetti"));
          document.body.appendChild(script);
        });
      }
      const confettiFn = customWindow.confetti;
      if (confettiFn) {
        confettiFn({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    } catch (e) {
      console.error("Confetti trigger failed:", e);
    }
  };

  useEffect(() => {
    if (badges.length > 0) {
      const badgeNames = badges.map((b: UserBadge) => b.badge_name).join(",");
      const prevBadges = localStorage.getItem("cc_seen_badges") || "";
      if (badgeNames !== prevBadges) {
        const prevArray = prevBadges.split(",");
        const hasNew = badges.some((b: UserBadge) => !prevArray.includes(b.badge_name));
        if (hasNew) {
          triggerConfetti();
          toast.success("Congratulations! You unlocked a new badge!", {
            description: badges.map((b: UserBadge) => b.badge_name).join(", "),
          });
        }
        localStorage.setItem("cc_seen_badges", badgeNames);
      }
    }
  }, [badges]);

  if (!user)
    return (
      <SiteShell>
        <section className="border-b-2 border-black bg-lime px-4 py-10 md:px-6">
          <div className="mx-auto max-w-7xl">
            <ProfileHeaderSkeleton />
          </div>
        </section>
      </SiteShell>
    );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <SiteShell>
      <section className="border-b-4 border-black bg-lime px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl">
          {isProfileLoading ? (
            <ProfileHeaderSkeleton />
          ) : (
            <>
              <p className="eyebrow font-bold break-all">Signed in as {user.email}</p>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-5xl">
                    {greeting}, {profile?.first_name || "there"}.
                  </h1>
                </div>
                {badges.length > 0 && (
                  <div className="mt-4 md:mt-0 flex flex-wrap gap-2 items-center bg-white/20 p-3 border-2 border-black">
                    <span className="font-mono text-xs font-bold uppercase text-black">
                      Badges:
                    </span>
                    {badges.map((b) => (
                      <span
                        key={b.id}
                        title={b.badge_name}
                        className="bg-black text-lime neu-border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider animate-bounce"
                      >
                        🏅 {b.badge_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
            </>
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
