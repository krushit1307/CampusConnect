import { Link } from "react-router-dom";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import {
  Sparkles,
  Check,
  X,
  ArrowRight,
  User as UserIcon,
  GraduationCap,
  FileText,
  Link2,
} from "lucide-react";
import TrendingCarousel from "@/components/Clubs/TrendingCarousel";

interface SavedEventDetails {
  id: string;
  title: string;
  event_date: string | null;
  clubs: { name: string } | { name: string }[] | null;
}

interface DashboardSavedEvent {
  id: string;
  events: SavedEventDetails[] | SavedEventDetails | null;
}

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

  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("cc_welcome_dismissed") === "true";
  });

  const [animateIn, setAnimateIn] = useState(false);

  const { data: trendingClubs = [] } = useQuery({
    queryKey: ["trendingClubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("*")
        .order("member_count", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!dismissed) {
      const timer = setTimeout(() => setAnimateIn(true), 50);
      return () => clearTimeout(timer);
    }
  }, [dismissed]);

  const steps = [
    {
      id: "handle",
      label: "Choose a handle",
      hint: "Create your unique @username",
      completed: !!profile?.handle,
    },
    {
      id: "college",
      label: "Specify college",
      hint: "Connect with your peers",
      completed: !!profile?.college,
    },
    {
      id: "bio",
      label: "Write a bio",
      hint: "Introduce yourself to clubs",
      completed: !!profile?.bio,
    },
    {
      id: "socials",
      label: "Add contact/socials",
      hint: "Phone or LinkedIn link",
      completed: !!(profile?.linkedin_url || profile?.phone_number),
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const isFullyCompleted = completedCount === steps.length;
  const showBanner = !dismissed && !isProfileLoading && !isFullyCompleted;

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

  const { data: savedEvents = [] } = useQuery({
    queryKey: ["savedEvents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_events")
        .select(
          `
          id,
          events (
            id,
            title,
            event_date,
            clubs (
              name
            )
          )
        `,
        )
        .eq("user_id", user?.id)
        .order("saved_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const colors = ["bg-lime", "bg-sky", "bg-peach"];

  if (!user) return null;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
      {showBanner && (
        <div
          className={`transition-all duration-700 ease-out transform ${
            animateIn ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-4 scale-95"
          } lg:col-span-3 neu-border bg-lavender p-6 md:p-8 relative neu-shadow mb-2 overflow-hidden`}
        >
          {/* Absolute decorative pattern or circles in background */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-peach rounded-full border-4 border-black opacity-30 pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-lime rounded-full border-4 border-black opacity-30 pointer-events-none" />

          <button
            onClick={() => {
              setAnimateIn(false);
              setTimeout(() => {
                setDismissed(true);
                localStorage.setItem("cc_welcome_dismissed", "true");
              }, 500); // Wait for transition out
            }}
            className="absolute top-4 right-4 neu-border bg-white hover:bg-peach p-2 transition-colors cursor-pointer group"
            aria-label="Dismiss banner"
          >
            <X className="h-5 w-5 group-hover:rotate-90 transition-transform duration-200" />
          </button>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-lime neu-border px-3 py-1 font-mono text-xs font-bold uppercase mb-4 animate-bounce">
                <Sparkles className="h-4 w-4 fill-black" />
                New Account Checklist
              </div>
              <h2 className="text-3xl font-display font-black text-black tracking-tight md:text-4xl mb-2">
                Welcome to CampusConnect, {profile?.first_name || "Student"}!
              </h2>
              <p className="text-sm font-mono text-gray-800 leading-relaxed max-w-xl">
                Complete your profile details below to connect with peer groups, customize your
                theme, and unlock all campus features.
              </p>
            </div>

            {/* Progress Gauge */}
            <div className="shrink-0 flex flex-col items-center justify-center bg-white neu-border neu-shadow-sm p-4 w-full md:w-48 text-center">
              <span className="font-mono text-xs uppercase font-bold text-gray-600">
                Setup Progress
              </span>
              <span className="font-display text-4xl font-black text-black my-1">
                {Math.round((completedCount / steps.length) * 100)}%
              </span>
              <span className="font-mono text-sm text-gray-500 dark:text-gray-300">
                {completedCount} of {steps.length} completed
              </span>
              {/* Small progress bar */}
              <div className="w-full bg-cream border-2 border-black h-3 mt-3 overflow-hidden rounded-none relative">
                <div
                  className="bg-lime h-full border-r-2 border-black transition-all duration-500 ease-out"
                  style={{ width: `${(completedCount / steps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Checklist steps */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 relative z-10">
            {steps.map((step) => {
              const Icon =
                {
                  handle: UserIcon,
                  college: GraduationCap,
                  bio: FileText,
                  socials: Link2,
                }[step.id as "handle" | "college" | "bio" | "socials"] || UserIcon;

              return (
                <Link
                  key={step.id}
                  to="/settings"
                  className={`neu-border p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer text-left relative ${
                    step.completed
                      ? "bg-cream/80 border-dashed border-gray-400 opacity-85 hover:opacity-100"
                      : "bg-white hover:bg-lime/10 neu-press"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div
                        className={`p-2 border-2 border-black ${step.completed ? "bg-lime" : "bg-sky"}`}
                      >
                        <Icon className="h-5 w-5 text-black" />
                      </div>
                      <div>
                        {step.completed ? (
                          <span className="bg-black text-lime neu-border text-[9px] font-bold px-2 py-0.5 uppercase font-mono tracking-wider flex items-center gap-1">
                            <Check className="h-2.5 w-2.5 stroke-[4]" /> Done
                          </span>
                        ) : (
                          <span className="bg-white text-black neu-border text-[9px] font-bold px-2 py-0.5 uppercase font-mono tracking-wider">
                            To-do
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="font-display font-bold text-base text-black mb-1">
                      {step.label}
                    </h3>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-300">
                      {step.hint}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-end font-mono text-[10px] font-bold uppercase group">
                    <span className="underline group-hover:no-underline transition-all">
                      {step.completed ? "Update Info" : "Set Up"}
                    </span>
                    <ArrowRight className="ml-1 h-3 w-3 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="lg:col-span-3">
        <TrendingCarousel clubs={trendingClubs} />
      </div>

      <Widget title="Upcoming events" cta={{ label: "All events", to: "/events" }}>
        {upcomingEvents.length === 0 ? (
          <p className="py-4 font-mono text-sm text-gray-500 dark:text-gray-300">
            No upcoming events yet.
          </p>
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

      <Widget title="Saved events" cta={{ label: "Explore", to: "/events" }}>
        {savedEvents.length === 0 ? (
          <p className="py-4 font-mono text-sm text-gray-500 dark:text-gray-300">
            No saved events yet.
          </p>
        ) : (
          <ul className="divide-y-2 divide-black">
            {savedEvents.map((item: DashboardSavedEvent, i) => {
              const rawEvent = item.events;
              if (!rawEvent) return null;
              const e = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
              if (!e) return null;
              const c = Array.isArray(e.clubs) ? e.clubs[0] : e.clubs;
              return (
                <li key={item.id} className="flex items-center gap-4 py-4">
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
                </li>
              );
            })}
          </ul>
        )}
      </Widget>

      <Widget title="Your clubs" cta={{ label: "Directory", to: "/clubs" }}>
        {userClubs.length === 0 ? (
          <p className="font-mono text-sm text-gray-500 dark:text-gray-300">
            You haven't joined any clubs yet.
          </p>
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
