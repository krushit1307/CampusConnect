import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { BookOpen, Clock3, MapPin, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import {
  formatMicroEventTimeRemaining,
  isValidMicroEventCapacity,
  isValidMicroEventCourseCode,
  isValidMicroEventLocation,
  normalizeCourseCode,
} from "@/lib/microEvents";

type StudySession = {
  id: string;
  user_id: string;
  course_code: string;
  location: string;
  max_capacity: number;
  created_at: string;
  expires_at: string;
  host_name: string;
  host_handle: string | null;
  participant_count: number;
  is_joined: boolean;
  is_host: boolean;
};

type SessionForm = {
  courseCode: string;
  location: string;
  maxCapacity: string;
};

const EMPTY_FORM: SessionForm = { courseCode: "", location: "", maxCapacity: "6" };

export function StudySessionMatchmaker() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState<SessionForm>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => setUser(currentUser));
  }, [supabase]);

  const { data: profile } = useQuery<{ course_codes: string[] | null }>({
    queryKey: ["study-session-profile", user?.id],
    queryFn: async () => {
      if (!user) return { course_codes: [] };
      const { data, error } = await supabase
        .from("profiles")
        .select("course_codes")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data ?? { course_codes: [] };
    },
    enabled: !!user?.id,
  });

  const {
    data: sessions = [],
    isLoading,
    refetch,
  } = useQuery<StudySession[]>({
    queryKey: ["matching-study-sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_matching_micro_events");
      if (error) throw error;
      return (data ?? []) as StudySession[];
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const courseCodes = (profile?.course_codes ?? []).filter(Boolean);

  const createSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const courseCode = normalizeCourseCode(form.courseCode);
    const location = form.location.trim();
    const maxCapacity = Number(form.maxCapacity);

    if (!isValidMicroEventCourseCode(courseCode)) {
      toast.error("Enter a valid course code.");
      return;
    }
    if (!isValidMicroEventLocation(location)) {
      toast.error("Add a location between 2 and 160 characters.");
      return;
    }
    if (!isValidMicroEventCapacity(maxCapacity)) {
      toast.error("Study sessions can have between 2 and 6 people.");
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase.rpc("create_micro_event", {
        p_course_code: courseCode,
        p_location: location,
        p_max_capacity: maxCapacity,
      });
      if (error) throw error;
      toast.success(`${courseCode} study session is live for four hours.`);
      setForm(EMPTY_FORM);
      setShowComposer(false);
      await refetch();
    } catch (error) {
      console.error("Failed to create study session", error);
      toast.error(error instanceof Error ? error.message : "Unable to create study session.");
    } finally {
      setIsCreating(false);
    }
  };

  const runSessionAction = async (session: StudySession, action: "join" | "leave" | "archive") => {
    setBusyId(session.id);
    try {
      const functionName =
        action === "join"
          ? "join_micro_event"
          : action === "leave"
            ? "leave_micro_event"
            : "archive_micro_event";
      const { error } = await supabase.rpc(functionName, { p_micro_event_id: session.id });
      if (error) throw error;
      toast.success(
        action === "join"
          ? `Joined ${session.course_code}.`
          : action === "leave"
            ? "You left the study session."
            : "Study session archived.",
      );
      await refetch();
    } catch (error) {
      console.error(`Failed to ${action} study session`, error);
      toast.error(error instanceof Error ? error.message : "That action could not be completed.");
    } finally {
      setBusyId(null);
    }
  };

  const visibleSessions = sessions.filter(
    (session) => new Date(session.expires_at).getTime() > now,
  );

  return (
    <section className="mb-8 border-2 border-black bg-[#fef08a] p-4 shadow-[6px_6px_0px_rgba(0,0,0,1)] md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-black/70">
            Micro-events
          </p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight text-black">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
            Find your study table.
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-black/75">
            Live sessions for courses in your profile. Each table stays small and automatically
            closes after four hours.
          </p>
          {courseCodes.length === 0 && (
            <p className="mt-3 font-mono text-xs font-bold text-black">
              Add course codes in Settings to unlock personalized matches.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowComposer((open) => !open)}
          className="neu-border neu-press inline-flex items-center justify-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream"
        >
          {showComposer ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showComposer ? "Close" : "Start a table"}
        </button>
      </div>

      {showComposer && (
        <form
          onSubmit={createSession}
          className="mt-5 grid gap-3 border-t-2 border-black pt-5 md:grid-cols-[1fr_1.4fr_0.8fr_auto] md:items-end"
        >
          <label className="font-mono text-xs font-bold uppercase text-black">
            Course code
            <input
              value={form.courseCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, courseCode: event.target.value }))
              }
              placeholder="CALC 101"
              maxLength={32}
              className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm uppercase outline-none focus:bg-[#bae6fd]"
              required
            />
          </label>
          <label className="font-mono text-xs font-bold uppercase text-black">
            Location
            <input
              value={form.location}
              onChange={(event) =>
                setForm((current) => ({ ...current, location: event.target.value }))
              }
              placeholder="Library, Room 4"
              maxLength={160}
              className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-[#bae6fd]"
              required
            />
          </label>
          <label className="font-mono text-xs font-bold uppercase text-black">
            Seats
            <select
              value={form.maxCapacity}
              onChange={(event) =>
                setForm((current) => ({ ...current, maxCapacity: event.target.value }))
              }
              className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-[#bae6fd]"
            >
              {[2, 3, 4, 5, 6].map((capacity) => (
                <option key={capacity} value={capacity}>
                  {capacity} people
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={isCreating}
            className="neu-border neu-press bg-[#a3e635] px-4 py-2 font-mono text-xs font-bold uppercase text-black disabled:opacity-50"
          >
            {isCreating ? "Posting…" : "Post table"}
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="mt-5 border-t-2 border-black pt-5 font-mono text-sm text-black/70">
          Looking for your courses…
        </p>
      ) : visibleSessions.length === 0 ? (
        <div className="mt-5 border-t-2 border-black pt-5">
          <p className="font-mono text-sm font-bold text-black">No active matches yet.</p>
          <p className="mt-1 font-mono text-xs text-black/70">
            Start a table or add more course codes in Settings so classmates can find you.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 border-t-2 border-black pt-5 md:grid-cols-2">
          {visibleSessions.map((session) => {
            const isFull = session.participant_count >= session.max_capacity;
            const isBusy = busyId === session.id;
            return (
              <article key={session.id} className="border-2 border-black bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-extrabold tracking-tight text-black">
                      {session.course_code}
                    </p>
                    <p className="mt-1 flex items-center gap-1 font-mono text-xs text-black/75">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {session.location}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-[#bae6fd] px-2 py-1 font-mono text-[11px] font-bold text-black">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatMicroEventTimeRemaining(session.expires_at, now)}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/20 pt-3">
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-black/70">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {session.participant_count}/{session.max_capacity} seats ·{" "}
                    {session.is_host ? "You host" : `Hosted by ${session.host_name}`}
                  </span>
                  {session.is_host ? (
                    <button
                      type="button"
                      onClick={() => runSessionAction(session, "archive")}
                      disabled={isBusy}
                      className="font-mono text-xs font-bold uppercase text-black underline decoration-2 underline-offset-2 disabled:opacity-50"
                    >
                      Archive
                    </button>
                  ) : session.is_joined ? (
                    <button
                      type="button"
                      onClick={() => runSessionAction(session, "leave")}
                      disabled={isBusy}
                      className="border-2 border-black bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-black disabled:opacity-50"
                    >
                      {isBusy ? "Working…" : "Leave"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runSessionAction(session, "join")}
                      disabled={isBusy || isFull}
                      className="neu-border neu-press bg-black px-3 py-1.5 font-mono text-xs font-bold uppercase text-cream disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? "Joining…" : isFull ? "Full" : "Join table"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
