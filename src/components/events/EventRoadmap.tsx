import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Download,
  GripVertical,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  downloadRoadmapIcs,
  findScheduleConflict,
  formatSessionDay,
  formatSessionTime,
  getSessionDayKey,
  getTimelinePosition,
  getTimelineWindow,
  type EventSession,
} from "@/lib/eventRoadmap";

const TRACK_COLORS = [
  "bg-blue-100 border-blue-600 text-blue-950",
  "bg-lime-100 border-lime-600 text-lime-950",
  "bg-peach border-orange-600 text-orange-950",
  "bg-purple-100 border-purple-600 text-purple-950",
  "bg-cyan-100 border-cyan-600 text-cyan-950",
];

export function EventRoadmap({ eventId }: { eventId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [activeDay, setActiveDay] = useState("all");

  const { data: userData, isLoading: isUserLoading } = useQuery({
    queryKey: ["event-roadmap-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  });

  const { data: eventData } = useQuery({
    queryKey: ["event-roadmap-event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("title")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data as { title: string };
    },
    enabled: Boolean(eventId),
  });

  const {
    data: sessions = [],
    isLoading: isSessionsLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: ["event-roadmap-sessions", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_sessions" as never)
        .select("id, event_id, title, description, track, location, starts_at, ends_at")
        .eq("event_id", eventId)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EventSession[];
    },
    enabled: Boolean(eventId),
  });

  const { data: itineraryRows = [], isLoading: isItineraryLoading } = useQuery({
    queryKey: ["event-roadmap-itinerary", eventId, userData?.id],
    queryFn: async () => {
      if (!userData?.id) return [];
      const { data, error } = await supabase
        .from("event_itinerary_items" as never)
        .select("session_id")
        .eq("user_id", userData.id);
      if (error) throw error;
      return (data || []) as unknown as Array<{ session_id: string }>;
    },
    enabled: Boolean(userData?.id),
  });

  const selectedSessionIds = useMemo(
    () => new Set(itineraryRows.map((row) => row.session_id)),
    [itineraryRows],
  );
  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionIds.has(session.id)),
    [sessions, selectedSessionIds],
  );
  const dayKeys = useMemo(
    () => [...new Set(sessions.map(getSessionDayKey).filter((day) => day !== "unknown"))],
    [sessions],
  );
  const visibleSessions = useMemo(
    () =>
      activeDay === "all"
        ? sessions
        : sessions.filter((session) => getSessionDayKey(session) === activeDay),
    [activeDay, sessions],
  );
  const timelineWindow = useMemo(() => getTimelineWindow(visibleSessions), [visibleSessions]);
  const tracks = useMemo(
    () => [...new Set(visibleSessions.map((session) => session.track))],
    [visibleSessions],
  );
  const trackColors = useMemo(
    () => new Map(tracks.map((track, index) => [track, TRACK_COLORS[index % TRACK_COLORS.length]])),
    [tracks],
  );

  const itineraryMutation = useMutation({
    mutationFn: async ({ session, shouldAdd }: { session: EventSession; shouldAdd: boolean }) => {
      if (!userData?.id) throw new Error("Sign in to build a personal schedule.");
      if (shouldAdd) {
        const conflictMessage = findScheduleConflict(session, selectedSessions);
        if (conflictMessage) throw new Error(conflictMessage);
        const { error } = await supabase.from("event_itinerary_items" as never).insert({
          user_id: userData.id,
          session_id: session.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_itinerary_items" as never)
          .delete()
          .eq("user_id", userData.id)
          .eq("session_id", session.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["event-roadmap-itinerary", eventId, userData?.id],
      });
      toast.success(
        variables.shouldAdd ? "Added to your schedule." : "Removed from your schedule.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sessionId = event.dataTransfer.getData("text/plain");
    const session = sessions.find((item) => item.id === sessionId);
    if (session && !selectedSessionIds.has(session.id)) {
      itineraryMutation.mutate({ session, shouldAdd: true });
    }
  };

  const handleExport = () => {
    if (!eventData?.title || selectedSessions.length === 0) return;
    const didDownload = downloadRoadmapIcs(eventData.title, selectedSessions);
    if (didDownload) toast.success("Your personalized roadmap was exported as an .ics calendar.");
  };

  if (isSessionsLoading || isUserLoading || isItineraryLoading) {
    return (
      <section className="neu-border mt-8 bg-white p-6" aria-busy="true">
        <div className="flex items-center gap-2 font-mono text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the event roadmap...
        </div>
      </section>
    );
  }

  if (sessionsError) {
    return (
      <section className="neu-border mt-8 bg-amber-50 p-6" role="status">
        <p className="font-mono text-sm text-amber-900">
          The event roadmap is unavailable until its sessions can be loaded.
        </p>
      </section>
    );
  }

  return (
    <section className="neu-border mt-8 bg-white p-6" aria-labelledby="event-roadmap-title">
      <div className="flex flex-col gap-4 border-b-2 border-black pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-blue-800">
            <Sparkles className="h-4 w-4" /> Multi-track festival planner
          </p>
          <h2 id="event-roadmap-title" className="mt-1 font-display text-2xl font-black uppercase">
            Event roadmap
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-gray-600">
            Explore every session by day and track. Add sessions to your personal curriculum;
            overlapping sessions are blocked before they can be saved.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={selectedSessions.length === 0}
          className="neu-border neu-press flex items-center justify-center gap-2 bg-black px-4 py-2 font-mono text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Export my schedule (.ics)
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Festival days">
        <button
          type="button"
          role="tab"
          aria-selected={activeDay === "all"}
          onClick={() => setActiveDay("all")}
          className={`neu-border px-3 py-2 font-mono text-xs font-black uppercase ${activeDay === "all" ? "bg-blue-700 text-white" : "bg-white"}`}
        >
          All days
        </button>
        {dayKeys.map((day) => (
          <button
            type="button"
            role="tab"
            key={day}
            aria-selected={activeDay === day}
            onClick={() => setActiveDay(day)}
            className={`neu-border px-3 py-2 font-mono text-xs font-black uppercase ${activeDay === day ? "bg-blue-700 text-white" : "bg-white"}`}
          >
            {formatSessionDay(day)}
          </button>
        ))}
      </div>

      <div
        className="mt-4 border-2 border-black bg-slate-50 p-3"
        data-testid="my-schedule-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        aria-label="My saved schedule drop zone"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-lg font-black uppercase">
            <CalendarDays className="h-5 w-5" /> My schedule
          </h3>
          <span className="font-mono text-xs text-gray-600">
            {selectedSessions.length} session{selectedSessions.length === 1 ? "" : "s"} saved
          </span>
        </div>
        {selectedSessions.length === 0 ? (
          <p className="mt-2 font-mono text-xs text-gray-600">
            Drag a session here or use “Add to My Schedule” on a session block.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedSessions.map((session) => (
              <button
                type="button"
                key={session.id}
                onClick={() => itineraryMutation.mutate({ session, shouldAdd: false })}
                className="flex items-center gap-2 border-2 border-blue-800 bg-blue-100 px-2 py-1 text-left font-mono text-[11px] text-blue-950"
                aria-label={`Remove ${session.title} from my schedule`}
              >
                <Check className="h-3.5 w-3.5" /> {session.title} ·{" "}
                {formatSessionTime(session.starts_at)}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {visibleSessions.length === 0 || !timelineWindow ? (
        <div className="mt-4 border-2 border-dashed border-black p-8 text-center font-mono text-xs text-gray-600">
          No sessions have been added to this event roadmap yet.
        </div>
      ) : (
        <div
          className="mt-4 overflow-x-auto border-2 border-black bg-white"
          aria-label="Session timeline"
        >
          <div className="min-w-[920px] p-3">
            <div className="relative ml-36 h-8 border-b-2 border-black font-mono text-[10px] text-gray-600">
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                const timestamp = timelineWindow.start + timelineWindow.duration * fraction;
                return (
                  <span
                    key={fraction}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${fraction * 100}%` }}
                  >
                    {formatSessionTime(new Date(timestamp).toISOString())}
                  </span>
                );
              })}
            </div>
            <div className="divide-y-2 divide-black">
              {tracks.map((track) => (
                <div key={track} className="relative flex min-h-[96px]">
                  <div className="flex w-36 shrink-0 items-center gap-2 pr-3 font-mono text-xs font-black uppercase">
                    <GripVertical className="h-4 w-4 text-gray-500" /> {track}
                  </div>
                  <div className="relative flex-1">
                    {visibleSessions
                      .filter((session) => session.track === track)
                      .map((session) => {
                        const position = getTimelinePosition(session, timelineWindow);
                        const isSelected = selectedSessionIds.has(session.id);
                        const color = trackColors.get(track) || TRACK_COLORS[0];
                        return (
                          <button
                            type="button"
                            draggable
                            key={session.id}
                            onDragStart={(event) =>
                              event.dataTransfer.setData("text/plain", session.id)
                            }
                            onClick={() =>
                              itineraryMutation.mutate({ session, shouldAdd: !isSelected })
                            }
                            aria-pressed={isSelected}
                            aria-label={`${session.title}, ${formatSessionTime(session.starts_at)} to ${formatSessionTime(session.ends_at)}. ${isSelected ? "Remove from" : "Add to"} my schedule`}
                            className={`absolute top-3 min-h-[70px] overflow-hidden border-2 p-2 text-left shadow-[2px_2px_0_0_#000] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-700 ${color} ${isSelected ? "ring-4 ring-blue-700 ring-offset-1" : ""}`}
                            style={{ left: `${position.left}%`, width: `${position.width}%` }}
                          >
                            <span className="block truncate font-display text-sm font-black uppercase">
                              {session.title}
                            </span>
                            <span className="mt-1 block truncate font-mono text-[10px]">
                              {formatSessionTime(session.starts_at)}–
                              {formatSessionTime(session.ends_at)}
                            </span>
                            {session.location && (
                              <span className="mt-1 block truncate font-mono text-[10px]">
                                {session.location}
                              </span>
                            )}
                            <span className="mt-1 flex items-center gap-1 font-mono text-[9px] font-black uppercase">
                              {isSelected ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              {isSelected ? "Saved" : "Add to my schedule"}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
