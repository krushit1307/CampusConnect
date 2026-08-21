import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { ScheduleTrack, ScheduleSession, ScheduleDay } from "@/types/schedule";

export function useEventSchedule(eventId: string, currentUserId?: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const tracksKey = ["schedule_tracks", eventId];
  const sessionsKey = ["schedule_sessions", eventId];
  const favoritesKey = ["session_favorites", eventId, currentUserId];

  const { data: tracks = [], isLoading: tracksLoading } = useQuery<ScheduleTrack[]>({
    queryKey: tracksKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_tracks")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return data as ScheduleTrack[];
    },
    enabled: !!eventId,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ScheduleSession[]>({
    queryKey: sessionsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_sessions")
        .select("*")
        .eq("event_id", eventId)
        .order("start_time", { ascending: true });
      if (error) throw new Error(error.message);
      return data as ScheduleSession[];
    },
    enabled: !!eventId,
  });

  const { data: favoriteIds = new Set<string>() } = useQuery<Set<string>>({
    queryKey: favoritesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_favorites")
        .select("session_id")
        .eq("user_id", currentUserId);
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((f: { session_id: string }) => f.session_id));
    },
    enabled: !!eventId && !!currentUserId,
  });

  const sessionsWithFavorites = useMemo(
    () => sessions.map((s) => ({ ...s, is_favorited: favoriteIds.has(s.id) })),
    [sessions, favoriteIds],
  );

  // Groups sessions chronologically by calendar day, for the mobile list view
  // and for the day tabs above the desktop grid.
  const days: ScheduleDay[] = useMemo(() => {
    const byDate = new Map<string, ScheduleSession[]>();
    for (const session of sessionsWithFavorites) {
      const date = session.start_time.slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(session);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, daySessions], i) => ({
        date,
        label: `Day ${i + 1} · ${new Date(date + "T00:00:00").toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}`,
        sessions: daySessions.sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }));
  }, [sessionsWithFavorites]);

  const createTrack = useMutation({
    mutationFn: async (input: { name: string; color?: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from("schedule_tracks")
        .insert({ event_id: eventId, ...input })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as ScheduleTrack;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tracksKey }),
    onError: (err: Error) => toast.error(`Failed to add track: ${err.message}`),
  });

  const deleteTrack = useMutation({
    mutationFn: async (trackId: string) => {
      const { error } = await supabase.from("schedule_tracks").delete().eq("id", trackId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tracksKey });
      queryClient.invalidateQueries({ queryKey: sessionsKey });
    },
    onError: (err: Error) => toast.error(`Failed to delete track: ${err.message}`),
  });

  const createSession = useMutation({
    mutationFn: async (
      input: Omit<ScheduleSession, "id" | "event_id" | "track_name" | "is_favorited">,
    ) => {
      const { data, error } = await supabase
        .from("schedule_sessions")
        .insert({ event_id: eventId, ...input })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as ScheduleSession;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
    onError: (err: Error) =>
      toast.error(
        err.message.includes("overlaps")
          ? "That time slot overlaps another session on this track."
          : `Failed to create session: ${err.message}`,
      ),
  });

  // Used for both edits and drag/resize moves on the grid.
  const updateSession = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<ScheduleSession> & { id: string }) => {
      const { data, error } = await supabase
        .from("schedule_sessions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as ScheduleSession;
    },
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: sessionsKey });
      const previous = queryClient.getQueryData<ScheduleSession[]>(sessionsKey) ?? [];
      queryClient.setQueryData(
        sessionsKey,
        previous.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
      );
      return { previous };
    },
    onError: (err: Error, _updated, context) => {
      if (context?.previous) queryClient.setQueryData(sessionsKey, context.previous);
      toast.error(
        err.message.includes("overlaps")
          ? "That time slot overlaps another session on this track."
          : `Failed to update session: ${err.message}`,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from("schedule_sessions").delete().eq("id", sessionId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
    onError: (err: Error) => toast.error(`Failed to delete session: ${err.message}`),
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ sessionId, isFavorited }: { sessionId: string; isFavorited: boolean }) => {
      if (!currentUserId) throw new Error("You need to be signed in to favorite a session.");
      if (isFavorited) {
        const { error } = await supabase
          .from("session_favorites")
          .delete()
          .eq("session_id", sessionId)
          .eq("user_id", currentUserId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("session_favorites")
          .insert({ session_id: sessionId, user_id: currentUserId });
        if (error) throw new Error(error.message);
      }
    },
    onMutate: async ({ sessionId, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: favoritesKey });
      const previous = queryClient.getQueryData<Set<string>>(favoritesKey) ?? new Set<string>();
      const next = new Set(previous);
      if (isFavorited) next.delete(sessionId);
      else next.add(sessionId);
      queryClient.setQueryData(favoritesKey, next);
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(favoritesKey, context.previous);
      toast.error(err.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: favoritesKey }),
  });

  return {
    tracks,
    sessions: sessionsWithFavorites,
    days,
    isLoading: tracksLoading || sessionsLoading,
    createTrack: createTrack.mutate,
    deleteTrack: deleteTrack.mutate,
    createSession: createSession.mutate,
    updateSession: updateSession.mutate,
    deleteSession: deleteSession.mutate,
    toggleFavorite: (sessionId: string, isFavorited: boolean) =>
      toggleFavorite.mutate({ sessionId, isFavorited }),
  };
}
