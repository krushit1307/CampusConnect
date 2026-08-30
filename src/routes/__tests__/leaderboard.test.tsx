import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import GamificationLeaderboard from "../leaderboard";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import {
  getTopUsersMonthlyLeaderboard,
  getTopClubsMonthlyLeaderboard,
} from "@/services/gamificationLeaderboardService";

vi.mock("@/services/gamificationLeaderboardService", () => ({
  getTopUsersMonthlyLeaderboard: vi.fn(),
  getTopClubsMonthlyLeaderboard: vi.fn(),
}));

// Mock SiteShell
vi.mock("@/components/site/SiteShell", () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="site-shell">{children}</div>
  ),
}));

describe("GamificationLeaderboard Component (#3894)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUsers = [
    {
      user_id: "u-1",
      first_name: "Alice",
      last_name: "Smith",
      avatar_url: "/avatar1.png",
      monthly_points: 300,
      rank_position: 1,
    },
    {
      user_id: "u-2",
      first_name: "Bob",
      last_name: "Jones",
      avatar_url: "/avatar2.png",
      monthly_points: 250,
      rank_position: 2,
    },
    {
      user_id: "u-3",
      first_name: "Charlie",
      last_name: "Brown",
      avatar_url: "/avatar3.png",
      monthly_points: 200,
      rank_position: 3,
    },
    {
      user_id: "u-4",
      first_name: "Dave",
      last_name: "Miller",
      avatar_url: "/avatar4.png",
      monthly_points: 150,
      rank_position: 4,
    },
  ];

  const mockClubs = [
    {
      club_id: "c-1",
      club_name: "Film Club",
      logo_url: "/logo1.png",
      slug: "film-club",
      monthly_points: 1000,
      rank_position: 1,
    },
    {
      club_id: "c-2",
      club_name: "Chess Club",
      logo_url: "/logo2.png",
      slug: "chess-club",
      monthly_points: 800,
      rank_position: 2,
    },
    {
      club_id: "c-3",
      club_name: "Coding Club",
      logo_url: "/logo3.png",
      slug: "coding-club",
      monthly_points: 600,
      rank_position: 3,
    },
  ];

  it("renders public leaderboard page with podium and list, and supports switching tabs", async () => {
    (getTopUsersMonthlyLeaderboard as any).mockResolvedValue(mockUsers);
    (getTopClubsMonthlyLeaderboard as any).mockResolvedValue(mockClubs);

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GamificationLeaderboard />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Verify header and page container
    expect(screen.getByTestId("leaderboard-container")).toBeInTheDocument();
    expect(screen.getByText("Campus Leaderboard")).toBeInTheDocument();

    // Verify top 3 on the podium
    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-podium")).toBeInTheDocument();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
    });

    // Verify remaining ranks in the list
    expect(screen.getByTestId("leaderboard-list")).toBeInTheDocument();
    expect(screen.getByText("Dave Miller")).toBeInTheDocument();

    // Switch to Clubs tab
    const clubsTabButton = screen.getByRole("button", { name: /Top Clubs/i });
    fireEvent.click(clubsTabButton);

    // Verify club podium
    await waitFor(() => {
      expect(screen.getByText("Film Club")).toBeInTheDocument();
      expect(screen.getByText("Chess Club")).toBeInTheDocument();
      expect(screen.getByText("Coding Club")).toBeInTheDocument();
    });
  });
});
