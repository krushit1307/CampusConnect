// src/components/events/LiveTaskAttendeePopup.tsx
// -----------------------------------------------------------------------------
// Issue: #3678 — Real-Time "Micro-Volunteering" Task Board
//
// The attendee-facing modal. Renders a massive pop-up the instant an
// organizer pushes a task — "Micro-Task Available! First 3 to click
// get 50 points."
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Zap, X, Users, Coins, Clock,
  CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import { useLiveTasks } from "@/hooks/useLiveTasks";
import {
  isTaskClaimable, isUserAssigned, slotsRemaining, urgencyLabel,
  type LiveTask,
} from "@/lib/liveTasks";
import { toast } from "sonner";

export interface LiveTaskAttendeePopupProps {
  eventId: string;
  userId: string | null | undefined;
}

export function LiveTaskAttendeePopup({ eventId, userId }: LiveTaskAttendeePopupProps) {
  const { tasks, assignmentsByTask, acceptTask } = useLiveTasks(eventId);

  const [dismissedTaskIds, setDismissedTaskIds] = useState<Set<string>>(new Set());
  const [acceptingTaskId, setAcceptingTaskId] = useState<string | null>(null);

  const acceptedTaskIds = useMemo(() => {
    const ids = new Set<string>();
    if (!userId) return ids;
    for (const task of tasks) {
      const assignments = assignmentsByTask[task.id] ?? [];
      if (isUserAssigned(task, assignments, userId)) {
        ids.add(task.id);
      }
    }
    return ids;
  }, [tasks, assignmentsByTask, userId]);

  const activeTask = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status === "open");
    for (const task of openTasks) {
      if (dismissedTaskIds.has(task.id)) continue;
      if (acceptedTaskIds.has(task.id)) continue;
      return task;
    }
    return null;
  }, [tasks, dismissedTaskIds, acceptedTaskIds]);

  // Auto-dismiss when the active task becomes unclaimable or fills
  // without the user being in.
  useEffect(() => {
    if (!activeTask) return;
    const assignments = assignmentsByTask[activeTask.id] ?? [];
    const claimable = isTaskClaimable(activeTask);
    const slots = slotsRemaining(activeTask, assignments.length);
    const userIn = isUserAssigned(activeTask, assignments, userId);
    if (!claimable || (slots === 0 && !userIn)) {
      setDismissedTaskIds((prev) => {
        if (prev.has(activeTask.id)) return prev;
        const next = new Set(prev);
        next.add(activeTask.id);
        return next;
      });
    }
  }, [activeTask, assignmentsByTask, userId]);

  // Play a short beep when a new task pops up.
  const audioCtxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!activeTask) return;
    if (typeof AudioContext === "undefined") return;
    try {
      audioCtxRef.current ??= new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio is nice-to-have; never let it crash the popup.
    }
  }, [activeTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeTask) return null;

  const assignments = assignmentsByTask[activeTask.id] ?? [];
  const slots = slotsRemaining(activeTask, assignments.length);
  const urgency = urgencyLabel(activeTask);
  const userIn = isUserAssigned(activeTask, assignments, userId);

  const handleAccept = async () => {
    if (!userId) { toast.error("Sign in to accept tasks."); return; }
    setAcceptingTaskId(activeTask.id);
    try {
      const result = await acceptTask(activeTask.id);
      if (result.accepted) {
        toast.success(
          result.reason === "Already assigned"
            ? "You're already on this task! 🎉"
            : `You're in! +${activeTask.points_reward} points pending 🎉`,
        );
        setDismissedTaskIds((prev) => {
          const next = new Set(prev);
          next.add(activeTask.id);
          return next;
        });
      } else {
        const reason = result.reason ?? "Task is no longer available.";
        toast.error(reason);
        if (reason.includes("full") || reason.includes("closed") || reason.includes("expired")) {
          setDismissedTaskIds((prev) => {
            const next = new Set(prev);
            next.add(activeTask.id);
            return next;
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept task";
      toast.error(msg);
    } finally {
      setAcceptingTaskId(null);
    }
  };

  const handleDismiss = () => {
    setDismissedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(activeTask!.id);
      return next;
    });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Micro-task available"
      data-testid="live-task-attendee-popup"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg border-4 border-black bg-white shadow-[10px_10px_0_0_#000]"
           data-testid="popup-card">
        <div className="h-2 w-full animate-pulse bg-red-500" aria-hidden="true" />

        <button type="button" onClick={handleDismiss} aria-label="Dismiss"
          data-testid="popup-dismiss"
          className="absolute right-3 top-5 border-2 border-black bg-gray-100 p-1 hover:bg-gray-200">
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="border-2 border-black bg-red-500 p-3">
              <Zap className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-black uppercase tracking-tight text-red-700">
                Micro-Task Available!
              </h2>
              <p className="font-mono text-xs text-gray-600">
                First {activeTask.max_volunteers} to click get{" "}
                <strong>{activeTask.points_reward} points</strong>
              </p>
            </div>
          </div>

          <div className="border-2 border-black bg-yellow-50 p-4">
            <p className="font-display text-lg font-bold text-gray-900 break-words"
               data-testid="popup-description">
              {activeTask.description}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<Coins className="h-4 w-4" />} label="Reward"
              value={`${activeTask.points_reward} pts`} />
            <Stat icon={<Users className="h-4 w-4" />} label="Slots left"
              value={`${slots}/${activeTask.max_volunteers}`}
              tone={slots === 0 ? "red" : slots <= 1 ? "amber" : "green"} />
            <Stat icon={<Clock className="h-4 w-4" />} label="Expires"
              value={urgency.label} tone={urgency.tone} />
          </div>

          {userIn ? (
            <div className="flex items-center gap-2 border-2 border-green-500 bg-green-50 p-3"
                 data-testid="popup-accepted-state">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="font-mono text-sm font-bold text-green-800">
                You're in! Wait for the organizer to mark the task complete.
              </p>
            </div>
          ) : slots === 0 ? (
            <div className="flex items-center gap-2 border-2 border-amber-500 bg-amber-50 p-3"
                 data-testid="popup-full-state">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="font-mono text-sm font-bold text-amber-800">
                All {activeTask.max_volunteers} slots are filled. Better luck next time!
              </p>
            </div>
          ) : (
            <button type="button" onClick={handleAccept}
              disabled={acceptingTaskId === activeTask.id || !userId}
              data-testid="popup-accept-btn"
              className="flex w-full items-center justify-center gap-2 border-4 border-black bg-red-500 px-4 py-5 font-display text-2xl font-black uppercase text-white shadow-[6px_6px_0_0_#000] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] disabled:cursor-not-allowed disabled:opacity-50">
              {acceptingTaskId === activeTask.id ? (
                <><Loader2 className="h-6 w-6 animate-spin" /> Claiming…</>
              ) : (
                <><Zap className="h-6 w-6" /> I'm in! 🚀</>
              )}
            </button>
          )}

          {!userId && (
            <p className="text-center font-mono text-xs text-gray-500">
              Sign in to claim this task.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon, label, value, tone = "neutral",
}: {
  icon: React.ReactNode; label: string; value: string;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "red" ? "text-red-700 border-red-400 bg-red-50"
    : tone === "amber" ? "text-amber-700 border-amber-400 bg-amber-50"
    : tone === "green" ? "text-green-700 border-green-400 bg-green-50"
    : "text-gray-700 border-gray-300 bg-gray-50";
  return (
    <div className={`border-2 p-2 ${toneClass}`}>
      <div className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase opacity-70">
        {icon}{label}
      </div>
      <p className="mt-0.5 font-display text-sm font-black">{value}</p>
    </div>
  );
}
