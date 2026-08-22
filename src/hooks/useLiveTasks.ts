// src/hooks/useLiveTasks.ts
// -----------------------------------------------------------------------------
// Issue: #3678 — Real-Time "Micro-Volunteering" Task Board
//
// React hook that:
//   - Fetches the current open + recently-closed live tasks for an event.
//   - Fetches assignments (with user names joined).
//   - Subscribes to the `live_tasks_event_<eventId>` Supabase Realtime
//     channel so the UI re-renders the instant an organizer pushes a
//     new task or an attendee accepts one.
//   - Exposes `createTask`, `acceptTask`, `completeTask`, `cancelTask`.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  liveTasksChannelName,
  type LiveTask,
  type LiveTaskAssignment,
  type AcceptLiveTaskResult,
  type CompleteLiveTaskResult,
} from "@/lib/liveTasks";

export interface UseLiveTasksResult {
  tasks: LiveTask[];
  assignmentsByTask: Record<string, LiveTaskAssignment[]>;
  isLoading: boolean;
  error: string | null;
  isRealtimeConnected: boolean;
  createTask: (input: {
    description: string;
    points_reward: number;
    max_volunteers: number;
    expires_in_minutes?: number;
  }) => Promise<LiveTask | null>;
  acceptTask: (taskId: string) => Promise<AcceptLiveTaskResult>;
  completeTask: (taskId: string) => Promise<CompleteLiveTaskResult>;
  cancelTask: (taskId: string) => Promise<{ ok: boolean; reason?: string }>;
  refresh: () => Promise<void>;
}

const RECENT_TASK_LIMIT = 25;

export function useLiveTasks(
  eventId: string | null | undefined,
): UseLiveTasksResult {
  const supabaseRef = useRef(createClient());
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [assignmentsByTask, setAssignmentsByTask] = useState<
    Record<string, LiveTaskAssignment[]>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = supabaseRef.current;
      const { data: taskRows, error: tErr } = await supabase
        .from("live_tasks")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(RECENT_TASK_LIMIT);

      if (tErr) throw tErr;
      const taskList = (taskRows ?? []) as LiveTask[];
      setTasks(taskList);

      if (taskList.length === 0) {
        setAssignmentsByTask({});
        return;
      }

      const taskIds = taskList.map((t) => t.id);
      const { data: assignRows, error: aErr } = await supabase
        .from("live_task_assignments")
        .select(
          "id, task_id, user_id, accepted_at, points_awarded, profiles:user_id(first_name, last_name, avatar_url)",
        )
        .in("task_id", taskIds)
        .order("accepted_at", { ascending: true });

      if (aErr) throw aErr;

      const grouped: Record<string, LiveTaskAssignment[]> = {};
      for (const row of assignRows ?? []) {
        const a = row as LiveTaskAssignment & {
          profiles?: {
            first_name: string | null;
            last_name: string | null;
            avatar_url: string | null;
          };
        };
        const name = a.profiles
          ? [a.profiles.first_name, a.profiles.last_name]
              .filter(Boolean)
              .join(" ")
          : undefined;
        const assignment: LiveTaskAssignment = {
          id: a.id,
          task_id: a.task_id,
          user_id: a.user_id,
          accepted_at: a.accepted_at,
          points_awarded: a.points_awarded,
          user_name: name,
          user_avatar: a.profiles?.avatar_url ?? null,
        };
        if (!grouped[a.task_id]) grouped[a.task_id] = [];
        grouped[a.task_id].push(assignment);
      }
      setAssignmentsByTask(grouped);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load live tasks";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!eventId) return;
    const supabase = supabaseRef.current;
    const channelName = liveTasksChannelName(eventId);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_tasks", filter: `event_id=eq.${eventId}` },
        () => void fetchTasks(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_task_assignments" },
        () => void fetchTasks(),
      )
      .on("broadcast", { event: "task_created" }, () => void fetchTasks())
      .subscribe((status) => {
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchTasks]);

  const createTask = useCallback(
    async (input: {
      description: string;
      points_reward: number;
      max_volunteers: number;
      expires_in_minutes?: number;
    }): Promise<LiveTask | null> => {
      if (!eventId) throw new Error("Event ID is required");
      const supabase = supabaseRef.current;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const expiresAt = new Date(
        Date.now() + (input.expires_in_minutes ?? 10) * 60_000,
      ).toISOString();

      const { data, error: insertErr } = await supabase
        .from("live_tasks")
        .insert({
          event_id: eventId,
          created_by: user.id,
          description: input.description,
          points_reward: input.points_reward,
          max_volunteers: input.max_volunteers,
          expires_at: expiresAt,
          status: "open",
        })
        .select("*")
        .single();

      if (insertErr) throw insertErr;
      const created = data as LiveTask;

      // Broadcast immediately so attendees see the popup before the
      // postgres_changes event arrives. The DB row is the source of
      // truth; this broadcast is purely a latency optimisation.
      const channel = supabase.channel(liveTasksChannelName(eventId));
      await channel.send({
        type: "broadcast",
        event: "task_created",
        payload: { task_id: created.id },
      });
      supabase.removeChannel(channel);

      void fetchTasks();
      return created;
    },
    [eventId, fetchTasks],
  );

  const acceptTask = useCallback(
    async (taskId: string): Promise<AcceptLiveTaskResult> => {
      const supabase = supabaseRef.current;
      const { data, error: rpcErr } = await supabase.rpc("accept_live_task", {
        p_task_id: taskId,
      });
      if (rpcErr) throw rpcErr;
      const result = data as AcceptLiveTaskResult;
      void fetchTasks();
      return result;
    },
    [fetchTasks],
  );

  const completeTask = useCallback(
    async (taskId: string): Promise<CompleteLiveTaskResult> => {
      const supabase = supabaseRef.current;
      const { data, error: rpcErr } = await supabase.rpc("complete_live_task", {
        p_task_id: taskId,
      });
      if (rpcErr) throw rpcErr;
      const result = data as CompleteLiveTaskResult;
      void fetchTasks();
      return result;
    },
    [fetchTasks],
  );

  const cancelTask = useCallback(
    async (taskId: string): Promise<{ ok: boolean; reason?: string }> => {
      const supabase = supabaseRef.current;
      const { data, error: rpcErr } = await supabase.rpc("cancel_live_task", {
        p_task_id: taskId,
      });
      if (rpcErr) throw rpcErr;
      const result = data as { ok: boolean; reason?: string };
      void fetchTasks();
      return result;
    },
    [fetchTasks],
  );

  return {
    tasks,
    assignmentsByTask,
    isLoading,
    error,
    isRealtimeConnected,
    createTask,
    acceptTask,
    completeTask,
    cancelTask,
    refresh: fetchTasks,
  };
}
