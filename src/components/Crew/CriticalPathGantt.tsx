// src/components/Crew/CriticalPathGantt.tsx
// -----------------------------------------------------------------------------
// Issue #3752 — Interactive Event Setup/Teardown Critical Path Scheduler
//
// The run sheet as a Gantt timeline. Tasks are positioned by earliest start,
// the critical chain is highlighted, and slack trails each bar as a ghost so
// the difference between "we have room" and "this decides the open time" is
// visible at a glance rather than inferable from numbers.
// -----------------------------------------------------------------------------

import { useMemo } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCrewSchedule } from "@/hooks/useCrewSchedule";
import {
  formatMinutes,
  minutesUntilLatestStart,
  summariseSchedule,
  taskUrgency,
  toWallClock,
  type CrewPhase,
  type ScheduledTask,
  type TaskUrgency,
} from "@/lib/crewCriticalPath";

export interface CriticalPathGanttProps {
  eventId: string;
  phase?: CrewPhase;
}

const URGENCY_STYLES: Record<TaskUrgency, string> = {
  done: "text-emerald-400",
  overdue: "text-red-400",
  start_now: "text-orange-400",
  soon: "text-amber-400",
  later: "text-white/50",
};

function urgencyLabel(urgency: TaskUrgency, minutesLeft: number): string {
  switch (urgency) {
    case "done":
      return "Done";
    case "overdue":
      return `${formatMinutes(Math.abs(minutesLeft))} late`;
    case "start_now":
      return "Start now";
    case "soon":
      return `Start within ${formatMinutes(minutesLeft)}`;
    case "later":
      return `Latest start in ${formatMinutes(minutesLeft)}`;
  }
}

function TaskBar({
  task,
  totalMinutes,
  crewCallAt,
  nowMinutes,
  onStart,
  onComplete,
}: {
  task: ScheduledTask;
  totalMinutes: number;
  crewCallAt: string;
  nowMinutes: number;
  onStart: () => void;
  onComplete: () => void;
}) {
  const span = Math.max(totalMinutes, 1);
  const leftPct = (task.earliestStart / span) * 100;
  const widthPct = Math.max(((task.earliestFinish - task.earliestStart) / span) * 100, 0.5);
  // Slack trails the bar as a ghost — the visual room the task has.
  const slackPct = (Math.max(0, task.slack) / span) * 100;

  const minutesLeft = minutesUntilLatestStart(task, nowMinutes);
  const urgency = taskUrgency(task, nowMinutes);

  const barColour = task.isCritical
    ? "bg-red-500/80"
    : task.isNearCritical
      ? "bg-amber-500/80"
      : "bg-sky-500/70";

  const isDone = task.status === "complete" || task.status === "skipped";

  return (
    <li className="grid grid-cols-[minmax(0,14rem)_1fr] items-center gap-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {task.isCritical && (
            <AlertOctagon
              className="h-3.5 w-3.5 shrink-0 text-red-400"
              aria-label="On the critical path"
            />
          )}
          <p className={`truncate text-sm ${isDone ? "text-white/40 line-through" : "text-white"}`}>
            {task.title}
          </p>
        </div>
        <p className={`text-xs ${URGENCY_STYLES[urgency]}`}>
          {urgencyLabel(urgency, minutesLeft)}
          {task.blockedBy.length > 0 && !isDone && (
            <span className="text-white/40"> · blocked by {task.blockedBy.length}</span>
          )}
        </p>
      </div>

      <div className="relative h-7">
        <div
          className="absolute inset-y-1 rounded-md bg-white/5"
          style={{ left: `${leftPct}%`, width: `${widthPct + slackPct}%` }}
          aria-hidden="true"
        />
        <div
          className={`absolute inset-y-1 rounded-md ${barColour} ${isDone ? "opacity-40" : ""}`}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          title={`${task.title}: ${toWallClock(crewCallAt, task.earliestStart).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${toWallClock(crewCallAt, task.earliestFinish).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1">
          {!isDone && task.isReady && task.status === "pending" && (
            <button
              type="button"
              onClick={onStart}
              className="rounded border border-white/15 px-1.5 py-0.5 text-xs text-white/70 hover:bg-white/10"
            >
              <Play className="h-3 w-3" aria-label={`Start ${task.title}`} />
            </button>
          )}
          {!isDone && task.status === "in_progress" && (
            <button
              type="button"
              onClick={onComplete}
              className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-xs text-emerald-300 hover:bg-emerald-500/10"
            >
              <CheckCircle2 className="h-3 w-3" aria-label={`Complete ${task.title}`} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function CriticalPathGantt({ eventId, phase = "setup" }: CriticalPathGanttProps) {
  const {
    phase: phaseRow,
    window,
    schedule,
    nowMinutes,
    isLoading,
    error,
    refresh,
    reportProgress,
  } = useCrewSchedule(eventId, phase);

  const totalMinutes = useMemo(() => {
    if (!schedule || !window) return 1;
    return Math.max(window.windowMinutes, schedule.projectedFinishMinutes, 1);
  }, [schedule, window]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 p-10 text-sm text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Computing the critical path…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-red-300">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Could not load the run sheet
        </p>
        <p className="mt-1 text-sm text-white/60">{error}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  if (!phaseRow || !schedule || !window) {
    return (
      <div className="rounded-xl border border-white/10 p-10 text-center text-sm text-white/60">
        No {phase} schedule has been set up for this event yet. Add a crew call time and a deadline
        to start planning.
      </div>
    );
  }

  // A dependency loop makes the schedule unsolvable — show the loop itself
  // rather than a broken chart.
  if (schedule.cycles.length > 0) {
    return (
      <div className="rounded-xl border border-red-500/50 bg-red-500/5 p-6">
        <p className="flex items-center gap-2 font-medium text-red-300">
          <AlertOctagon className="h-4 w-4" aria-hidden="true" />
          This run sheet cannot be scheduled
        </p>
        <p className="mt-2 text-sm text-white/70">
          These tasks depend on each other in a loop, so none of them can ever start. Remove one of
          the dependencies to break it.
        </p>
        <ul className="mt-3 space-y-1">
          {schedule.cycles.map((cycle) => (
            <li
              key={cycle.path.join(">")}
              className="rounded bg-black/30 px-3 py-2 font-mono text-xs text-red-200"
            >
              {cycle.path.join(" → ")}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold capitalize text-white">
            <Clock className="h-5 w-5 text-sky-400" aria-hidden="true" />
            {phase} critical path
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/60">
            {summariseSchedule(schedule, window)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </header>

      {!schedule.isFeasible && (
        <div role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-red-300">
            <AlertOctagon className="h-4 w-4" aria-hidden="true" />
            This plan does not fit the window
          </p>
          <p className="mt-1 text-sm text-white/70">
            The work runs {formatMinutes(schedule.overrunMinutes)} past the deadline. Shorten a task
            on the critical path, run something in parallel, or move the crew call earlier.
          </p>
        </div>
      )}

      {schedule.resourceConflicts.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <Users className="h-4 w-4" aria-hidden="true" />
            Crew is double-booked
          </p>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {schedule.resourceConflicts.map((conflict) => (
              <li key={`${conflict.startMinutes}-${conflict.endMinutes}`}>
                {toWallClock(phaseRow.crew_call_at, conflict.startMinutes).toLocaleTimeString(
                  undefined,
                  {
                    hour: "numeric",
                    minute: "2-digit",
                  },
                )}
                {" – "}
                {toWallClock(phaseRow.crew_call_at, conflict.endMinutes).toLocaleTimeString(
                  undefined,
                  {
                    hour: "numeric",
                    minute: "2-digit",
                  },
                )}
                : {conflict.demanded} crew needed, {conflict.available} available.
              </li>
            ))}
          </ul>
        </div>
      )}

      {schedule.danglingDependencies.length > 0 && (
        <p className="text-xs text-amber-300/80">
          {schedule.danglingDependencies.length} dependency reference
          {schedule.danglingDependencies.length === 1 ? "" : "s"} point to tasks that no longer
          exist and were ignored.
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-red-500/80" /> critical path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-amber-500/80" /> near critical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-sky-500/70" /> has slack
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-white/10" /> slack
        </span>
      </div>

      {schedule.tasks.length === 0 ? (
        <p className="rounded-xl border border-white/10 p-8 text-center text-sm text-white/60">
          No crew tasks yet. Add the first one to start building the run sheet.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/10 p-3">
          {schedule.tasks.map((task) => (
            <TaskBar
              key={task.id}
              task={task}
              totalMinutes={totalMinutes}
              crewCallAt={phaseRow.crew_call_at}
              nowMinutes={nowMinutes}
              onStart={() => void reportProgress(task.id, "in_progress")}
              onComplete={() => void reportProgress(task.id, "complete")}
            />
          ))}
        </ul>
      )}

      {schedule.criticalPath.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-300">The chain that decides your open time</p>
          <p className="mt-1 text-sm text-white/70">
            {schedule.criticalPath.map((t) => t.title).join(" → ")}
          </p>
          <p className="mt-1 text-xs text-white/50">
            Any slip on these {schedule.criticalPath.length} tasks delays doors minute for minute.
            Everything else has room to absorb a delay.
          </p>
        </div>
      )}
    </section>
  );
}

export default CriticalPathGantt;
