import { Link } from "react-router-dom";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";

export default function DashboardOverview() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
      }
    });
  }, [supabase]);

  const { data: userClubs = [] } = useQuery({
    queryKey: ["userClubs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
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
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ["upcomingEvents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
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
        .order("event_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const colors = ["bg-lime", "bg-sky", "bg-peach"];

  if (!user) return null;

  return (
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
                  <span className="neu-border shrink-0 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase">
                    RSVP'd
                  </span>
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
                      <Link to={`/clubs/${club?.slug || ""}`}>{club?.name}</Link>
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
  );
}

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
    <div className={`neu-border bg-white p-4 sm:p-6 ${className}`}>
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
