import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import DashboardConflicts from "./dashboard.conflicts";

// Mock Supabase Client
const mockRpc = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: {
            user: {
              id: "user-123",
              email: "student@univ.edu",
            },
          },
        }),
      getSession: () =>
        Promise.resolve({
          data: {
            session: {
              access_token: "mock-token",
            },
          },
        }),
    },
    rpc: mockRpc,
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

vi.mock("@/lib/rsvpIdempotency", () => ({
  getRsvpIdempotencyKey: () => "mock-key",
  clearRsvpIdempotencyKey: () => {},
}));

describe("DashboardConflicts Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when there are no conflicts", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    render(
      <BrowserRouter>
        <DashboardConflicts />
      </BrowserRouter>
    );

    const emptyTitle = await screen.findByText("No schedule conflicts");
    expect(emptyTitle).toBeInTheDocument();
    expect(screen.getByText("All your RSVPs are clean and non-overlapping.")).toBeInTheDocument();
  });

  it("renders schedule conflicts list with items side by side", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          event_id: "event-a",
          event_title: "Engineering Seminar",
          event_start_date: "2026-09-01T12:00:00Z",
          event_end_date: "2026-09-01T13:00:00Z",
          conflict_event_id: "event-b",
          conflict_event_title: "Art Club Meeting",
          conflict_start_date: "2026-09-01T12:30:00Z",
          conflict_end_date: "2026-09-01T13:30:00Z",
        },
      ],
      error: null,
    });

    render(
      <BrowserRouter>
        <DashboardConflicts />
      </BrowserRouter>
    );

    const eventATitle = await screen.findByText("Engineering Seminar");
    const eventBTitle = screen.getByText("Art Club Meeting");

    expect(eventATitle).toBeInTheDocument();
    expect(eventBTitle).toBeInTheDocument();
  });

  it("triggers cancel RSVP mutation when quick-action button is clicked", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          event_id: "event-a",
          event_title: "Engineering Seminar",
          event_start_date: "2026-09-01T12:00:00Z",
          event_end_date: "2026-09-01T13:00:00Z",
          conflict_event_id: "event-b",
          conflict_event_title: "Art Club Meeting",
          conflict_start_date: "2026-09-01T12:30:00Z",
          conflict_end_date: "2026-09-01T13:30:00Z",
        },
      ],
      error: null,
    });

    mockInvoke.mockResolvedValueOnce({ error: null });

    render(
      <BrowserRouter>
        <DashboardConflicts />
      </BrowserRouter>
    );

    const cancelButtons = await screen.findAllByRole("button", { name: /cancel rsvp/i });
    expect(cancelButtons).toHaveLength(2);

    fireEvent.click(cancelButtons[0]);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("toggle-rsvp", expect.objectContaining({
        body: { eventId: "event-a", hasRsvpd: true }
      }));
    });
  });

  it("re-evaluates conflicts when Include travel buffer toggle is checked", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    render(
      <BrowserRouter>
        <DashboardConflicts />
      </BrowserRouter>
    );

    const checkbox = await screen.findByLabelText(/Include 15-minute travel buffer/i);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    await waitFor(() => {
      expect(mockRpc).toHaveBeenLastCalledWith("get_user_schedule_conflicts", {
        p_user_id: "user-123",
        p_include_buffer: true,
      });
    });
  });
});
