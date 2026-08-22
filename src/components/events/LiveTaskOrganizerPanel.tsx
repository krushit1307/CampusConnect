// src/components/events/LiveTaskOrganizerPanel.tsx
// -----------------------------------------------------------------------------
// Issue: #3678 — Real-Time "Micro-Volunteering" Task Board
//
// The organizer-facing panel. Renders the "big red button" that
// pushes a micro-task to every checked-in attendee, plus the live
// roster of currently-open tasks and their volunteer counts.
// -----------------------------------------------------------------------------

import { useState } from "react";
import { toast } from "sonner";
import {
  Zap, Users, Coins, Clock,
  CheckCircle2, XCircle, Loader2, Radio,
} from "lucide-react";
import { useLiveTasks } from "@/hooks/useLiveTasks";
import {
  formatVolunteerNames, isTaskClaimable, slotsRemaining,
  urgencyLabel, buildCompletionToast,
  type LiveTask, type LiveTaskAssignment,
} from "@/lib/liveTasks";

export interface LiveTaskOrganizerPanelProps {
  eventId: string;
}

export function LiveTaskOrganizerPanel({ eventId }: LiveTaskOrganizerPanelProps) {
  const {
    tasks, assignmentsByTask, isLoading, error,
    isRealtimeConnected, createTask, completeTask, cancelTask,
  } = useLiveTasks(eventId);

  const [description, setDescription] = useState("");
  const [pointsReward, setPointsReward] = useState(50);
  const [maxVolunteers, setMaxVolunteers] = useState(3);
  const [expiresInMinutes, setExpiresInMinutes] = useState(10);
  const [isPushing, setIsPushing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const openTasks = tasks.filter((t) => t.status === "open");
  const closedTasks = tasks.filter((t) => t.status !== "open").slice(0, 5);

  const handlePush = async () => {
    if (!description.trim()) { toast.error("Description is required."); return; }
    if (pointsReward <= 0 || pointsReward > 1000) {
      toast.error("Points must be between 1 and 1000."); return;
    }
    if (maxVolunteers <= 0 || maxVolunteers > 100) {
      toast.error("Volunteer count must be between 1 and 100."); return;
    }
    setIsPushing(true);
    try {
      await createTask({
        description: description.trim(),
        points_reward: pointsReward,
        max_volunteers: maxVolunteers,
        expires_in_minutes: expiresInMinutes,
      });
      toast.success(
        `🚨 Task pushed! Up to ${maxVolunteers} attendees will see it instantly.`,
      );
      setDescription("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to push task";
      toast.error(msg);
    } finally {
      setIsPushing(false);
    }
  };

  const handleComplete = async (task: LiveTask) => {
    setCompletingId(task.id);
    try {
      const result = await completeTask(task.id);
      const assignments = assignmentsByTask[task.id] ?? [];
      const msg = buildCompletionToast(result, assignments);
      if (result.ok) toast.success(msg);
      else toast.error(result.reason ?? "Could not complete task.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete task";
      toast.error(msg);
    } finally {
      setCompletingId(null);
    }
  };

  const handleCancel = async (task: LiveTask) => {
    try {
      const result = await cancelTask(task.id);
      if (result.ok) toast.info("Task cancelled. No points were disbursed.");
      else toast.error(result.reason ?? "Could not cancel task.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel task";
      toast.error(msg);
    }
  };

  return (
    <div className="neu-border bg-white p-6 space-y-6" data-testid="live-task-organizer-panel">
      <div className="flex items-center justify-between border-b-4 border-black pb-4">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-red-600" />
          <div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight">
              Live Task Board
            </h2>
            <p className="font-mono text-xs text-gray-500">
              Push micro-tasks to attendees in real time
            </p>
          </div>
        </div>
        <RealtimeBadge isConnected={isRealtimeConnected} />
      </div>

      {error && (
        <div className="border-2 border-red-400 bg-red-50 p-3 font-mono text-sm text-red-800"
             data-testid="live-task-organizer-error">
          {error}
        </div>
      )}

      {/* ── Big red button form ─────────────────────────────────── */}
      <div className="neu-border bg-red-50 p-4 space-y-3 border-red-400">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-red-600" />
          <h3 className="font-display text-lg font-bold uppercase text-red-900">
            ⚡ Need help right now?
          </h3>
        </div>

        <div>
          <label htmlFor="task-description"
                 className="font-mono text-xs font-bold uppercase text-gray-700">
            Description
          </label>
          <input
            id="task-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Carry 50 boxes of pizza from the lobby to the 4th floor"
            maxLength={280}
            data-testid="task-description-input"
            className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="mt-1 text-right font-mono text-[10px] text-gray-500">
            {description.length}/280
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <NumberField id="task-points" label="Points" icon={<Coins className="h-4 w-4" />}
            value={pointsReward} onChange={setPointsReward} min={1} max={1000}
            data-testid="task-points-input" />
          <NumberField id="task-volunteers" label="Volunteers" icon={<Users className="h-4 w-4" />}
            value={maxVolunteers} onChange={setMaxVolunteers} min={1} max={100}
            data-testid="task-volunteers-input" />
          <NumberField id="task-expires" label="Expires (min)" icon={<Clock className="h-4 w-4" />}
            value={expiresInMinutes} onChange={setExpiresInMinutes} min={1} max={60}
            data-testid="task-expires-input" />
        </div>

        <button type="button" onClick={handlePush} disabled={isPushing}
          data-testid="push-task-btn"
          className="flex w-full items-center justify-center gap-2 border-4 border-black bg-red-500 px-4 py-4 font-display text-xl font-black uppercase text-white shadow-[6px_6px_0_0_#000] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] disabled:cursor-not-allowed disabled:opacity-50">
          {isPushing ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Pushing…</>
          ) : (
            <><Zap className="h-5 w-5" /> 🚨 Push to attendees</>
          )}
        </button>
      </div>

      {/* ── Open tasks ────────────────────────────────────────── */}
      <div>
        <h3 className="font-display text-lg font-bold uppercase text-gray-900 mb-3">
          Open tasks ({openTasks.length})
        </h3>
        {isLoading && tasks.length === 0 ? (
          <div className="flex items-center gap-2 font-mono text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : openTasks.length === 0 ? (
          <p className="font-mono text-sm text-gray-400" data-testid="no-open-tasks">
            No open tasks. Push one above ↑
          </p>
        ) : (
          <ul className="space-y-3" data-testid="open-tasks-list">
            {openTasks.map((task) => (
              <OpenTaskRow
                key={task.id}
                task={task}
                assignments={assignmentsByTask[task.id] ?? []}
                onComplete={() => handleComplete(task)}
                onCancel={() => handleCancel(task)}
                isCompleting={completingId === task.id}
              />
            ))}
          </ul>
        )}
      </div>

      {closedTasks.length > 0 && (
        <div>
          <h3 className="font-display text-sm font-bold uppercase text-gray-500 mb-2">
            Recently closed
          </h3>
          <ul className="space-y-1">
            {closedTasks.map((task) => (
              <li key={task.id}
                  className="flex items-center justify-between font-mono text-xs text-gray-500">
                <span className="truncate">{task.description}</span>
                <span className="ml-2 flex-shrink-0">
                  {task.status === "completed" ? "✅" : "❌"} ·{" "}
                  {(assignmentsByTask[task.id] ?? []).length}/{task.max_volunteers}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RealtimeBadge({ isConnected }: { isConnected: boolean }) {
  return (
    <span className={`flex items-center gap-1 border-2 border-black px-2 py-1 font-mono text-[10px] font-bold uppercase ${
      isConnected ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-600"}`}
      data-testid="realtime-badge">
      <Radio className={`h-3 w-3 ${isConnected ? "animate-pulse" : ""}`} />
      {isConnected ? "Live" : "Connecting…"}
    </span>
  );
}

function NumberField({
  id, label, icon, value, onChange, min, max, ...rest
}: {
  id: string; label: string; icon: React.ReactNode;
  value: number; onChange: (v: number) => void;
  min: number; max: number;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id}
             className="flex items-center gap-1 font-mono text-xs font-bold uppercase text-gray-700">
        {icon}{label}
      </label>
      <input
        {...rest} id={id} type="number" value={value} min={min} max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </div>
  );
}

function OpenTaskRow({
  task, assignments, onComplete, onCancel, isCompleting,
}: {
  task: LiveTask;
  assignments: LiveTaskAssignment[];
  onComplete: () => void;
  onCancel: () => void;
  isCompleting: boolean;
}) {
  const claimable = isTaskClaimable(task);
  const slots = slotsRemaining(task, assignments.length);
  const urgency = urgencyLabel(task);
  const toneClass =
    urgency.tone === "red" ? "text-red-600"
    : urgency.tone === "amber" ? "text-amber-600"
    : urgency.tone === "green" ? "text-green-600"
    : "text-gray-500";

  return (
    <li className="neu-border bg-white p-4 space-y-3" data-testid={`open-task-${task.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-gray-900 break-words">
            {task.description}
          </p>
          <p className="mt-1 font-mono text-xs text-gray-500">
            {task.points_reward} pts · {assignments.length}/{task.max_volunteers} volunteers ·{" "}
            <span className={toneClass}>{urgency.label}</span>
          </p>
        </div>
      </div>

      {assignments.length > 0 && (
        <p className="font-mono text-xs text-gray-700">
          <span className="font-bold">{formatVolunteerNames(assignments)}</span>{" "}
          {assignments.length === 1 ? "is" : "are"} on the way.
        </p>
      )}

      {slots === 0 && claimable && (
        <p className="font-mono text-xs text-amber-700" data-testid={`task-full-${task.id}`}>
          All slots filled — click "Mark Complete" to disburse points.
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onComplete}
          disabled={isCompleting || assignments.length === 0}
          data-testid={`complete-task-${task.id}`}
          className="flex items-center gap-1 border-2 border-black bg-green-400 px-3 py-1.5 font-mono text-xs font-bold uppercase hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50">
          {isCompleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Mark Complete
        </button>
        <button type="button" onClick={onCancel} disabled={isCompleting}
          data-testid={`cancel-task-${task.id}`}
          className="flex items-center gap-1 border-2 border-black bg-gray-100 px-3 py-1.5 font-mono text-xs font-bold uppercase hover:bg-gray-200 disabled:opacity-50">
          <XCircle className="h-3 w-3" />Cancel
        </button>
      </div>
    </li>
  );
}
