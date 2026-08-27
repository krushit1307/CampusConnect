// src/hooks/useCrewSchedule.ts
// -----------------------------------------------------------------------------
// Issue #3752 — Interactive Event Setup/Teardown Critical Path Scheduler
//
// Loads a phase's run sheet and runs the CPM pass over it.
//
// The scheduling maths stays client-side on purpose: the Gantt view re-runs it
// on every duration tweak and every task tick, and a server round trip per
// interaction would make the board unusable on a phone in a loading bay. The
// server's job is to hand over a consistent graph and to refuse edges that
// would make it unschedulable.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  scheduleCrewTasks,
  type CrewPhase,
  type CrewTask,
  type CrewTaskStatus,
  type ScheduleResult,
  type ScheduleWindow,
} from "@/lib/crewCriticalPath";

interface PhaseRow {
  id: string;
  event_id: string;
  phase: CrewPhase;
  crew_call_at: string;
  deadline_at: string;
  crew_available: number;
  near_critical_threshold_minutes: number;
}

interface RunSheetRow {
  task_id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  crew_size: number;
  status: CrewTaskStatus;
  assigned_crew: string | null;
  depends_on: string[] | null;
  actual_start_minutes: number | string | null;
  actual_finish_minutes: number | string | null;
}

export interface UseCrewScheduleResult {
  phase: PhaseRow | null;
  window: ScheduleWindow | null;
  schedule: ScheduleResult | null;
  /** Minutes elapsed since crew call, recomputed on a one-minute tick. */
  nowMinutes: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reportProgress: (taskId: string, status: CrewTaskStatus) => Promise<void>;
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function minutesBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return 0;
  return (to.getTime() - from) / 60_000;
}

export function useCrewSchedule(
  eventId: string | null | undefined,
  phaseName: CrewPhase = "setup",
): UseCrewScheduleResult {
  const [phase, setPhase] = useState<PhaseRow | null>(null);
  const [tasks, setTasks] = useState<CrewTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(() => Date.now());

  const fetchSchedule = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: phaseData, error: phaseError } = await supabase
        .from("crew_phases")
        .select(
          "id, event_id, phase, crew_call_at, deadline_at, crew_available, near_critical_threshold_minutes",
        )
        .eq("event_id", eventId)
        .eq("phase", phaseName)
        .maybeSingle();

      if (phaseError) throw phaseError;

      if (!phaseData) {
        // No phase configured yet is a normal state, not an error — the UI
        // prompts the organiser to set a crew call time and deadline.
        setPhase(null);
        setTasks([]);
        return;
      }

      const phaseRow = phaseData as PhaseRow;
      setPhase(phaseRow);

      const { data: sheetData, error: sheetError } = await supabase.rpc("get_crew_run_sheet", {
        p_phase_id: phaseRow.id,
      });
      if (sheetError) throw sheetError;

      const rows = (sheetData ?? []) as RunSheetRow[];
      setTasks(
        rows.map((row) => ({
          id: row.task_id,
          title: row.title,
          phase: phaseRow.phase,
          durationMinutes: row.duration_minutes,
          crewSize: row.crew_size,
          status: row.status,
          dependsOn: row.depends_on ?? [],
          assignedCrew: row.assigned_crew,
          actualStartMinutes: toNullableNumber(row.actual_start_minutes),
          actualFinishMinutes: toNullableNumber(row.actual_finish_minutes),
        })),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load the crew run sheet";
      setError(message);
      setPhase(null);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, phaseName]);

  useEffect(() => {
    void fetchSchedule();
  }, [fetchSchedule]);

  // A one-minute tick keeps the "start within 12 minutes" countdowns honest
  // without re-fetching anything.
  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const window = useMemo<ScheduleWindow | null>(() => {
    if (!phase) return null;
    return {
      windowMinutes: minutesBetween(phase.crew_call_at, new Date(phase.deadline_at)),
      crewAvailable: phase.crew_available,
      nearCriticalThresholdMinutes: phase.near_critical_threshold_minutes,
    };
  }, [phase]);

  const schedule = useMemo<ScheduleResult | null>(() => {
    if (!window) return null;
    return scheduleCrewTasks(tasks, window);
  }, [tasks, window]);

  const nowMinutes = useMemo(() => {
    if (!phase) return 0;
    return minutesBetween(phase.crew_call_at, new Date(tick));
  }, [phase, tick]);

  const reportProgress = useCallback(
    async (taskId: string, status: CrewTaskStatus) => {
      const supabase = createClient();

      // Optimistic update — a crew lead tapping "done" in a loading bay should
      // not wait on the network to see the projection move.
      setTasks((previous) =>
        previous.map((task) => (task.id === taskId ? { ...task, status } : task)),
      );

      const { error: rpcError } = await supabase.rpc("report_crew_task_progress", {
        p_task_id: taskId,
        p_status: status,
      });

      if (rpcError) {
        // Re-fetch rather than trying to invert the optimistic edit — the
        // server is the authority on actual start/finish timestamps.
        setError(rpcError.message);
        await fetchSchedule();
        return;
      }

      // Pull the server-stamped actuals back so the projection uses real
      // timestamps rather than the optimistic status alone.
      await fetchSchedule();
    },
    [fetchSchedule],
  );

  return {
    phase,
    window,
    schedule,
    nowMinutes,
    isLoading,
    error,
    refresh: fetchSchedule,
    reportProgress,
  };
}
