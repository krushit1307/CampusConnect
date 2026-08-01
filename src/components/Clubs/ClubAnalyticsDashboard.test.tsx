import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { ClubAnalyticsDashboard } from "./ClubAnalyticsDashboard";

// Mock Supabase client
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}));

// Mock Recharts ResponsiveContainer to render children cleanly
vi.mock("recharts", async () => {
  const original = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 400 }}>
        {children}
      </div>
    ),
  };
});

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>);
}

describe("ClubAnalyticsDashboard Component", () => {
  const mockClubId = "test-club-123";

  const mockAnalyticsData = {
    range: "last-30-days",
    start_date: "2026-07-01",
    end_date: "2026-07-30",
    summary: {
      total_rsvps: 150,
      total_checkins: 120,
      total_posts: 45,
      total_comments: 90,
      total_views: 1200,
      total_members: 85,
    },
    timeline: [
      { date: "2026-07-01", rsvps: 10, checkins: 8, posts: 3, comments: 6, activity: 9 },
      { date: "2026-07-02", rsvps: 15, checkins: 12, posts: 5, comments: 10, activity: 15 },
    ],
    top_events: [
      {
        event_id: "ev-1",
        event_title: "Tech Hackathon",
        views: 450,
        rsvps: 60,
        event_date: "2026-07-15",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders loading state initially", () => {
    mockRpc.mockReturnValue(new Promise(() => {})); // Never resolves

    const { container } = renderWithClient(<ClubAnalyticsDashboard clubId={mockClubId} />);
    expect(screen.getByText(/Club Analytics & Insights/i)).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders summary KPIs and charts after loading data", async () => {
    mockRpc.mockResolvedValue({ data: mockAnalyticsData, error: null });

    renderWithClient(<ClubAnalyticsDashboard clubId={mockClubId} />);

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument(); // total rsvps
      expect(screen.getByText("1200")).toBeInTheDocument(); // total views
      expect(screen.getByText("135")).toBeInTheDocument(); // 45 posts + 90 comments = 135
      expect(screen.getByText("85")).toBeInTheDocument(); // total members
    });

    expect(screen.getByText(/RSVP & Attendance Trends/i)).toBeInTheDocument();
    expect(screen.getByText(/Discussion Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Top Events by Page Views/i)).toBeInTheDocument();
  });

  it("requests default last-30-days timestamps on initial load", async () => {
    mockRpc.mockResolvedValue({ data: mockAnalyticsData, error: null });

    renderWithClient(<ClubAnalyticsDashboard clubId={mockClubId} />);

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
    });

    const now = new Date("2026-08-01T12:00:00Z");
    const expectedStart = startOfDay(subDays(now, 29)).toISOString();
    const expectedEnd = endOfDay(now).toISOString();

    expect(mockRpc).toHaveBeenCalledWith("get_club_analytics", {
      p_club_id: mockClubId,
      p_range: "last-30-days",
      p_start_at: expectedStart,
      p_end_at: expectedEnd,
    });
  });

  it("updates the range query when a preset is clicked", async () => {
    mockRpc.mockResolvedValue({ data: mockAnalyticsData, error: null });

    renderWithClient(<ClubAnalyticsDashboard clubId={mockClubId} />);

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /last 30 days/i }));
    fireEvent.click(screen.getByRole("button", { name: /today/i }));

    const today = new Date("2026-08-01T12:00:00Z");
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();

    await waitFor(() => {
      expect(mockRpc).toHaveBeenLastCalledWith("get_club_analytics", {
        p_club_id: mockClubId,
        p_range: "today",
        p_start_at: todayStart,
        p_end_at: todayEnd,
      });
    });
  });

  it("renders error state when RPC call fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "Database RPC error" } });

    renderWithClient(<ClubAnalyticsDashboard clubId={mockClubId} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load analytics data for this club/i)).toBeInTheDocument();
    });
  });
});
