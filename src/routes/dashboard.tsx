import { createFileRoute, Link, useRouter, Outlet } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { ProfileHeaderSkeleton } from "@/components/ProfileHeaderSkeleton";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CampusConnect" },
      { name: "description", content: "Your clubs, events, and activity at a glance." },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.navigate({ to: "/auth", replace: true });
      } else {
        setUser(user);
      }
    });
  }, [router, supabase]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user?.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

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

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-lime px-4 py-10 md:px-6">
        <div className="mx-auto max-w-7xl">
          {isLoading ? (
            <ProfileHeaderSkeleton />
          ) : (
            <>
              <p className="eyebrow font-bold break-all">Signed in as {user.email}</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-5xl">
                Good morning, {profile?.full_name?.split(" ")[0] || "there"}.
              </h1>
            </>
          )}

          {/* Sub-navigation Tabs */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              activeOptions={{ exact: true }}
              activeProps={{
                className: "bg-black text-cream dark:bg-cream dark:text-black",
              }}
              inactiveProps={{
                className:
                  "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10",
              }}
              className="neu-border px-5 py-2 font-mono text-sm font-bold uppercase transition-all"
            >
              Overview
            </Link>
            <Link
              to="/dashboard/rsvps"
              activeProps={{
                className: "bg-black text-cream dark:bg-cream dark:text-black",
              }}
              inactiveProps={{
                className:
                  "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10",
              }}
              className="neu-border px-5 py-2 font-mono text-sm font-bold uppercase transition-all"
            >
              My RSVPs
            </Link>
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
