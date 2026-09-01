// src/components/events/HelpQueueAttendeeWidget.test.tsx
// -----------------------------------------------------------------------------
// Component tests for src/components/events/HelpQueueAttendeeWidget.tsx
// (Issue #3938).
// -----------------------------------------------------------------------------

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HelpQueueAttendeeWidget } from "./HelpQueueAttendeeWidget";
import type { HelpTicket } from "@/lib/helpQueue";

const mockUseHelpQueue = vi.fn();
vi.mock("@/hooks/useHelpQueue", () => ({
  useHelpQueue: (...args: unknown[]) => mockUseHelpQueue(...args),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const mockTicket: HelpTicket = {
  id: "t1",
  event_id: "e1",
  requested_by: "u1",
  team_name: "Code Ninjas",
  table_number: "42",
  issue_description: "React won't compile",
  status: "open",
  mentor_id: null,
  created_at: "2026-06-01T10:00:00.000Z",
  claimed_at: null,
  resolved_at: null,
  updated_at: "2026-06-01T10:00:00.000Z",
};

describe("HelpQueueAttendeeWidget", () => {
  beforeEach(() => {
    mockUseHelpQueue.mockReset();
  });

  it("renders the submit form when no active ticket", () => {
    mockUseHelpQueue.mockReturnValue({
      tickets: [], isLoading: false, error: null,
      submitTicket: vi.fn(), cancelTicket: vi.fn(),
    });
    render(<HelpQueueAttendeeWidget eventId="e1" userId="u1" />);
    expect(screen.getByTestId("help-request-form")).toBeTruthy();
    expect(screen.getByTestId("hq-submit-btn")).toBeTruthy();
  });

  it("renders the active ticket card when user has an open ticket", () => {
    mockUseHelpQueue.mockReturnValue({
      tickets: [{ ...mockTicket, requested_by: "u1" }],
      isLoading: false, error: null,
      submitTicket: vi.fn(), cancelTicket: vi.fn(),
    });
    render(<HelpQueueAttendeeWidget eventId="e1" userId="u1" />);
    expect(screen.getByTestId("active-ticket-card")).toBeTruthy();
    expect(screen.getByTestId("active-ticket-card").textContent).toContain("Code Ninjas");
  });

  it("shows queue position when ticket is open", () => {
    const older = { ...mockTicket, id: "t0", created_at: "2026-06-01T09:00:00Z" };
    const mine = { ...mockTicket, id: "t1", created_at: "2026-06-01T10:00:00Z" };
    mockUseHelpQueue.mockReturnValue({
      tickets: [older, mine], isLoading: false, error: null,
      submitTicket: vi.fn(), cancelTicket: vi.fn(),
    });
    render(<HelpQueueAttendeeWidget eventId="e1" userId="u1" />);
    expect(screen.getByText(/#2 in line/i)).toBeTruthy();
  });

  it("renders mentor claimed message when ticket is claimed", () => {
    mockUseHelpQueue.mockReturnValue({
      tickets: [{ ...mockTicket, status: "claimed", mentor_id: "m1", mentor_name: "Alex" }],
      isLoading: false, error: null,
      submitTicket: vi.fn(), cancelTicket: vi.fn(),
    });
    render(<HelpQueueAttendeeWidget eventId="e1" userId="u1" />);
    expect(screen.getByTestId("active-ticket-card").textContent).toContain(
      "Alex is on their way to Table 42!",
    );
  });

  it("disables submit button when userId is null", () => {
    mockUseHelpQueue.mockReturnValue({
      tickets: [], isLoading: false, error: null,
      submitTicket: vi.fn(), cancelTicket: vi.fn(),
    });
    render(<HelpQueueAttendeeWidget eventId="e1" userId={null} />);
    const btn = screen.getByTestId("hq-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("calls submitTicket when form is filled and submitted", async () => {
    const submitTicket = vi.fn().mockResolvedValue(mockTicket);
    mockUseHelpQueue.mockReturnValue({
      tickets: [], isLoading: false, error: null,
      submitTicket, cancelTicket: vi.fn(),
    });
    render(<HelpQueueAttendeeWidget eventId="e1" userId="u1" />);

    fireEvent.change(screen.getByTestId("hq-team-name"), { target: { value: "Team A" } });
    fireEvent.change(screen.getByTestId("hq-table-number"), { target: { value: "5" } });
    fireEvent.change(screen.getByTestId("hq-issue"), { target: { value: "Bug!" } });
    fireEvent.click(screen.getByTestId("hq-submit-btn"));

    await waitFor(() => {
      expect(submitTicket).toHaveBeenCalledWith({
        team_name: "Team A", table_number: "5", issue_description: "Bug!",
      });
    });
  });

  it("renders error state", () => {
    mockUseHelpQueue.mockReturnValue({
      tickets: [], isLoading: false, error: "Failed to load",
      submitTicket: vi.fn(), cancelTicket: vi.fn(),
    });
    render(<HelpQueueAttendeeWidget eventId="e1" userId="u1" />);
    expect(screen.getByTestId("help-queue-attendee-error").textContent).toContain(
      "Failed to load",
    );
  });

  it("shows cancel button for open tickets", () => {
    mockUseHelpQueue.mockReturnValue({
      tickets: [{ ...mockTicket, requested_by: "u1" }],
      isLoading: false, error: null,
      submitTicket: vi.fn(), cancelTicket: vi.fn(),
    });
    render(<HelpQueueAttendeeWidget eventId="e1" userId="u1" />);
    expect(screen.getByTestId("hq-cancel-btn")).toBeTruthy();
  });

  it("does not show cancel button for claimed tickets", () => {
    mockUseHelpQueue.mockReturnValue({
      tickets: [{ ...mockTicket, status: "claimed", requested_by: "u1", mentor_id: "m1" }],
      isLoading: false, error: null,
      submitTicket: vi.fn(), cancelTicket: vi.fn(),
    });
    render(<HelpQueueAttendeeWidget eventId="e1" userId="u1" />);
    expect(screen.queryByTestId("hq-cancel-btn")).toBeNull();
  });
});
