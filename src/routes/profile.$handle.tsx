import { useParams, Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Link2, Calendar, Award, Building, CalendarPlus, ArrowRight } from "lucide-react";
import { NotFoundPage } from "@/components/NotFoundPage";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-none bg-black/10 ${className}`} />;
}

function ProfileSkeleton() {
  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-cream px-4 py-14 md:px-6">
        <div className="mx-auto max-w-4xl flex flex-col md:flex-row items-center md:items-start gap-8">
          <Bone className="h-32 w-32 rounded-full border-4 border-black" />
          <div className="flex-1 text-center md:text-left">
            <Bone className="h-10 w-48 mb-2 mx-auto md:mx-0" />
            <Bone className="h-4 w-32 mb-4 mx-auto md:mx-0" />
            <Bone className="h-4 w-64 mb-2 mx-auto md:mx-0" />
            <Bone className="h-4 w-56 mx-auto md:mx-0" />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

export default function Profile() {
  const { handle } = useParams();
  const supabase = createClient();

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["profile", handle],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          handle,
          avatar_url,
          college,
          bio,
          skills,
          linkedin_url
        `,
        )
        .eq("handle", handle)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: userClubs = [] } = useQuery({
    queryKey: ["profileClubs", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("club_members")
        .select("clubs (id, slug, name, logo_url)")
        .eq("user_id", profile.id)
        .eq("status", "approved");
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ["profileEvents", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("event_rsvps")
        .select("events (id, title, event_date, clubs (slug, name))")
        .eq("user_id", profile.id);

      const events = (data || [])
        .map((r) => (Array.isArray(r.events) ? r.events[0] : r.events))
        .filter(Boolean);
      return events
        .filter((e) => e && e.event_date && new Date(e.event_date) >= new Date())
        .sort((a, b) => new Date(a!.event_date!).getTime() - new Date(b!.event_date!).getTime());
    },
    enabled: !!profile?.id,
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["profileCertificates", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("certificates")
        .select("id, certificate_url, issued_at, events (title)")
        .eq("user_id", profile.id)
        .order("issued_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.id,
  });

  if (isLoading) return <ProfileSkeleton />;
  if (isError || !profile) return <NotFoundPage />;

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl flex flex-col md:flex-row items-center md:items-start gap-8">
          <Avatar className="h-32 w-32 border-4 border-black rounded-full shrink-0">
            <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
            <AvatarFallback className="bg-lime text-3xl font-display font-bold">
              {getInitials(profile.full_name || "Unknown User")}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold font-display text-black">
                {profile.full_name || "Unknown User"}
              </h1>
              <p className="font-mono text-lg text-gray-600 mt-1">@{profile.handle}</p>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 font-mono text-sm text-black">
              {profile.college && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={16} className="text-brand-amber-base" />
                  {profile.college}
                </div>
              )}
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <Link2 size={16} />
                  LinkedIn
                </a>
              )}
            </div>

            {profile.bio && (
              <p className="font-mono text-sm leading-relaxed max-w-2xl mx-auto md:mx-0">
                {profile.bio}
              </p>
            )}

            {profile.skills && profile.skills.length > 0 && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                {profile.skills.map((skill: string) => (
                  <span
                    key={skill}
                    className="neu-border bg-white px-3 py-1 font-mono text-xs font-bold"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl space-y-12">
          {/* Clubs Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b-2 border-black pb-2 text-xl font-bold font-display">
              <Building size={24} className="text-blue-600" />
              <h2>Clubs</h2>
            </div>
            {userClubs.length === 0 ? (
              <p className="font-mono text-sm text-gray-500">Not a member of any clubs yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {userClubs.map((uc: { clubs: unknown }) => {
                  const clubsArr = uc.clubs as
                    | { id: string; slug: string; name: string; logo_url: string | null }
                    | { id: string; slug: string; name: string; logo_url: string | null }[];
                  const club = Array.isArray(clubsArr) ? clubsArr[0] : clubsArr;
                  if (!club) return null;
                  return (
                    <Link
                      key={club.id}
                      to={`/clubs/${club.slug}`}
                      className="neu-border neu-press flex items-center gap-3 bg-peach p-4 transition-transform hover:-translate-y-1"
                    >
                      <Avatar className="h-10 w-10 border-2 border-black rounded-none bg-white">
                        <AvatarImage src={club.logo_url || undefined} className="object-cover" />
                        <AvatarFallback className="rounded-none font-bold">
                          {getInitials(club.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-bold font-mono text-sm truncate">{club.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Events Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b-2 border-black pb-2 text-xl font-bold font-display">
              <Calendar size={24} className="text-lime" />
              <h2>Upcoming Events</h2>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="neu-border neu-shadow-sm flex flex-col items-center gap-4 bg-cream p-8 text-center md:p-10">
                <div className="neu-border inline-flex items-center justify-center bg-lime/40 p-4">
                  <CalendarPlus size={32} className="text-black" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-xl font-bold">No Events RSVP'd Yet</h3>
                  <p className="mx-auto max-w-sm font-mono text-sm text-gray-600">
                    No upcoming events RSVP&apos;d yet. Browse what&apos;s happening on campus and
                    find something worth joining.
                  </p>
                </div>
                <Link
                  to="/events"
                  className="neu-border neu-press inline-flex items-center gap-2 bg-black px-6 py-3 font-mono text-xs font-bold uppercase text-cream transition-colors hover:bg-lime hover:text-black"
                >
                  Browse Events <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y-2 divide-black">
                {upcomingEvents.map(
                  (e: { id: string; title: string; event_date: string | null; clubs: unknown }) => {
                    const clubsArr = e.clubs as
                      { slug: string; name: string } | { slug: string; name: string }[];
                    const club = Array.isArray(clubsArr) ? clubsArr[0] : clubsArr;
                    return (
                      <li
                        key={e.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="font-display font-bold text-lg">{e.title}</span>
                          {club && (
                            <span className="font-mono text-xs text-gray-600">
                              Hosted by{" "}
                              <Link to={`/clubs/${club.slug}`} className="underline font-bold">
                                {club.name}
                              </Link>
                            </span>
                          )}
                        </div>
                        <div className="neu-border bg-gray-100 px-3 py-2 font-mono text-xs font-bold text-black whitespace-nowrap self-start sm:self-auto">
                          {e.event_date
                            ? new Date(e.event_date)
                                .toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                                .toUpperCase()
                            : "TBA"}
                        </div>
                      </li>
                    );
                  },
                )}
              </ul>
            )}
          </div>

          {/* Certificates Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b-2 border-black pb-2 text-xl font-bold font-display">
              <Award size={24} className="text-brand-amber-base" />
              <h2>Certificates</h2>
            </div>
            {certificates.length === 0 ? (
              <p className="font-mono text-sm text-gray-500">No certificates earned yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {certificates.map(
                  (cert: {
                    id: string;
                    certificate_url: string;
                    issued_at: string | null;
                    events: unknown;
                  }) => {
                    const eventsArr = cert.events as { title: string } | { title: string }[];
                    const event = Array.isArray(eventsArr) ? eventsArr[0] : eventsArr;
                    return (
                      <a
                        key={cert.id}
                        href={cert.certificate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neu-border neu-press flex flex-col gap-2 bg-white p-4 hover:-translate-y-1 transition-transform"
                      >
                        <div className="flex items-center justify-center bg-lime/20 border-2 border-black py-6">
                          <Award size={32} className="text-black" />
                        </div>
                        <span className="font-bold font-mono text-sm line-clamp-2 mt-2">
                          {event?.title || "Event Certificate"}
                        </span>
                        <span className="font-mono text-xs text-gray-500">
                          {cert.issued_at
                            ? new Date(cert.issued_at).toLocaleDateString("en-US")
                            : ""}
                        </span>
                      </a>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
