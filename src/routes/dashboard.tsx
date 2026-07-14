import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button"; // Added unified Button component import
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
  component: Dashboard,
});

function Dashboard() {
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

  const { data: userClubs = [] } = useQuery({
    queryKey: ["userClubs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("club_members")
        .select(
          `
          role,
          clubs (
            id, name, slug
          )
        `,
        )
        .eq("user_id", user?.id)
        .eq("status", "approved");
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ["upcomingEvents", user?.id],
    queryFn: async () => {
      // Fetch events the user has RSVP'd to that are in the future
      const { data } = await supabase
        .from("events")
        .select(
          `
          *,
          clubs (name),
          event_rsvps!inner (
            id, user_id
          )
        `,
        )
        .eq("event_rsvps.user_id", user?.id)
        .gte("event_date", new Date().toISOString())
        .limit(3);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const colors = ["bg-lime", "bg-sky", "bg-peach"];

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
              <p className="eyebrow font-bold">Signed in as {user.email}</p>
              <h1 className="mt-2 text-4xl font-bold md:text-5xl">
                Good morning, {profile?.full_name?.split(" ")[0] || "there"}.
              </h1>
            </>
          )}
        </div>
      </section>
      <section className="bg-cream px-4 py-10 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          <Widget
            title="Upcoming events"
            cta={{ label: "All events", to: "/events" }}
            className="lg:col-span-2"
          >
            {upcomingEvents.length === 0 ? (
              <p className="py-4 font-mono text-sm text-gray-500">No upcoming events yet.</p>
            ) : (
              <ul className="divide-y-2 divide-black">
                {upcomingEvents.map((r, i) => {
                  const e = r;
                  const c = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs;
                  return (
                    <li key={r.id} className="flex items-center gap-4 py-4">
                      <div
                        className={`neu-border ${colors[i % colors.length]} shrink-0 px-3 py-2 text-center font-mono text-xs font-bold`}
                      >
                        {e?.event_date
                          ? new Date(e.event_date)
                              .toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              .toUpperCase()
                          : "TBA"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg font-bold">{e?.title}</p>
                        <p className="font-mono text-xs">{c?.name}</p>
                      </div>
                      {/* ✨ Replaced the raw HTML button with our unified Button component */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="neu-border shrink-0 bg-white px-3 py-1 font-mono text-xs font-bold uppercase"
                      >
                        RSVP'd
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>
          <Widget title="Your clubs" cta={{ label: "Directory", to: "/clubs" }}>
            {userClubs.length === 0 ? (
              <p className="font-mono text-sm text-gray-500">You haven't joined any clubs yet.</p>
            ) : (
              <ul className="space-y-3">
                {userClubs.map((c) => {
                  const club = Array.isArray(c.clubs) ? c.clubs[0] : c.clubs;
                  return (
                    <li
                      key={club?.id}
                      className="neu-border flex items-center justify-between bg-cream p-3"
                    >
                      <div>
                        <p className="font-display font-bold">
                          <Link to="/clubs/$slug" params={{ slug: club?.slug || "" }}>
                            {club?.name}
                          </Link>
                        </p>
                        <p className="font-mono text-xs">Active</p>
                      </div>
                      <span className="neu-border bg-lime px-2 py-1 font-mono text-[10px] font-bold uppercase">
                        {c.role}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>
          <Widget title="Recent activity" className="lg:col-span-3">
            <ul className="grid gap-3 font-mono text-sm md:grid-cols-2">
              <li className="flex items-start gap-2">
                <span className="mt-2 inline-block h-2 w-2 shrink-0 bg-black" />
                No recent activity fetched yet.
              </li>
            </ul>
          </Widget>
        </div>
      </section>
    </SiteShell>
  );
}

// Widget component implementation below remains unchanged...
function Widget({
  title,
  cta,
  className = "",
  children,
}: {
  title: string;
  cta?: { label: string; to: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`neu-border bg-white p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {cta && (
          <Link to={cta.to} className="font-mono text-xs font-bold uppercase underline">
            {cta.label} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
