import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { ProfileHeaderSkeleton } from "@/components/ProfileHeaderSkeleton";
import { toast } from "sonner";

export default function Dashboard() {
  const [supabase] = useState(() => createClient());
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate("/auth", { replace: true });
      } else {
        setUser(user);
      }
    });
  }, [navigate, supabase]);

  const { data: profile, isLoading } = useQuery({
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
      <section className="border-b-2 border-black bg-lime px-4 py-10 md:px-6">
        <div className="mx-auto max-w-7xl">
          {isLoading ? (
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
