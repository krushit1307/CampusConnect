import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCHEDULE_WINDOW,
  extractCriticalPath,
  findDanglingDependencies,
  findDependencyCycles,
  findResourceConflicts,
  formatMinutes,
  minutesUntilLatestStart,
  scheduleCrewTasks,
  summariseSchedule,
  taskUrgency,
  toWallClock,
  topologicalOrder,
  type CrewTask,
  type ScheduleWindow,
} from "./crewCriticalPath";

function task(
  id: string,
  durationMinutes: number,
  dependsOn: string[] = [],
  overrides: Partial<CrewTask> = {},
): CrewTask {
  return {
    id,
    title: `Task ${id}`,
    phase: "setup",
    durationMinutes,
    crewSize: 1,
    status: "pending",
    dependsOn,
    ...overrides,
  };
}

const WINDOW: ScheduleWindow = {
  windowMinutes: 240,
  crewAvailable: 100, // effectively unlimited unless a test says otherwise
  nearCriticalThresholdMinutes: 15,
};

describe("findDependencyCycles", () => {
  it("finds nothing in an acyclic graph", () => {
    const tasks = [task("a", 10), task("b", 10, ["a"]), task("c", 10, ["b"])];
    expect(findDependencyCycles(tasks)).toEqual([]);
  });

  it("detects a direct two-task loop and names both tasks", () => {
    const tasks = [task("a", 10, ["b"]), task("b", 10, ["a"])];
    const cycles = findDependencyCycles(tasks);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].path).toContain("a");
    expect(cycles[0].path).toContain("b");
    // The path closes on the id it started from.
    expect(cycles[0].path[0]).toBe(cycles[0].path[cycles[0].path.length - 1]);
  });

  it("detects a longer loop", () => {
    const tasks = [task("a", 10, ["c"]), task("b", 10, ["a"]), task("c", 10, ["b"])];
    const cycles = findDependencyCycles(tasks);
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0].path)).toEqual(new Set(["a", "b", "c"]));
  });

  it("detects a self-dependency", () => {
    const cycles = findDependencyCycles([task("a", 10, ["a"])]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].path).toEqual(["a", "a"]);
  });

  it("reports the same cycle once regardless of traversal entry point", () => {
    const tasks = [
      task("a", 10, ["c"]),
      task("b", 10, ["a"]),
      task("c", 10, ["b"]),
      task("d", 10, ["c"]), // extra entry point into the same loop
    ];
    expect(findDependencyCycles(tasks)).toHaveLength(1);
  });

  it("ignores dangling dependencies rather than calling them cycles", () => {
    const tasks = [task("a", 10, ["ghost"])];
    expect(findDependencyCycles(tasks)).toEqual([]);
  });

  it("handles a deep chain without recursing into a stack overflow", () => {
    const tasks: CrewTask[] = [];
    for (let i = 0; i < 5000; i += 1) {
      tasks.push(task(`t${i}`, 1, i === 0 ? [] : [`t${i - 1}`]));
    }
    expect(findDependencyCycles(tasks)).toEqual([]);
  });
});

describe("findDanglingDependencies", () => {
  it("lists dependency ids with no matching task", () => {
    const tasks = [task("a", 10, ["ghost", "b"]), task("b", 10)];
    expect(findDanglingDependencies(tasks)).toEqual(["ghost"]);
  });

  it("returns an empty list for a well-formed graph", () => {
    expect(findDanglingDependencies([task("a", 10), task("b", 10, ["a"])])).toEqual([]);
  });
});

describe("topologicalOrder", () => {
  it("orders dependencies before dependents", () => {
    const tasks = [task("c", 10, ["b"]), task("a", 10), task("b", 10, ["a"])];
    const ordered = topologicalOrder(tasks)!;
    const ids = ordered.map((t) => t.id);
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("c"));
  });

  it("returns null for a cyclic graph", () => {
    expect(topologicalOrder([task("a", 10, ["b"]), task("b", 10, ["a"])])).toBeNull();
  });

  it("is deterministic across runs on the same graph", () => {
    const tasks = [task("z", 5), task("y", 5), task("x", 5)];
    const first = topologicalOrder(tasks)!.map((t) => t.id);
    const second = topologicalOrder(tasks)!.map((t) => t.id);
    expect(first).toEqual(second);
  });
});

describe("scheduleCrewTasks — forward pass", () => {
  it("starts an unblocked task at zero", () => {
    const result = scheduleCrewTasks([task("a", 30)], WINDOW);
    const a = result.tasks.find((t) => t.id === "a")!;
    expect(a.earliestStart).toBe(0);
    expect(a.earliestFinish).toBe(30);
  });

  it("chains dependent tasks end to end", () => {
    const result = scheduleCrewTasks(
      [task("a", 30), task("b", 20, ["a"]), task("c", 10, ["b"])],
      WINDOW,
    );
    const byId = new Map(result.tasks.map((t) => [t.id, t]));
    expect(byId.get("b")!.earliestStart).toBe(30);
    expect(byId.get("c")!.earliestStart).toBe(50);
    expect(result.projectedFinishMinutes).toBe(60);
  });

  it("waits for the slowest predecessor when a task has several", () => {
    const result = scheduleCrewTasks(
      [task("fast", 10), task("slow", 45), task("join", 5, ["fast", "slow"])],
      WINDOW,
    );
    const join = result.tasks.find((t) => t.id === "join")!;
    expect(join.earliestStart).toBe(45);
  });

  it("runs independent branches in parallel rather than in sequence", () => {
    const result = scheduleCrewTasks([task("a", 30), task("b", 30), task("c", 30)], WINDOW);
    expect(result.projectedFinishMinutes).toBe(30);
  });
});

describe("scheduleCrewTasks — critical path", () => {
  it("identifies the longest chain through a graph with parallel branches", () => {
    // long branch: a(30) -> b(60) -> d(10)  = 100
    // short branch: a(30) -> c(10) -> d(10) = 50
    const tasks = [
      task("a", 30),
      task("b", 60, ["a"]),
      task("c", 10, ["a"]),
      task("d", 10, ["b", "c"]),
    ];
    const result = scheduleCrewTasks(tasks, WINDOW);
    const byId = new Map(result.tasks.map((t) => [t.id, t]));

    // The short branch has slack; the long one does not.
    expect(byId.get("c")!.slack).toBeGreaterThan(0);
    expect(byId.get("b")!.slack).toBeLessThan(byId.get("c")!.slack);
  });

  it("gives the whole chain zero slack when the deadline is exactly met", () => {
    const tight: ScheduleWindow = { ...WINDOW, windowMinutes: 60 };
    const result = scheduleCrewTasks([task("a", 30), task("b", 30, ["a"])], tight);
    for (const t of result.tasks) {
      expect(t.slack).toBe(0);
      expect(t.isCritical).toBe(true);
    }
    expect(result.criticalPath.map((t) => t.id)).toEqual(["a", "b"]);
    expect(result.criticalPathMinutes).toBe(60);
  });

  it("reports real margin instead of a fake critical path when there is slack", () => {
    // 60 minutes of work in a 240 minute window — nothing should be critical.
    const result = scheduleCrewTasks([task("a", 30), task("b", 30, ["a"])], WINDOW);
    expect(result.tasks.every((t) => t.slack > 0)).toBe(true);
    expect(result.criticalPath).toEqual([]);
    expect(result.isFeasible).toBe(true);
  });

  it("flags near-critical tasks that are one slip from mattering", () => {
    const window: ScheduleWindow = {
      ...WINDOW,
      windowMinutes: 70,
      nearCriticalThresholdMinutes: 15,
    };
    // a(30) -> b(30) = 60, in a 70 minute window: 10 minutes of slack.
    const result = scheduleCrewTasks([task("a", 30), task("b", 30, ["a"])], window);
    expect(result.tasks.every((t) => t.isNearCritical)).toBe(true);
    expect(result.tasks.every((t) => t.isCritical)).toBe(false);
  });
});

describe("scheduleCrewTasks — feasibility", () => {
  it("flags an overrun when the work exceeds the window", () => {
    const window: ScheduleWindow = { ...WINDOW, windowMinutes: 60 };
    const result = scheduleCrewTasks([task("a", 45), task("b", 45, ["a"])], window);
    expect(result.isFeasible).toBe(false);
    expect(result.projectedFinishMinutes).toBe(90);
    expect(result.overrunMinutes).toBe(30);
  });

  it("reports a feasible plan with zero overrun", () => {
    const result = scheduleCrewTasks([task("a", 45)], WINDOW);
    expect(result.isFeasible).toBe(true);
    expect(result.overrunMinutes).toBe(0);
  });
});

describe("scheduleCrewTasks — actuals", () => {
  it("shifts downstream starts when a task finishes late", () => {
    const planned = scheduleCrewTasks([task("a", 30), task("b", 20, ["a"])], WINDOW);
    expect(planned.projectedFinishMinutes).toBe(50);

    const slipped = scheduleCrewTasks(
      [
        task("a", 30, [], {
          status: "complete",
          actualStartMinutes: 0,
          actualFinishMinutes: 55, // ran 25 minutes over
        }),
        task("b", 20, ["a"]),
      ],
      WINDOW,
    );
    const b = slipped.tasks.find((t) => t.id === "b")!;
    expect(b.earliestStart).toBe(55);
    expect(slipped.projectedFinishMinutes).toBe(75);
  });

  it("pulls the projection in when a task finishes early", () => {
    const result = scheduleCrewTasks(
      [
        task("a", 30, [], {
          status: "complete",
          actualStartMinutes: 0,
          actualFinishMinutes: 12,
        }),
        task("b", 20, ["a"]),
      ],
      WINDOW,
    );
    expect(result.tasks.find((t) => t.id === "b")!.earliestStart).toBe(12);
    expect(result.projectedFinishMinutes).toBe(32);
  });

  it("does not let an in-progress task start before it actually did", () => {
    const result = scheduleCrewTasks(
      [task("a", 30, [], { status: "in_progress", actualStartMinutes: 40 })],
      WINDOW,
    );
    const a = result.tasks.find((t) => t.id === "a")!;
    expect(a.earliestStart).toBe(40);
    expect(a.earliestFinish).toBe(70);
  });
});

describe("scheduleCrewTasks — readiness", () => {
  it("marks a task ready once every dependency is complete", () => {
    const result = scheduleCrewTasks(
      [task("a", 30, [], { status: "complete", actualFinishMinutes: 30 }), task("b", 20, ["a"])],
      WINDOW,
    );
    const b = result.tasks.find((t) => t.id === "b")!;
    expect(b.isReady).toBe(true);
    expect(b.blockedBy).toEqual([]);
  });

  it("names the outstanding dependencies of a blocked task", () => {
    const result = scheduleCrewTasks(
      [task("a", 30), task("b", 30), task("c", 20, ["a", "b"])],
      WINDOW,
    );
    const c = result.tasks.find((t) => t.id === "c")!;
    expect(c.isReady).toBe(false);
    expect(c.blockedBy.sort()).toEqual(["a", "b"]);
  });

  it("treats a skipped dependency as satisfied", () => {
    const result = scheduleCrewTasks(
      [task("a", 30, [], { status: "skipped" }), task("b", 20, ["a"])],
      WINDOW,
    );
    expect(result.tasks.find((t) => t.id === "b")!.isReady).toBe(true);
  });
});

describe("scheduleCrewTasks — cycles", () => {
  it("returns the cycle and an empty schedule rather than throwing", () => {
    const result = scheduleCrewTasks([task("a", 10, ["b"]), task("b", 10, ["a"])], WINDOW);
    expect(result.cycles).toHaveLength(1);
    expect(result.tasks).toEqual([]);
    expect(result.isFeasible).toBe(false);
  });

  it("still reports dangling dependencies alongside a cycle", () => {
    const result = scheduleCrewTasks([task("a", 10, ["b", "ghost"]), task("b", 10, ["a"])], WINDOW);
    expect(result.danglingDependencies).toEqual(["ghost"]);
  });

  it("schedules around a dangling dependency instead of failing", () => {
    const result = scheduleCrewTasks([task("a", 30, ["ghost"])], WINDOW);
    expect(result.danglingDependencies).toEqual(["ghost"]);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].earliestStart).toBe(0);
  });
});

describe("findResourceConflicts", () => {
  function scheduled(
    tasks: CrewTask[],
    crewAvailable: number,
  ): ReturnType<typeof findResourceConflicts> {
    const result = scheduleCrewTasks(tasks, {
      ...WINDOW,
      crewAvailable,
    });
    return result.resourceConflicts;
  }

  it("finds no conflict when crew is sufficient", () => {
    const conflicts = scheduled(
      [task("a", 30, [], { crewSize: 3 }), task("b", 30, [], { crewSize: 3 })],
      8,
    );
    expect(conflicts).toEqual([]);
  });

  it("detects two concurrent tasks demanding more crew than exists", () => {
    const conflicts = scheduled(
      [task("a", 30, [], { crewSize: 5 }), task("b", 30, [], { crewSize: 5 })],
      8,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].demanded).toBe(10);
    expect(conflicts[0].available).toBe(8);
    expect(conflicts[0].taskIds.sort()).toEqual(["a", "b"]);
  });

  it("does not flag sequential tasks that never overlap", () => {
    const conflicts = scheduled(
      [task("a", 30, [], { crewSize: 8 }), task("b", 30, ["a"], { crewSize: 8 })],
      8,
    );
    expect(conflicts).toEqual([]);
  });

  it("treats a handover at the same instant as non-overlapping", () => {
    // a finishes at 30, b starts at 30 — the crew is free.
    const conflicts = scheduled(
      [task("a", 30, [], { crewSize: 6 }), task("b", 30, ["a"], { crewSize: 6 })],
      6,
    );
    expect(conflicts).toEqual([]);
  });

  it("reports the overlapping window, not the whole task duration", () => {
    // a: 0–60 (crew 5), b: 30–90 (crew 5), available 6 → conflict only 30–60.
    const conflicts = scheduled(
      [
        task("a", 60, [], { crewSize: 5 }),
        task("gate", 30, [], { crewSize: 0 }),
        task("b", 60, ["gate"], { crewSize: 5 }),
      ],
      6,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].startMinutes).toBe(30);
    expect(conflicts[0].endMinutes).toBe(60);
  });

  it("ignores completed tasks — their crew has already been released", () => {
    const conflicts = scheduled(
      [task("a", 30, [], { crewSize: 5, status: "complete" }), task("b", 30, [], { crewSize: 5 })],
      6,
    );
    expect(conflicts).toEqual([]);
  });

  it("returns nothing when the crew size is unknown", () => {
    expect(findResourceConflicts([], 0)).toEqual([]);
  });
});

describe("extractCriticalPath", () => {
  it("returns an empty chain when nothing is critical", () => {
    expect(extractCriticalPath([])).toEqual([]);
  });

  it("follows the chain through a diamond", () => {
    const window: ScheduleWindow = { ...WINDOW, windowMinutes: 100 };
    const result = scheduleCrewTasks(
      [task("a", 30), task("b", 60, ["a"]), task("c", 10, ["a"]), task("d", 10, ["b", "c"])],
      window,
    );
    expect(result.criticalPath.map((t) => t.id)).toEqual(["a", "b", "d"]);
  });
});

describe("urgency helpers", () => {
  const window: ScheduleWindow = { ...WINDOW, windowMinutes: 100 };
  const result = scheduleCrewTasks(
    [task("a", 30), task("b", 60, ["a"]), task("d", 10, ["b"])],
    window,
  );
  const a = result.tasks.find((t) => t.id === "a")!;

  it("reports the minutes left before a task must start", () => {
    expect(minutesUntilLatestStart(a, 0)).toBe(a.latestStart);
    expect(minutesUntilLatestStart(a, a.latestStart)).toBe(0);
  });

  it("escalates urgency as the latest start approaches", () => {
    expect(taskUrgency(a, a.latestStart - 60)).toBe("later");
    expect(taskUrgency(a, a.latestStart - 20)).toBe("soon");
    expect(taskUrgency(a, a.latestStart - 2)).toBe("start_now");
    expect(taskUrgency(a, a.latestStart + 5)).toBe("overdue");
  });

  it("reports a finished task as done regardless of the clock", () => {
    expect(taskUrgency({ ...a, status: "complete" }, 9999)).toBe("done");
    expect(taskUrgency({ ...a, status: "skipped" }, 9999)).toBe("done");
  });
});

describe("formatMinutes", () => {
  it("formats sub-hour durations in minutes", () => {
    expect(formatMinutes(45)).toBe("45m");
  });

  it("formats whole hours without a minutes part", () => {
    expect(formatMinutes(120)).toBe("2h");
  });

  it("formats mixed durations", () => {
    expect(formatMinutes(95)).toBe("1h 35m");
  });

  it("keeps the sign on a negative duration", () => {
    expect(formatMinutes(-30)).toBe("-30m");
    expect(formatMinutes(-95)).toBe("-1h 35m");
  });
});

describe("toWallClock", () => {
  it("offsets the crew call time by the given minutes", () => {
    const at = toWallClock("2026-06-10T14:00:00.000Z", 90);
    expect(at.toISOString()).toBe("2026-06-10T15:30:00.000Z");
  });
});

describe("summariseSchedule", () => {
  it("leads with the dependency loop when the graph is unsolvable", () => {
    const result = scheduleCrewTasks([task("a", 10, ["b"]), task("b", 10, ["a"])], WINDOW);
    expect(summariseSchedule(result, WINDOW)).toMatch(/dependency loop/i);
  });

  it("states the shortfall when the plan does not fit", () => {
    const window: ScheduleWindow = { ...WINDOW, windowMinutes: 60 };
    const result = scheduleCrewTasks([task("a", 45), task("b", 45, ["a"])], window);
    expect(summariseSchedule(result, window)).toMatch(/30m over/);
  });

  it("states the remaining margin when the plan fits", () => {
    const result = scheduleCrewTasks([task("a", 30)], WINDOW);
    expect(summariseSchedule(result, WINDOW)).toMatch(/to spare/);
  });

  it("handles an empty task list", () => {
    const result = scheduleCrewTasks([], DEFAULT_SCHEDULE_WINDOW);
    expect(summariseSchedule(result)).toMatch(/No crew tasks/i);
  });
});
