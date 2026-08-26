import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LiveTaskAttendeePopup } from "./LiveTaskAttendeePopup";
import type { LiveTask, LiveTaskAssignment } from "@/lib/liveTasks";

const mockUseLiveTasks = vi.fn();
vi.mock("@/hooks/useLiveTasks", () => ({
  useLiveTasks: (...args: unknown[]) => mockUseLiveTasks(...args),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

class MockAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  createOscillator() {
    return { connect: () => {}, start: () => {}, stop: () => {}, type: "", frequency: { value: 0 } };
  }
  createGain() {
    return {
      connect: () => {},
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    };
  }
}
// @ts-expect-error jsdom doesn't have AudioContext by default
global.AudioContext = MockAudioContext;

const mockTask: LiveTask = {
  id: "task-1", event_id: "event-1", created_by: "org-1",
  description: "Carry 50 boxes of pizza from lobby to 4th floor",
  points_reward: 50, max_volunteers: 3, status: "open",
  expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function makeAssignment(overrides: Partial<LiveTaskAssignment> = {}): LiveTaskAssignment {
  return {
    id: "a-1", task_id: "task-1", user_id: "u-1",
    accepted_at: "2026-01-01T00:00:00.000Z",
    points_awarded: false, user_name: "Alex",
    ...overrides,
  };
}

describe("LiveTaskAttendeePopup", () => {
  beforeEach(() => {
    mockUseLiveTasks.mockReset();
  });

  it("renders nothing when there are no open tasks", () => {
    mockUseLiveTasks.mockReturnValue({
      tasks: [], assignmentsByTask: {}, acceptTask: vi.fn(),
    });
    const { container } = render(
      <LiveTaskAttendeePopup eventId="event-1" userId="u-1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the popup with description and stats when a new task arrives", () => {
    mockUseLiveTasks.mockReturnValue({
      tasks: [mockTask], assignmentsByTask: {}, acceptTask: vi.fn(),
    });
    render(<LiveTaskAttendeePopup eventId="event-1" userId="u-1" />);
    expect(screen.getByTestId("live-task-attendee-popup")).toBeTruthy();
    expect(screen.getByTestId("popup-description").textContent).toContain(
      "Carry 50 boxes of pizza",
    );
    expect(screen.getByTestId("popup-accept-btn")).toBeTruthy();
  });

  it("calls acceptTask when the user clicks 'I'm in!'", async () => {
    const acceptTask = vi.fn().mockResolvedValue({
      accepted: true, current_count: 1, max_volunteers: 3,
    });
    mockUseLiveTasks.mockReturnValue({
      tasks: [mockTask], assignmentsByTask: {}, acceptTask,
    });
    render(<LiveTaskAttendeePopup eventId="event-1" userId="u-1" />);
    fireEvent.click(screen.getByTestId("popup-accept-btn"));
    await waitFor(() => expect(acceptTask).toHaveBeenCalledWith("task-1"));
  });

  it("disables the accept button while the RPC is in flight", async () => {
    let resolveAccept: (v: { accepted: boolean }) => void = () => {};
    const acceptTask = vi.fn().mockReturnValue(
      new Promise<{ accepted: boolean }>((r) => { resolveAccept = r; }),
    );
    mockUseLiveTasks.mockReturnValue({
      tasks: [mockTask], assignmentsByTask: {}, acceptTask,
    });
    render(<LiveTaskAttendeePopup eventId="event-1" userId="u-1" />);

    const btn = screen.getByTestId("popup-accept-btn") as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => expect(btn.disabled).toBe(true));
    expect(btn.textContent).toContain("Claiming");

    resolveAccept({ accepted: true });
    await waitFor(() => expect(btn.disabled).toBe(false));
  });

  it("renders the 'all slots filled' state when slots is 0 and user is not assigned", () => {
    const assignments = [
      makeAssignment({ user_id: "u-2", user_name: "Sarah" }),
      makeAssignment({ user_id: "u-3", user_name: "John" }),
      makeAssignment({ user_id: "u-4", user_name: "Priya" }),
    ];
    mockUseLiveTasks.mockReturnValue({
      tasks: [mockTask],
      assignmentsByTask: { "task-1": assignments },
      acceptTask: vi.fn(),
    });
    render(<LiveTaskAttendeePopup eventId="event-1" userId="u-1" />);
    expect(screen.queryByTestId("popup-accept-btn")).toBeNull();
    expect(screen.getByTestId("popup-full-state").textContent).toContain(
      "All 3 slots are filled",
    );
  });

  it("dismisses the popup when the X button is clicked", () => {
    mockUseLiveTasks.mockReturnValue({
      tasks: [mockTask], assignmentsByTask: {}, acceptTask: vi.fn(),
    });
    render(<LiveTaskAttendeePopup eventId="event-1" userId="u-1" />);
    expect(screen.getByTestId("live-task-attendee-popup")).toBeTruthy();
    fireEvent.click(screen.getByTestId("popup-dismiss"));
    expect(screen.queryByTestId("live-task-attendee-popup")).toBeNull();
  });

  it("disables the accept button when userId is null (signed-out user)", () => {
    mockUseLiveTasks.mockReturnValue({
      tasks: [mockTask], assignmentsByTask: {}, acceptTask: vi.fn(),
    });
    render(<LiveTaskAttendeePopup eventId="event-1" userId={null} />);
    const btn = screen.getByTestId("popup-accept-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("auto-dismisses when the task becomes completed", () => {
    mockUseLiveTasks.mockReturnValue({
      tasks: [{ ...mockTask, status: "completed" }],
      assignmentsByTask: {},
      acceptTask: vi.fn(),
    });
    render(<LiveTaskAttendeePopup eventId="event-1" userId="u-1" />);
    expect(screen.queryByTestId("live-task-attendee-popup")).toBeNull();
  });

  it("auto-dismisses when the task becomes cancelled", () => {
    mockUseLiveTasks.mockReturnValue({
      tasks: [{ ...mockTask, status: "cancelled" }],
      assignmentsByTask: {},
      acceptTask: vi.fn(),
    });
    render(<LiveTaskAttendeePopup eventId="event-1" userId="u-1" />);
    expect(screen.queryByTestId("live-task-attendee-popup")).toBeNull();
  });
});
