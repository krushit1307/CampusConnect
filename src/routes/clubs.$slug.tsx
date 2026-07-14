import { createFileRoute } from "@tanstack/react-router";
import { RoleBadge } from "@/components/RoleBadge";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

// Small building block for the skeleton below. Deliberately a plain div
// (not the shared ui/skeleton component) to keep this change self-contained.
function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-none bg-black/10 ${className}`} />;
}

export const Route = createFileRoute("/clubs/$slug")({
  head: () => ({
    meta: [
      { title: "Club — CampusConnect" },
      { name: "description", content: "Club profile, events, and members on CampusConnect." },
    ],
  }),
  component: ClubProfile,
});

// Mimics the club header + events/members layout below while data is fetched
// from Supabase, so navigating to a club doesn't flash an empty/blank page.
function ClubProfileSkeleton() {
  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-lime px-4 py-14 md:px-6">
        <div className="mx-auto max-w-6xl">
          <Bone className="h-4 w-16" />
          <Bone className="mt-3 h-12 w-2/3 max-w-md md:h-16" />
          <Bone className="mt-4 h-4 w-full max-w-xl" />
          <Bone className="mt-2 h-4 w-2/3 max-w-md" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Bone className="h-9 w-32" />
            <Bone className="h-9 w-24" />
          </div>
        </div>
      </section>
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          <div className="neu-border bg-white p-6 lg:col-span-2">
            <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold">Upcoming events</h2>
            <div className="divide-y-2 divide-black">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 py-4">
                  <Bone className="h-9 w-14" />
                  <Bone className="h-5 w-1/2" />
                </div>
              ))}
            </div>
          </div>
          <div className="neu-border bg-white p-6">
            <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold">Members</h2>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Bone key={i} className="h-9" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function ClubProfile() {
  const { slug } = Route.useParams();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const { data: club, isLoading } = useQuery({
    queryKey: ["club", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("clubs")
        .select(
          `
          id, name, slug, description,
          club_members (id, role, status, user_id, profiles (full_name)),
          events (id, title, event_date)
        `,
        )
        .eq("slug", slug)
        .single();
      return data;
    },
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user || !club) throw new Error("Must be logged in");
      await supabase.from("club_members").insert({
        club_id: club.id,
        user_id: user.id,
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club", slug] });
    },
  });

  if (isLoading) return <ClubProfileSkeleton />;
  if (!club)
    return (
      <SiteShell>
        <div className="p-10 font-mono">Club not found.</div>
      </SiteShell>
    );

  const members = Array.isArray(club.club_members)
    ? club.club_members.filter((m) => m.status === "approved")
    : [];
  const memberList = members.map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return { name: profile?.full_name || "Unknown User", role: m.role as "admin" | "member" };
  });

  const events = Array.isArray(club.events) ? club.events : [];
  const membership =
    user && Array.isArray(club.club_members)
      ? club.club_members.find((m) => m.user_id === user.id)
      : null;

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-lime px-4 py-14 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow font-bold">Club</p>
          <h1 className="mt-2 text-5xl font-bold md:text-7xl">{club.name}</h1>
          <p className="mt-4 max-w-2xl font-mono text-sm md:text-base">{club.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (!user) return void toast.error("Please sign in first");
                joinMutation.mutate();
              }}
              disabled={!!membership || joinMutation.isPending}
              className={`neu-border neu-press px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider ${membership ? "bg-gray-300 cursor-not-allowed" : "bg-black text-cream"}`}
            >
              {membership
                ? membership.status === "pending"
                  ? "Request Pending"
                  : "Member ✓"
                : "Join club"}
            </button>
            <button className="neu-border neu-press bg-cream px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider">
              Follow
            </button>
          </div>
        </div>
      </section>
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          <div className="neu-border bg-white p-6 lg:col-span-2">
            <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold">Upcoming events</h2>
            {events.length === 0 ? (
              <p className="font-mono text-sm">No upcoming events.</p>
            ) : (
              <ul className="divide-y-2 divide-black">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-4 py-4">
                    <div className="neu-border bg-sky px-3 py-2 font-mono text-xs font-bold">
                      {e.event_date
                        ? new Date(e.event_date)
                            .toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            .toUpperCase()
                        : "TBA"}
                    </div>
                    <p className="flex-1 font-display font-bold">{e.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="neu-border bg-white p-6">
            <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold">
              Members · {members.length}
            </h2>
            {memberList.length === 0 ? (
              <p className="font-mono text-sm">No members yet.</p>
            ) : (
              <ul className="space-y-2 font-mono text-sm">
                {memberList.map((m, i) => (
                  <li
                    key={i}
                    className="neu-border bg-cream flex items-center justify-between gap-2 p-2"
                  >
                    <span className="truncate" title={m.name}>
                      {m.name}
                    </span>
                    <RoleBadge role={m.role} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
