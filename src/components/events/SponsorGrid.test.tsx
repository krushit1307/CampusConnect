import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SponsorGrid } from "./SponsorGrid";
import { useEventSponsors } from "../../hooks/useEventSponsors";

// Mock the hooks
vi.mock("../../hooks/useEventSponsors", () => ({
  useEventSponsors: vi.fn(),
}));

vi.mock("../../hooks/useHoverTelemetry", () => ({
  useHoverTelemetry: () => ({
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
    onClick: vi.fn(),
  }),
}));

const mockRpc = vi.fn().mockResolvedValue({ data: { success: true }, error: null });

// Mock createClient
vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}));

// Mock IntersectionObserver
const observeMock = vi.fn();
const disconnectMock = vi.fn();
let observerCallback: (entries: any[]) => void = () => {};

class MockIntersectionObserver {
  constructor(callback: any, options?: any) {
    observerCallback = callback;
  }
  observe = observeMock;
  disconnect = disconnectMock;
  unobserve = vi.fn();
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

describe("SponsorGrid Viewability Tracker", () => {
  const mockSponsors = [
    {
      id: "sponsor-1",
      event_id: "event-1",
      name: "Google",
      logo_url: "https://example.com/google.png",
      website_url: "https://google.com",
      tier_level: "platinum",
      display_order: 1,
      created_at: "2026-08-27T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (useEventSponsors as any).mockReturnValue({
      sponsors: mockSponsors,
      isLoading: false,
      deleteSponsor: vi.fn(),
      updateSponsorTier: vi.fn(),
    });
  });

  it("should setup IntersectionObserver and trigger webhook after 2000ms at 100% visibility", async () => {
    render(<SponsorGrid eventId="event-1" />);

    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(observeMock).toHaveBeenCalled();

    // Simulate elements entering viewport (100% visible)
    act(() => {
      observerCallback([
        {
          intersectionRatio: 1.0,
          target: {},
        },
      ]);
    });

    // Fast forward 2000ms
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Check that RPC was invoked with correct params
    expect(mockRpc).toHaveBeenCalledWith("record_sponsor_logo_impression", {
      p_sponsor_id: "sponsor-1",
      p_event_id: "event-1",
      p_time_in_view_ms: 2000,
    });
  });

  it("should cancel transaction if element leaves viewport before 2000ms", async () => {
    render(<SponsorGrid eventId="event-1" />);

    // Enter viewport (100% visible)
    act(() => {
      observerCallback([
        {
          intersectionRatio: 1.0,
          target: {},
        },
      ]);
    });

    // Fast forward 1000ms (not yet triggered)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockRpc).not.toHaveBeenCalled();

    // Leave viewport (not 100% visible anymore)
    act(() => {
      observerCallback([
        {
          intersectionRatio: 0.5,
          target: {},
        },
      ]);
    });

    // Fast forward another 1000ms (total 2000ms elapsed, but timer was cleared)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
