// src/lib/crewCriticalPath.ts
// -----------------------------------------------------------------------------
// Issue #3752 — Interactive Event Setup/Teardown Critical Path Scheduler
//
// Critical Path Method (CPM) over a crew task DAG. Pure functions only — no
// React, no Supabase — so the scheduling maths can be unit-tested exhaustively
// and reused by the Gantt view, the mobile crew checklist, and any future
// "are we going to open on time?" notification job.
//
// The model
//   Tasks are nodes; dependencies are finish-to-start edges ("B cannot start
//   until A finishes"). Given a duration per task and a hard deadline (doors
//   open), CPM answers the only question that matters mid-setup: *which task,
//   if it slips by ten minutes, makes us open late?*
//
//   forward pass  → earliest start / earliest finish for every task
//   backward pass → latest start / latest finish, anchored to the deadline
//   slack         → latestStart − earliestStart
//   critical path → the chain of zero-slack tasks
//
// Everything is computed in minutes-from-crew-call rather than wall-clock
// timestamps. Timestamps are derived at the edges (see toWallClock) so the
// core maths never has to reason about time zones or DST.
// -----------------------------------------------------------------------------

export type CrewPhase = "setup" | "teardown";

export type CrewTaskStatus = "pending" | "in_progress" | "complete" | "blocked" | "skipped";

export interface CrewTask {
  id: string;
  title: string;
  phase: CrewPhase;
  /** Planned duration in minutes. Must be >= 0. */
  durationMinutes: number;
  /** How many crew members this task occupies while it runs. */
  crewSize: number;
  status: CrewTaskStatus;
  /** Task ids that must finish before this one can start. */
  dependsOn: string[];
  assignedCrew?: string | null;
  /** Set once the task actually finished, in minutes from crew call. */
  actualFinishMinutes?: number | null;
  actualStartMinutes?: number | null;
}

export interface ScheduleWindow {
  /** Minutes available between crew call time and the phase deadline. */
  windowMinutes: number;
  /** Total crew bodies available for the phase. */
  crewAvailable: number;
  /**
   * Slack (minutes) at or below which a task is "near critical" — one small
   * slip away from determining the open time.
   */
  nearCriticalThresholdMinutes: number;
}

export const DEFAULT_SCHEDULE_WINDOW: ScheduleWindow = {
  windowMinutes: 240,
  crewAvailable: 8,
  nearCriticalThresholdMinutes: 15,
};

export interface ScheduledTask extends CrewTask {
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  /** latestStart − earliestStart. Zero means critical. */
  slack: number;
  isCritical: boolean;
  isNearCritical: boolean;
  /** True when every dependency is complete, so crew can start now. */
  isReady: boolean;
  /** Dependencies that are not yet complete. */
  blockedBy: string[];
}

/** A dependency cycle, reported as the chain of task ids that closes it. */
export interface DependencyCycle {
  /** e.g. ["a", "b", "c", "a"] — the repeated id marks where it closes. */
  path: string[];
}

export interface ResourceConflict {
  /** Minutes-from-call at which the over-allocation begins. */
  startMinutes: number;
  endMinutes: number;
  /** Crew demanded by concurrently-scheduled tasks in this interval. */
  demanded: number;
  available: number;
  taskIds: string[];
}

export interface ScheduleResult {
  tasks: ScheduledTask[];
  /** Ordered chain of zero-slack tasks from first to last. */
  criticalPath: ScheduledTask[];
  /** Total minutes the critical path consumes. */
  criticalPathMinutes: number;
  /** Minutes the schedule overruns the available window. 0 when feasible. */
  overrunMinutes: number;
  isFeasible: boolean;
  /** Projected finish for the whole phase, in minutes from crew call. */
  projectedFinishMinutes: number;
  cycles: DependencyCycle[];
  resourceConflicts: ResourceConflict[];
  /** Ids referenced as dependencies that do not exist in the task list. */
  danglingDependencies: string[];
}

// -----------------------------------------------------------------------------
// Graph validation
// -----------------------------------------------------------------------------

/**
 * Finds dependency cycles via iterative DFS with a three-colour marking.
 *
 * A cycle makes the schedule unsolvable, and the organiser needs to be told
 * *which* tasks form it — "your graph has a cycle" is useless when there are
 * forty tasks. Returns every distinct cycle found, each as the path that
 * closes it.
 */
export function findDependencyCycles(tasks: CrewTask[]): DependencyCycle[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>(tasks.map((t) => [t.id, WHITE]));
  const cycles: DependencyCycle[] = [];
  const seenCycleKeys = new Set<string>();

  for (const root of tasks) {
    if (colour.get(root.id) !== WHITE) continue;

    // Explicit stack so a deep graph cannot blow the JS call stack.
    const stack: Array<{ id: string; depIndex: number }> = [{ id: root.id, depIndex: 0 }];
    const pathIds: string[] = [];
    colour.set(root.id, GREY);
    pathIds.push(root.id);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const task = byId.get(frame.id);
      const deps = task?.dependsOn ?? [];

      if (frame.depIndex >= deps.length) {
        colour.set(frame.id, BLACK);
        stack.pop();
        pathIds.pop();
        continue;
      }

      const depId = deps[frame.depIndex];
      frame.depIndex += 1;

      // Dangling dependency — reported separately, not a cycle.
      if (!byId.has(depId)) continue;

      const depColour = colour.get(depId);
      if (depColour === GREY) {
        // Found a back edge: the cycle is the suffix of the current path
        // starting at depId, closed by depId itself.
        const startIdx = pathIds.indexOf(depId);
        const cyclePath = [...pathIds.slice(startIdx), depId];
        const key = canonicalCycleKey(cyclePath);
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push({ path: cyclePath });
        }
        continue;
      }

      if (depColour === WHITE) {
        colour.set(depId, GREY);
        pathIds.push(depId);
        stack.push({ id: depId, depIndex: 0 });
      }
    }
  }

  return cycles;
}

/**
 * Rotation-independent key for a cycle, so a→b→c→a and b→c→a→b are recognised
 * as the same cycle and reported once.
 */
function canonicalCycleKey(path: string[]): string {
  const nodes = path.slice(0, -1); // drop the repeated closing id
  if (nodes.length === 0) return "";
  let minIdx = 0;
  for (let i = 1; i < nodes.length; i += 1) {
    if (nodes[i] < nodes[minIdx]) minIdx = i;
  }
  const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
  return rotated.join(">");
}

/** Dependency ids that reference a task not present in the list. */
export function findDanglingDependencies(tasks: CrewTask[]): string[] {
  const ids = new Set(tasks.map((t) => t.id));
  const dangling = new Set<string>();
  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (!ids.has(dep)) dangling.add(dep);
    }
  }
  return Array.from(dangling).sort();
}

/**
 * Kahn's algorithm. Returns tasks in dependency order, or null when the graph
 * cannot be ordered (i.e. it contains a cycle).
 */
export function topologicalOrder(tasks: CrewTask[]): CrewTask[] | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const indegree = new Map<string, number>(tasks.map((t) => [t.id, 0]));
  const dependents = new Map<string, string[]>(tasks.map((t) => [t.id, []]));

  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (!byId.has(dep)) continue; // dangling deps are ignored here
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
      dependents.get(dep)!.push(task.id);
    }
  }

  // Sort the initial frontier for deterministic output — two runs over the
  // same graph must produce the same schedule, or the UI jitters.
  const queue = tasks
    .filter((t) => (indegree.get(t.id) ?? 0) === 0)
    .map((t) => t.id)
    .sort();

  const ordered: CrewTask[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ordered.push(byId.get(id)!);
    for (const dependent of dependents.get(id) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        queue.push(dependent);
        queue.sort();
      }
    }
  }

  return ordered.length === tasks.length ? ordered : null;
}

// -----------------------------------------------------------------------------
// CPM scheduling
// -----------------------------------------------------------------------------

/**
 * Runs the full CPM pass over a task graph.
 *
 * When the graph contains a cycle the result carries the cycles and an empty
 * schedule rather than throwing — the caller is a UI that needs to *show* the
 * problem, not a process that should crash.
 */
export function scheduleCrewTasks(
  tasks: CrewTask[],
  window: ScheduleWindow = DEFAULT_SCHEDULE_WINDOW,
): ScheduleResult {
  const cycles = findDependencyCycles(tasks);
  const danglingDependencies = findDanglingDependencies(tasks);

  if (cycles.length > 0) {
    return {
      tasks: [],
      criticalPath: [],
      criticalPathMinutes: 0,
      overrunMinutes: 0,
      isFeasible: false,
      projectedFinishMinutes: 0,
      cycles,
      resourceConflicts: [],
      danglingDependencies,
    };
  }

  const ordered = topologicalOrder(tasks);
  if (ordered === null) {
    // Defensive: findDependencyCycles should already have caught this.
    return {
      tasks: [],
      criticalPath: [],
      criticalPathMinutes: 0,
      overrunMinutes: 0,
      isFeasible: false,
      projectedFinishMinutes: 0,
      cycles: [{ path: [] }],
      resourceConflicts: [],
      danglingDependencies,
    };
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();

  // ── Forward pass ──────────────────────────────────────────────────────
  // A task starts as soon as every predecessor has finished. Where a
  // predecessor reported an *actual* finish we use that instead of the plan,
  // which is what makes the projection update live during setup.
  for (const task of ordered) {
    let start = 0;
    for (const depId of task.dependsOn) {
      const dep = byId.get(depId);
      if (!dep) continue; // dangling
      const depFinish =
        dep.actualFinishMinutes != null
          ? dep.actualFinishMinutes
          : (earliestFinish.get(depId) ?? 0);
      start = Math.max(start, depFinish);
    }

    // A task already underway cannot start earlier than when it actually did.
    if (task.actualStartMinutes != null) {
      start = Math.max(start, task.actualStartMinutes);
    }

    const duration = Math.max(0, task.durationMinutes);
    const finish = task.actualFinishMinutes != null ? task.actualFinishMinutes : start + duration;

    earliestStart.set(task.id, start);
    earliestFinish.set(task.id, finish);
  }

  const projectedFinishMinutes = ordered.reduce(
    (max, t) => Math.max(max, earliestFinish.get(t.id) ?? 0),
    0,
  );

  // ── Backward pass ─────────────────────────────────────────────────────
  // Anchored to the phase deadline, not to the projected finish. Anchoring to
  // the projected finish would always produce a zero-slack path even when the
  // schedule comfortably fits, hiding the real margin from the organiser.
  const deadline = Math.max(window.windowMinutes, projectedFinishMinutes);
  const latestFinish = new Map<string, number>();
  const latestStart = new Map<string, number>();

  const dependents = new Map<string, string[]>(tasks.map((t) => [t.id, []]));
  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (dependents.has(dep)) dependents.get(dep)!.push(task.id);
    }
  }

  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const task = ordered[i];
    const successors = dependents.get(task.id) ?? [];
    let lf: number;
    if (successors.length === 0) {
      lf = deadline;
    } else {
      lf = Math.min(...successors.map((sid) => latestStart.get(sid) ?? deadline));
    }
    const duration = Math.max(0, task.durationMinutes);
    latestFinish.set(task.id, lf);
    latestStart.set(task.id, lf - duration);
  }

  // ── Assemble ──────────────────────────────────────────────────────────
  const completed = new Set(
    tasks.filter((t) => t.status === "complete" || t.status === "skipped").map((t) => t.id),
  );

  const scheduled: ScheduledTask[] = ordered.map((task) => {
    const es = earliestStart.get(task.id) ?? 0;
    const ls = latestStart.get(task.id) ?? 0;
    // Floating point never enters here (all inputs are integers in minutes),
    // but rounding keeps slack robust if a caller passes fractional durations.
    const slack = roundTo(ls - es, 4);
    const blockedBy = task.dependsOn.filter((d) => byId.has(d) && !completed.has(d));

    return {
      ...task,
      earliestStart: es,
      earliestFinish: earliestFinish.get(task.id) ?? 0,
      latestStart: ls,
      latestFinish: latestFinish.get(task.id) ?? 0,
      slack,
      isCritical: slack <= 0,
      isNearCritical: slack > 0 && slack <= window.nearCriticalThresholdMinutes,
      isReady: blockedBy.length === 0 && task.status !== "complete",
      blockedBy,
    };
  });

  const criticalPath = extractCriticalPath(scheduled);
  const criticalPathMinutes = criticalPath.reduce(
    (sum, t) => sum + Math.max(0, t.durationMinutes),
    0,
  );

  const overrunMinutes = Math.max(0, projectedFinishMinutes - window.windowMinutes);

  return {
    tasks: scheduled,
    criticalPath,
    criticalPathMinutes,
    overrunMinutes,
    isFeasible: overrunMinutes === 0,
    projectedFinishMinutes,
    cycles: [],
    resourceConflicts: findResourceConflicts(scheduled, window.crewAvailable),
    danglingDependencies,
  };
}

/**
 * Walks the zero-slack tasks into a single ordered chain.
 *
 * A graph can contain several zero-slack tasks that are not all on one chain
 * (parallel branches of equal length). We follow the chain that starts
 * earliest and, at each step, continues into the critical successor that
 * starts exactly when the current task finishes — that is the chain a crew
 * lead would actually read off the board.
 */
export function extractCriticalPath(tasks: ScheduledTask[]): ScheduledTask[] {
  const critical = tasks.filter((t) => t.isCritical);
  if (critical.length === 0) return [];

  const byId = new Map(critical.map((t) => [t.id, t]));
  const roots = critical
    .filter((t) => !t.dependsOn.some((d) => byId.has(d)))
    .sort((a, b) => a.earliestStart - b.earliestStart);

  if (roots.length === 0) return [];

  const chain: ScheduledTask[] = [];
  let current: ScheduledTask | undefined = roots[0];
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current);

    const successors = critical
      .filter(
        (t) => t.dependsOn.includes(current!.id) && t.earliestStart === current!.earliestFinish,
      )
      .sort((a, b) => b.durationMinutes - a.durationMinutes);

    current = successors[0];
  }

  return chain;
}

/**
 * Sweep-line over task intervals looking for moments where concurrently
 * scheduled tasks demand more crew than exists.
 *
 * A satisfied dependency graph still fails on the day if it assumes the same
 * six people are in two places at once, so this is checked independently of
 * ordering.
 */
export function findResourceConflicts(
  tasks: ScheduledTask[],
  crewAvailable: number,
): ResourceConflict[] {
  if (crewAvailable <= 0) return [];

  const live = tasks.filter(
    (t) =>
      t.status !== "complete" &&
      t.status !== "skipped" &&
      t.earliestFinish > t.earliestStart &&
      Math.max(0, t.crewSize) > 0,
  );
  if (live.length === 0) return [];

  // Every distinct start/finish is a point where demand can change. Between
  // two consecutive boundaries demand is constant, so it is enough to evaluate
  // each such slice once.
  const boundaries = Array.from(
    new Set(live.flatMap((t) => [t.earliestStart, t.earliestFinish])),
  ).sort((a, b) => a - b);

  interface Slice {
    start: number;
    end: number;
    demanded: number;
    taskIds: string[];
  }

  const slices: Slice[] = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    // Half-open [start, end): a task finishing exactly at `start` has already
    // released its crew, so it does not contend with one starting there.
    const overlapping = live.filter((t) => t.earliestStart <= start && t.earliestFinish > start);
    const demanded = overlapping.reduce((sum, t) => sum + Math.max(0, t.crewSize), 0);
    if (demanded > crewAvailable) {
      slices.push({
        start,
        end,
        demanded,
        taskIds: overlapping.map((t) => t.id).sort(),
      });
    }
  }

  // Merge adjacent over-capacity slices so the UI shows one conflict spanning
  // 30 minutes rather than six touching five-minute fragments.
  const conflicts: ResourceConflict[] = [];
  for (const slice of slices) {
    const previous = conflicts[conflicts.length - 1];
    if (previous && previous.endMinutes === slice.start) {
      previous.endMinutes = slice.end;
      previous.demanded = Math.max(previous.demanded, slice.demanded);
      previous.taskIds = Array.from(new Set([...previous.taskIds, ...slice.taskIds])).sort();
    } else {
      conflicts.push({
        startMinutes: slice.start,
        endMinutes: slice.end,
        demanded: slice.demanded,
        available: crewAvailable,
        taskIds: slice.taskIds,
      });
    }
  }

  return conflicts;
}

// -----------------------------------------------------------------------------
// Presentation helpers
// -----------------------------------------------------------------------------

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Converts minutes-from-call into a wall-clock Date. */
export function toWallClock(crewCallTime: string, minutes: number): Date {
  return new Date(new Date(crewCallTime).getTime() + minutes * 60_000);
}

export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${sign}${mins}m`;
  if (mins === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${mins}m`;
}

/**
 * Minutes remaining before a task must start to avoid delaying doors.
 * Negative means the task is already late.
 */
export function minutesUntilLatestStart(task: ScheduledTask, nowMinutes: number): number {
  return task.latestStart - nowMinutes;
}

export type TaskUrgency = "done" | "overdue" | "start_now" | "soon" | "later";

export function taskUrgency(task: ScheduledTask, nowMinutes: number): TaskUrgency {
  if (task.status === "complete" || task.status === "skipped") return "done";
  const remaining = minutesUntilLatestStart(task, nowMinutes);
  if (remaining < 0) return "overdue";
  if (remaining <= 5) return "start_now";
  if (remaining <= 30) return "soon";
  return "later";
}

/** Plain-language summary of a schedule, for the header of the Gantt view. */
export function summariseSchedule(
  result: ScheduleResult,
  window: ScheduleWindow = DEFAULT_SCHEDULE_WINDOW,
): string {
  if (result.cycles.length > 0) {
    const first = result.cycles[0];
    return `Schedule cannot be computed: tasks form a dependency loop (${first.path.join(" → ")}).`;
  }
  if (result.tasks.length === 0) {
    return "No crew tasks have been added for this phase yet.";
  }
  if (!result.isFeasible) {
    return `This plan needs ${formatMinutes(result.projectedFinishMinutes)} but only ${formatMinutes(window.windowMinutes)} is available — ${formatMinutes(result.overrunMinutes)} over.`;
  }
  const margin = window.windowMinutes - result.projectedFinishMinutes;
  return `Critical path is ${formatMinutes(result.criticalPathMinutes)} across ${result.criticalPath.length} task${result.criticalPath.length === 1 ? "" : "s"}, finishing with ${formatMinutes(margin)} to spare.`;
}
