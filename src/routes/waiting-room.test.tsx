import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WaitingRoomPage from "./waiting-room";

// Mock Supabase client
const mockInvoke = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: "mock-token" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { id: "event-123", title: "Spring Gala Gala", location: "Grand Hall", event_date: "2026-09-01" },
            error: null,
          }),
        }),
      }),
    }),
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams("event_id=event-123")],
  };
});

describe("WaitingRoomPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the waiting room page and requests to join the queue", async () => {
    mockInvoke.mockResolvedValue({
      data: { status: "waiting", position: 12, total: 100, estimatedWaitTime: 60 },
      error: null,
    });

    render(
      <MemoryRouter>
        <WaitingRoomPage />
      </MemoryRouter>
    );

    // Initial check
    expect(screen.getByText("Live Queue Waiting Room")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("event-waiting-room", expect.objectContaining({
        body: { eventId: "event-123", action: "join" }
      }));
    });

    // Wait stats
    expect(await screen.findByText("12")).toBeInTheDocument(); // Position
    expect(await screen.findByText("1s")).toBeInTheDocument(); // 60 seconds formatted
  });

  it("saves ticket and redirects when admitted", async () => {
    mockInvoke.mockResolvedValue({
      data: { status: "admitted", ticket: "jwt-ticket-token" },
      error: null,
    });

    render(
      <MemoryRouter>
        <WaitingRoomPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(sessionStorage.getItem("ticket_event_event-123")).toBe("jwt-ticket-token");
      expect(mockNavigate).toHaveBeenCalledWith("/events/event-123");
    });
  });
});
