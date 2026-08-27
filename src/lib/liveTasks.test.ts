import { describe, it, expect } from "vitest";
import {
  isTaskClaimable, slotsRemaining, isUserAssigned,
  formatVolunteerNames, buildCompletionToast,
  liveTasksChannelName, urgencyLabel,
  type LiveTask, type LiveTaskAssignment, type CompleteLiveTaskResult,
} from "./liveTasks";

function makeTask(overrides: Partial<LiveTask> = {}): LiveTask {
  return {
    id: "task-1", event_id: "event-1", created_by: "org-1",
    description: "Carry 50 boxes of pizza",
    points_reward: 50, max_volunteers: 3, status: "open",
    expires_at: "2099-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<LiveTaskAssignment> = {}): LiveTaskAssignment {
  return {
    id: "a-1", task_id: "task-1", user_id: "u-1",
    accepted_at: "2026-01-01T00:00:00.000Z",
    points_awarded: false, user_name: "Alex",
    ...overrides,
  };
}

describe("isTaskClaimable", () => {
  it("returns true for an open task with future expiry", () => {
    expect(isTaskClaimable(makeTask(), new Date("2026-06-01T00:00:00.000Z"))).toBe(true);
  });
  it("returns false for a completed task", () => {
    expect(isTaskClaimable(makeTask({ status: "completed" }))).toBe(false);
  });
  it("returns false for a cancelled task", () => {
    expect(isTaskClaimable(makeTask({ status: "cancelled" }))).toBe(false);
  });
  it("returns false when expiry is in the past", () => {
    expect(isTaskClaimable(
      makeTask({ expires_at: "2020-01-01T00:00:00.000Z" }),
      new Date("2026-06-01T00:00:00.000Z"),
    )).toBe(false);
  });
  it("returns false when expiry equals now", () => {
    expect(isTaskClaimable(
      makeTask({ expires_at: "2026-06-01T00:00:00.000Z" }),
      new Date("2026-06-01T00:00:00.000Z"),
    )).toBe(false);
  });
});

describe("slotsRemaining", () => {
  it("returns max_volunteers when no assignments", () => {
    expect(slotsRemaining(makeTask({ max_volunteers: 3 }), 0)).toBe(3);
  });
  it("returns the difference when partially filled", () => {
    expect(slotsRemaining(makeTask({ max_volunteers: 3 }), 1)).toBe(2);
    expect(slotsRemaining(makeTask({ max_volunteers: 3 }), 2)).toBe(1);
  });
  it("clamps at 0 when overfilled", () => {
    expect(slotsRemaining(makeTask({ max_volunteers: 3 }), 3)).toBe(0);
    expect(slotsRemaining(makeTask({ max_volunteers: 3 }), 5)).toBe(0);
  });
});

describe("isUserAssigned", () => {
  it("returns false when user is null", () => {
    expect(isUserAssigned(makeTask(), [], null)).toBe(false);
    expect(isUserAssigned(makeTask(), [], undefined)).toBe(false);
  });
  it("returns false when user is not in assignments", () => {
    expect(isUserAssigned(makeTask(), [makeAssignment({ user_id: "u-1" })], "u-2")).toBe(false);
  });
  it("returns true when user is in assignments for the same task", () => {
    expect(isUserAssigned(
      makeTask({ id: "task-1" }),
      [makeAssignment({ task_id: "task-1", user_id: "u-1" })],
      "u-1",
    )).toBe(true);
  });
  it("returns false when user is assigned to a different task", () => {
    expect(isUserAssigned(
      makeTask({ id: "task-1" }),
      [makeAssignment({ task_id: "task-2", user_id: "u-1" })],
      "u-1",
    )).toBe(false);
  });
});

describe("formatVolunteerNames", () => {
  it("returns empty string for no assignments", () => {
    expect(formatVolunteerNames([])).toBe("");
  });
  it("returns the single name for one volunteer", () => {
    expect(formatVolunteerNames([makeAssignment({ user_name: "Alex" })])).toBe("Alex");
  });
  it("uses 'and' for two volunteers", () => {
    expect(formatVolunteerNames([
      makeAssignment({ user_name: "Alex" }),
      makeAssignment({ user_name: "Sarah" }),
    ])).toBe("Alex and Sarah");
  });
  it("uses Oxford comma for three volunteers", () => {
    expect(formatVolunteerNames([
      makeAssignment({ user_name: "Alex" }),
      makeAssignment({ user_name: "Sarah" }),
      makeAssignment({ user_name: "John" }),
    ])).toBe("Alex, Sarah, and John");
  });
  it("truncates with 'and N more' when exceeding maxNames", () => {
    const a = ["A", "B", "C", "D", "E"].map((n) => makeAssignment({ user_name: n }));
    expect(formatVolunteerNames(a, 3)).toBe("A, B, C, and 2 more");
  });
  it("falls back to 'Anonymous' for missing names", () => {
    expect(formatVolunteerNames([
      makeAssignment({ user_name: undefined }),
      makeAssignment({ user_name: "Sarah" }),
    ])).toBe("Anonymous and Sarah");
  });
  it("trims whitespace in names", () => {
    expect(formatVolunteerNames([
      makeAssignment({ user_name: "  Alex  " }),
      makeAssignment({ user_name: "Sarah" }),
    ])).toBe("Alex and Sarah");
  });
});

describe("buildCompletionToast", () => {
  it("returns the no-volunteers message when no points were awarded", () => {
    expect(buildCompletionToast({ ok: true, awarded: [] }, [])).toBe(
      "No volunteers claimed this task.",
    );
  });
  it("returns the no-volunteers message when result is not ok", () => {
    expect(buildCompletionToast({ ok: false, reason: "error" }, [])).toBe(
      "No volunteers claimed this task.",
    );
  });
  it("returns the single-volunteer message for one award", () => {
    const result: CompleteLiveTaskResult = {
      ok: true, task_id: "task-1", points_reward: 50,
      awarded: [{ user_id: "u-1", name: "Alex", amount: 50 }],
    };
    const assignments = [makeAssignment({ user_id: "u-1", user_name: "Alex" })];
    expect(buildCompletionToast(result, assignments)).toBe("Alex earned 50 points. 🎉");
  });
  it("returns the multi-volunteer message with 'each' for multiple awards", () => {
    const result: CompleteLiveTaskResult = {
      ok: true, task_id: "task-1", points_reward: 50,
      awarded: [
        { user_id: "u-1", name: "Alex", amount: 50 },
        { user_id: "u-2", name: "Sarah", amount: 50 },
        { user_id: "u-3", name: "John", amount: 50 },
      ],
    };
    const assignments = [
      makeAssignment({ user_id: "u-1", user_name: "Alex" }),
      makeAssignment({ user_id: "u-2", user_name: "Sarah" }),
      makeAssignment({ user_id: "u-3", user_name: "John" }),
    ];
    expect(buildCompletionToast(result, assignments)).toBe(
      "Alex, Sarah, and John earned 50 points each. 🎉",
    );
  });
});

describe("liveTasksChannelName", () => {
  it("returns the prefixed channel name for an event", () => {
    expect(liveTasksChannelName("event-123")).toBe("live_tasks_event_event-123");
  });
  it("handles UUID-shaped event IDs", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(liveTasksChannelName(uuid)).toBe(`live_tasks_event_${uuid}`);
  });
});

describe("urgencyLabel", () => {
  it("returns 'Plenty of time' (green) when > 5 minutes left", () => {
    const t = makeTask({ expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
    expect(urgencyLabel(t)).toEqual({ label: "Plenty of time", tone: "green" });
  });
  it("returns 'Hurry up' (amber) when 2-5 minutes left", () => {
    const t = makeTask({ expires_at: new Date(Date.now() + 3 * 60_000).toISOString() });
    expect(urgencyLabel(t)).toEqual({ label: "Hurry up", tone: "amber" });
  });
  it("returns 'Closing!' (red) when < 2 minutes left", () => {
    const t = makeTask({ expires_at: new Date(Date.now() + 60_000).toISOString() });
    expect(urgencyLabel(t)).toEqual({ label: "Closing!", tone: "red" });
  });
  it("returns 'Expired' (gray) when expiry is in the past", () => {
    expect(urgencyLabel(makeTask({ expires_at: "2020-01-01T00:00:00.000Z" }))).toEqual(
      { label: "Expired", tone: "gray" },
    );
  });
  it("returns 'Expired' (gray) when status is completed", () => {
    expect(urgencyLabel(makeTask({ status: "completed" }))).toEqual(
      { label: "Expired", tone: "gray" },
    );
  });
  it("returns 'Expired' (gray) when status is cancelled", () => {
    expect(urgencyLabel(makeTask({ status: "cancelled" }))).toEqual(
      { label: "Expired", tone: "gray" },
    );
  });
});
