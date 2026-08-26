import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveScoreboardOverlay } from "./LiveScoreboardOverlay";
import { createClient } from "@/lib/supabase/client";

// Mock Supabase
vi.mock("@/lib/supabase/client", () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockImplementation((cb) => {
      if (cb) cb("SUBSCRIBED");
      return mockChannel;
    }),
  };
  return {
    createClient: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            score_data: {
              homeTeam: "Eagles",
              awayTeam: "Sharks",
              homeScore: 10,
              awayScore: 5,
              status: "in_progress",
              updatedAt: new Date().toISOString(),
            },
          },
          error: null,
        }),
      }),
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    })),
  };
});

describe("LiveScoreboardOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with initial score data", () => {
    render(
      <LiveScoreboardOverlay
        eventId="test-123"
        initialScoreData={{
          homeTeam: "Tigers",
          awayTeam: "Lions",
          homeScore: 42,
          awayScore: 21,
          status: "in_progress",
          updatedAt: new Date().toISOString(),
        }}
      />,
    );

    expect(screen.getByText("Tigers")).toBeInTheDocument();
    expect(screen.getByText("Lions")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("fetches score data if initialScoreData is not provided", async () => {
    render(<LiveScoreboardOverlay eventId="test-456" />);

    // Wait for the async fetch to complete
    const eagles = await screen.findByText("Eagles");
    expect(eagles).toBeInTheDocument();
    expect(screen.getByText("Sharks")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("handles offline events appropriately", async () => {
    render(
      <LiveScoreboardOverlay
        eventId="test-123"
        initialScoreData={{
          homeTeam: "Tigers",
          awayTeam: "Lions",
          homeScore: 42,
          awayScore: 21,
          status: "in_progress",
          updatedAt: new Date().toISOString(),
        }}
      />,
    );

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(await screen.findByText("Offline - Showing last known score")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByText("Offline - Showing last known score")).not.toBeInTheDocument();
  });
});
