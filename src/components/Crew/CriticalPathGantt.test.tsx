import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CriticalPathGantt } from "./CriticalPathGantt";
import { scheduleCrewTasks, type CrewTask, type ScheduleWindow } from "@/lib/crewCriticalPath";

const mockUseCrewSchedule = vi.fn();

vi.mock("@/hooks/useCrewSchedule", () => ({
  useCrewSchedule: (...args: unknown[]) => mockUseCrewSchedule(...args),
}));

const CREW_CALL = "2026-06-10T14:00:00.000Z";

const PHASE_ROW = {
  id: "p1",
  event_id: "e1",
  phase: "setup" as const,
  crew_call_at: CREW_CALL,
  deadline_at: "2026-06-10T18:00:00.000Z",
  crew_available: 8,
  near_critical_threshold_minutes: 15,
};

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

/** Builds a real schedule so the component is tested against real CPM output. */
function buildResult(tasks: CrewTask[], windowOverrides: Partial<ScheduleWindow> = {}) {
  const window: ScheduleWindow = {
    windowMinutes: 240,
    crewAvailable: 8,
    nearCriticalThresholdMinutes: 15,
    ...windowOverrides,
  };
  return { schedule: scheduleCrewTasks(tasks, window), window };
}

function hookResult(overrides: Record<string, unknown> = {}) {
  const { schedule, window } = buildResult([task("a", 30)]);
  return {
    phase: PHASE_ROW,
    window,
    schedule,
    nowMinutes: 0,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    reportProgress: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseCrewSchedule.mockReset();
});

describe("CriticalPathGantt", () => {
  it("shows a loading state while the schedule is computed", () => {
    mockUseCrewSchedule.mockReturnValue(hookResult({ isLoading: true }));
    render(<CriticalPathGantt eventId="e1" />);
    expect(screen.getByText(/Computing the critical path/i)).toBeTruthy();
  });

  it("surfaces a load error with a retry", async () => {
    const refresh = vi.fn();
    mockUseCrewSchedule.mockReturnValue(hookResult({ error: "network down", refresh }));
    render(<CriticalPathGantt eventId="e1" />);

    expect(screen.getByText(/network down/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("prompts for setup when no phase is configured", () => {
    mockUseCrewSchedule.mockReturnValue(hookResult({ phase: null, schedule: null, window: null }));
    render(<CriticalPathGantt eventId="e1" />);
    expect(screen.getByText(/No setup schedule has been set up/i)).toBeTruthy();
  });

  it("shows the dependency loop instead of a broken chart", () => {
    const { schedule, window } = buildResult([task("a", 10, ["b"]), task("b", 10, ["a"])]);
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window }));
    render(<CriticalPathGantt eventId="e1" />);

    expect(screen.getByText(/cannot be scheduled/i)).toBeTruthy();
    expect(screen.getByText(/depend on each other in a loop/i)).toBeTruthy();
  });

  it("warns when the plan overruns the available window", () => {
    const { schedule, window } = buildResult([task("a", 45), task("b", 45, ["a"])], {
      windowMinutes: 60,
    });
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window }));
    render(<CriticalPathGantt eventId="e1" />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/does not fit the window/i)).toBeTruthy();
    expect(screen.getByText(/30m past the deadline/i)).toBeTruthy();
  });

  it("does not warn about the window when the plan fits", () => {
    mockUseCrewSchedule.mockReturnValue(hookResult());
    render(<CriticalPathGantt eventId="e1" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("names the critical chain that decides the open time", () => {
    const { schedule, window } = buildResult([task("a", 30), task("b", 30, ["a"])], {
      windowMinutes: 60,
    });
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window }));
    render(<CriticalPathGantt eventId="e1" />);

    expect(screen.getByText(/decides your open time/i)).toBeTruthy();
    expect(screen.getByText("Task a → Task b")).toBeTruthy();
  });

  it("reports crew double-booking with the affected window", () => {
    const { schedule, window } = buildResult(
      [task("a", 30, [], { crewSize: 5 }), task("b", 30, [], { crewSize: 5 })],
      { crewAvailable: 8 },
    );
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window }));
    render(<CriticalPathGantt eventId="e1" />);

    expect(screen.getByText(/double-booked/i)).toBeTruthy();
    expect(screen.getByText(/10 crew needed, 8 available/)).toBeTruthy();
  });

  it("mentions dependency references to deleted tasks", () => {
    const { schedule, window } = buildResult([task("a", 30, ["ghost"])]);
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window }));
    render(<CriticalPathGantt eventId="e1" />);
    expect(screen.getByText(/point to tasks that no longer exist/i)).toBeTruthy();
  });

  it("marks a task on the critical path for screen readers", () => {
    const { schedule, window } = buildResult([task("a", 30), task("b", 30, ["a"])], {
      windowMinutes: 60,
    });
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window }));
    render(<CriticalPathGantt eventId="e1" />);
    expect(screen.getAllByLabelText(/on the critical path/i).length).toBe(2);
  });

  it("offers a start control only for a task whose dependencies are met", () => {
    const { schedule, window } = buildResult([task("a", 30), task("b", 30, ["a"])]);
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window }));
    render(<CriticalPathGantt eventId="e1" />);

    expect(screen.getByLabelText("Start Task a")).toBeTruthy();
    expect(screen.queryByLabelText("Start Task b")).toBeNull();
  });

  it("reports progress when a task is started", async () => {
    const reportProgress = vi.fn();
    const { schedule, window } = buildResult([task("a", 30)]);
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window, reportProgress }));
    render(<CriticalPathGantt eventId="e1" />);

    fireEvent.click(screen.getByLabelText("Start Task a"));
    await waitFor(() => expect(reportProgress).toHaveBeenCalledWith("a", "in_progress"));
  });

  it("offers a complete control for a task already underway", async () => {
    const reportProgress = vi.fn();
    const { schedule, window } = buildResult([
      task("a", 30, [], { status: "in_progress", actualStartMinutes: 5 }),
    ]);
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window, reportProgress }));
    render(<CriticalPathGantt eventId="e1" />);

    fireEvent.click(screen.getByLabelText("Complete Task a"));
    await waitFor(() => expect(reportProgress).toHaveBeenCalledWith("a", "complete"));
  });

  it("shows a blocked task's outstanding dependency count", () => {
    const { schedule, window } = buildResult([
      task("a", 30),
      task("b", 30),
      task("c", 10, ["a", "b"]),
    ]);
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window }));
    render(<CriticalPathGantt eventId="e1" />);
    expect(screen.getByText(/blocked by 2/)).toBeTruthy();
  });

  it("marks an overdue task against the current clock", () => {
    const { schedule, window } = buildResult([task("a", 30), task("b", 30, ["a"])], {
      windowMinutes: 60,
    });
    // Crew is 40 minutes in; task a's latest start was 0.
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window, nowMinutes: 40 }));
    render(<CriticalPathGantt eventId="e1" />);
    expect(screen.getAllByText(/late$/).length).toBeGreaterThan(0);
  });

  it("prompts for tasks when the phase exists but is empty", () => {
    const { schedule, window } = buildResult([]);
    mockUseCrewSchedule.mockReturnValue(hookResult({ schedule, window }));
    render(<CriticalPathGantt eventId="e1" />);
    expect(screen.getByText(/No crew tasks yet/i)).toBeTruthy();
  });

  it("passes the event and phase through to the hook", () => {
    mockUseCrewSchedule.mockReturnValue(hookResult());
    render(<CriticalPathGantt eventId="event-9" phase="teardown" />);
    expect(mockUseCrewSchedule).toHaveBeenCalledWith("event-9", "teardown");
  });
});
