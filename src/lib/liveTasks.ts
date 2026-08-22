// src/lib/liveTasks.ts
// -----------------------------------------------------------------------------
// Issue: #3678 — Real-Time "Micro-Volunteering" Task Board
//
// TypeScript types + pure helpers. Kept free of React and Supabase
// imports so it can be unit-tested in isolation.
// -----------------------------------------------------------------------------

export interface LiveTask {
  id: string;
  event_id: string;
  created_by: string;
  description: string;
  points_reward: number;
  max_volunteers: number;
  status: "open" | "completed" | "cancelled";
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface LiveTaskAssignment {
  id: string;
  task_id: string;
  user_id: string;
  accepted_at: string;
  points_awarded: boolean;
  user_name?: string;
  user_avatar?: string | null;
}

export interface AcceptLiveTaskResult {
  accepted: boolean;
  current_count: number;
  max_volunteers?: number;
  reason?: string;
}

export interface CompleteLiveTaskResult {
  ok: boolean;
  task_id?: string;
  points_reward?: number;
  awarded?: Array<{ user_id: string; name: string; amount: number }>;
  reason?: string;
}

export function isTaskClaimable(task: LiveTask, now: Date = new Date()): boolean {
  if (task.status !== "open") return false;
  return new Date(task.expires_at).getTime() > now.getTime();
}

export function slotsRemaining(task: LiveTask, assignmentCount: number): number {
  return Math.max(0, task.max_volunteers - assignmentCount);
}

export function isUserAssigned(
  task: LiveTask,
  assignments: LiveTaskAssignment[],
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return assignments.some((a) => a.user_id === userId && a.task_id === task.id);
}

export function formatVolunteerNames(
  assignments: LiveTaskAssignment[],
  maxNames: number = 3,
): string {
  if (assignments.length === 0) return "";
  const names = assignments.map((a) => a.user_name?.trim() || "Anonymous");
  if (names.length <= maxNames) {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }
  const shown = names.slice(0, maxNames);
  const more = names.length - maxNames;
  return `${shown.join(", ")}, and ${more} more`;
}

export function buildCompletionToast(
  result: CompleteLiveTaskResult,
  assignments: LiveTaskAssignment[],
): string {
  if (!result.ok || !result.awarded || result.awarded.length === 0) {
    return "No volunteers claimed this task.";
  }
  const points = result.points_reward ?? 0;
  const filtered = assignments.filter((a) =>
    result.awarded!.some((aw) => aw.user_id === a.user_id),
  );
  const formatted = formatVolunteerNames(filtered, 3);
  if (result.awarded.length === 0) return `Volunteers earned ${points} points each. 🎉`;
  if (result.awarded.length === 1) return `${formatted} earned ${points} points. 🎉`;
  return `${formatted} earned ${points} points each. 🎉`;
}

export function liveTasksChannelName(eventId: string): string {
  return `live_tasks_event_${eventId}`;
}

export function urgencyLabel(
  task: LiveTask,
  now: Date = new Date(),
): { label: string; tone: "green" | "amber" | "red" | "gray" } {
  const msLeft = new Date(task.expires_at).getTime() - now.getTime();
  if (task.status !== "open" || msLeft <= 0) {
    return { label: "Expired", tone: "gray" };
  }
  const minLeft = msLeft / 60_000;
  if (minLeft > 5) return { label: "Plenty of time", tone: "green" };
  if (minLeft > 2) return { label: "Hurry up", tone: "amber" };
  return { label: "Closing!", tone: "red" };
}
