import { useParams } from "react-router-dom";
import { RoleBadge } from "@/components/RoleBadge";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Github } from "lucide-react";

// Small building block for the skeleton below. Deliberately a plain div
// (not the shared ui/skeleton component) to keep this change self-contained.
function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-none bg-black/10 ${className}`} />;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Mimics the club header + events/members layout below while data is fetched
// from Supabase, so navigating to a club doesn't flash an empty/blank page.
function ClubProfileSkeleton() {
  return (
    <SiteShell>
      <section className="border-b-2 border-black px-4 py-14 md:px-6">
        <div className="mx-auto max-w-6xl">
          <Bone className="h-4 w-16" />
          <Bone className="mt-3 h-12 w-2/3 max-w-md md:h-16" />
          <Bone className="mt-4 h-4 w-full max-w-xl" />
          <Bone className="mt-2 h-4 w-2/3 max-w-md" />

          {/* Members list skeleton loader */}
          <div className="mt-8 max-w-2xl">
            <Bone className="h-6 w-24 mb-3" />
            <Bone className="h-4 w-32 mb-2" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="neu-border bg-white flex items-center gap-3 p-3">
                  <Bone className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1">
                    <Bone className="h-4 w-2/3" />
                  </div>
                  <Bone className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Bone className="h-9 w-32" />
            <Bone className="h-9 w-24" />
          </div>
        </div>
      </section>
      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="neu-border bg-white p-6">
            <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold text-indigo-900">
              Upcoming events
            </h2>
            <div className="divide-y-2 divide-black">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 py-4">
                  <Bone className="h-9 w-14" />
                  <Bone className="h-5 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

export default function ClubProfile() {
  const { slug } = useParams();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const {
    data: club,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["club", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("clubs")
        .select(
          `
          id, name, slug, description, github_repo_url,
          club_members (id, role, status, user_id, profiles (full_name, avatar_url, handle)),
          events (id, title, event_date)
        `,
        )
        .eq("slug", slug)
        .eq("status", "approved")
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
      refetch();
    },
  });

  if (isLoading) return <ClubProfileSkeleton />;
  if (!club)
    return (
      <SiteShell>
        <div className="p-10 font-mono text-gray-700">Club not found.</div>
      </SiteShell>
    );

  const members = Array.isArray(club.club_members)
    ? club.club_members.filter((m) => m.status === "approved")
    : [];
  const memberList = members.map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      name: profile?.full_name || "Unknown User",
      handle: profile?.handle || "",
      role: m.role as "admin" | "member" | "organizer" | "alumni",
      avatarUrl: profile?.avatar_url || null,
    };
  });

  const filteredMembers = memberList.filter((m) => {
    const query = searchQuery.toLowerCase();
    return m.name.toLowerCase().includes(query) || m.handle.toLowerCase().includes(query);
  });

  const displayedMembers = isExpanded ? filteredMembers : filteredMembers.slice(0, 10);

  const events = Array.isArray(club.events) ? club.events : [];
  const membership =
    user && Array.isArray(club.club_members)
      ? club.club_members.find((m) => m.user_id === user.id)
      : null;

  return (
    <SiteShell>
      <section className="border-b-2 border-black px-4 py-14 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow font-bold text-blue-900">Club</p>
          <h1 className="mt-2 text-5xl font-bold text-[#123a57] md:text-7xl">{club.name}</h1>
          <div className="markdown-content mt-4 max-w-2xl font-mono text-sm md:text-base leading-relaxed">
            <ReactMarkdown>{club.description || ""}</ReactMarkdown>
          </div>

          {/* Members section below the description */}
          <div className="mt-8 max-w-2xl">
            <h3 className="font-display text-lg font-bold text-blue-900">Members</h3>
            <p className="font-mono text-xs text-black mt-1 mb-3">
              {memberList.length} members total
            </p>
            {memberList.length === 0 ? (
              <p className="font-mono text-sm text-black">No members yet.</p>
            ) : (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search members by name or handle..."
                    aria-label="Search members by name or handle"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-lime/10"
                  />
                </div>
                {filteredMembers.length === 0 ? (
                  <p className="font-mono text-sm text-gray-700">No members match your search.</p>
                ) : (
                  <>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {displayedMembers.map((m, i) => (
                        <li
                          key={i}
                          className="neu-border bg-white flex items-center gap-3 p-3 font-mono text-sm"
                        >
                          <Avatar className="h-10 w-10 border-2 border-black rounded-full">
                            <AvatarImage
                              src={m.avatarUrl || undefined}
                              alt={m.name}
                              className="rounded-full"
                            />
                            <AvatarFallback className="rounded-full bg-[#bce3f2] text-black font-bold">
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate" title={m.name}>
                              {m.name}
                            </p>
                            {m.handle && (
                              <p className="text-xs text-gray-500 truncate" title={`@${m.handle}`}>
                                @{m.handle}
                              </p>
                            )}
                          </div>
                          <RoleBadge role={m.role} />
                        </li>
                      ))}
                    </ul>
                    {filteredMembers.length > 10 && (
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="neu-border neu-press mt-4 bg-cream px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-cream transition-colors"
                      >
                        {isExpanded ? "View less" : "View all"}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>

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
            <button
              onClick={() => toast.info("Follow feature coming soon!")}
              className="neu-border neu-press bg-cream px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider"
            >
              Follow
            </button>
            {club.github_repo_url && (
              <a
                href={club.github_repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border neu-press inline-flex items-center gap-2 bg-white px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-lime/20"
              >
                <Github className="h-4 w-4" />
                GitHub Repo
              </a>
            )}
          </div>
        </div>
      </section>
      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="neu-border bg-white p-6">
            <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold text-black">
              Upcoming events
            </h2>
            {events.length === 0 ? (
              <p className="font-mono text-sm text-black">No upcoming events.</p>
            ) : (
              <ul className="divide-y-2 divide-black">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-4 py-4">
                    <div className="neu-border bg-gray-100 px-3 py-2 font-mono text-xs font-bold text-gray-700">
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
        </div>
      </section>
    </SiteShell>
  );
}
