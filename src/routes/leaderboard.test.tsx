// =============================================================================
// File: src/routes/leaderboard.test.tsx
// Feature: Underdog Catch-Up Engine – Frontend Unit Tests
// Description: Verifies rendering of the UnderdogCatchUpPanel on the leaderboard
//   route under various user states (boosted, top-ranked, no-club).
// =============================================================================

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

/** Bounty for an underdog club (in progress, not yet claimed) */
const MOCK_ACTIVE_BOUNTY = {
  id: "bounty-001",
  club_id: "club-001",
  target_checkins: 10,
  current_checkins: 6,
  reward_points: 200,
  expires_at: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(), // 48h from now
  clubs: { name: "Tiny Robotics Club" },
};

/** Default mock Supabase builder helpers */
function buildMockSupabase({
  multiplier = 2.0,
  bountyRow = MOCK_ACTIVE_BOUNTY as any,
  memberRows = [{ club_id: "club-001" }],
}: {
  multiplier?: number;
  bountyRow?: any;
  memberRows?: any[];
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: bountyRow, error: null });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const gt = vi.fn().mockReturnValue({ order });
  const isNull = vi.fn().mockReturnValue({ gt });
  const inFilter = vi.fn().mockReturnValue({ is: isNull });
  const selectBounty = vi.fn().mockReturnValue({ in: inFilter });

  const memberEqStatus = vi.fn().mockResolvedValue({ data: memberRows, error: null });
  const memberEqUser = vi.fn().mockReturnValue({ eq: memberEqStatus });
  const selectMember = vi.fn().mockReturnValue({ eq: memberEqUser });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-underdog-001" } },
        error: null,
      }),
    },
    rpc: vi.fn().mockImplementation((name: string) => {
      if (name === "get_user_underdog_multiplier") {
        return Promise.resolve({ data: multiplier, error: null });
      }
      if (name === "get_top_users_monthly_leaderboard") {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === "get_top_clubs_monthly_leaderboard") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "club_members") {
        return { select: selectMember };
      }
      if (table === "underdog_bounties") {
        return { select: selectBounty };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/services/gamificationLeaderboardService", () => ({
  getTopUsersMonthlyLeaderboard: vi.fn().mockResolvedValue([]),
  getTopClubsMonthlyLeaderboard: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/underdogLeaderboardService", () => ({
  computeUnderdogClubLeaderboard: vi.fn().mockReturnValue([]),
  getMockUnderdogClubData: vi.fn().mockReturnValue([]),
}));

// ---------------------------------------------------------------------------
// Lazy import (after mocks are registered)
// ---------------------------------------------------------------------------
let GamificationLeaderboard: typeof import("./leaderboard").default;
let createClientMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  const supabaseModule = await import("@/lib/supabase/client");
  createClientMock = vi.fn();
  (supabaseModule as any).createClient = createClientMock;

  const mod = await import("./leaderboard");
  GamificationLeaderboard = mod.default;
});

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------
function renderLeaderboard() {
  return render(
    <BrowserRouter>
      <GamificationLeaderboard />
    </BrowserRouter>,
  );
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("UnderdogCatchUpPanel – boosted user with active bounty", () => {
  beforeEach(() => {
    const mockSupabase = buildMockSupabase({ multiplier: 2.0, bountyRow: MOCK_ACTIVE_BOUNTY });
    createClientMock.mockReturnValue(mockSupabase);
  });

  it("renders the leaderboard container without crash", async () => {
    renderLeaderboard();
    expect(screen.getByTestId("leaderboard-container")).toBeInTheDocument();
  });

  it("displays the Underdog Catch-Up Panel when Clubs tab is active", async () => {
    renderLeaderboard();

    // Switch to clubs tab to trigger the panel
    const clubsTab = screen.getByRole("button", { name: /Top Clubs/i });
    clubsTab.click();

    await waitFor(() => {
      expect(screen.getByTestId("underdog-catchup-panel")).toBeInTheDocument();
    });
  });

  it("renders the multiplier badge with the correct value", async () => {
    renderLeaderboard();

    const clubsTab = screen.getByRole("button", { name: /Top Clubs/i });
    clubsTab.click();

    await waitFor(() => {
      const badge = screen.getByTestId("multiplier-badge");
      expect(badge).toHaveTextContent("2× Points");
    });
  });

  it("renders the active bounty section with progress bar", async () => {
    renderLeaderboard();

    const clubsTab = screen.getByRole("button", { name: /Top Clubs/i });
    clubsTab.click();

    await waitFor(() => {
      expect(screen.getByTestId("active-bounty-section")).toBeInTheDocument();
      expect(screen.getByTestId("progress-label")).toHaveTextContent("6 / 10 guest check-ins");
      expect(screen.getByTestId("progress-pct")).toHaveTextContent("60%");
    });
  });

  it("renders the progress bar fill at correct percentage", async () => {
    renderLeaderboard();

    const clubsTab = screen.getByRole("button", { name: /Top Clubs/i });
    clubsTab.click();

    await waitFor(() => {
      const fill = screen.getByTestId("progress-bar-fill");
      expect(fill).toHaveStyle({ width: "60%" });
    });
  });

  it("renders the reward preview with correct points amount", async () => {
    renderLeaderboard();

    const clubsTab = screen.getByRole("button", { name: /Top Clubs/i });
    clubsTab.click();

    await waitFor(() => {
      const reward = screen.getByTestId("reward-preview");
      expect(reward).toHaveTextContent("+200 pts");
    });
  });

  it("renders the bounty expiry timer", async () => {
    renderLeaderboard();

    const clubsTab = screen.getByRole("button", { name: /Top Clubs/i });
    clubsTab.click();

    await waitFor(() => {
      const expiry = screen.getByTestId("bounty-expiry");
      expect(expiry).toHaveTextContent(/remaining/i);
    });
  });
});

describe("UnderdogCatchUpPanel – boosted user with NO active bounty", () => {
  beforeEach(() => {
    const mockSupabase = buildMockSupabase({ multiplier: 1.5, bountyRow: null });
    createClientMock.mockReturnValue(mockSupabase);
  });

  it("renders the no-bounty placeholder when bounty is null", async () => {
    renderLeaderboard();

    const clubsTab = screen.getByRole("button", { name: /Top Clubs/i });
    clubsTab.click();

    await waitFor(() => {
      expect(screen.getByTestId("no-bounty-section")).toBeInTheDocument();
      expect(screen.getByText(/Check back tomorrow/i)).toBeInTheDocument();
    });
  });
});

describe("UnderdogCatchUpPanel – top-ranked user (no boost)", () => {
  beforeEach(() => {
    const mockSupabase = buildMockSupabase({ multiplier: 1.0, bountyRow: null, memberRows: [] });
    createClientMock.mockReturnValue(mockSupabase);
  });

  it("does NOT render the Underdog Catch-Up Panel for top-ranked users", async () => {
    renderLeaderboard();

    const clubsTab = screen.getByRole("button", { name: /Top Clubs/i });
    clubsTab.click();

    // Allow effects to settle
    await new Promise((r) => setTimeout(r, 100));

    expect(screen.queryByTestId("underdog-catchup-panel")).not.toBeInTheDocument();
  });
});

describe("UnderdogCatchUpPanel – panel hidden on Students tab", () => {
  beforeEach(() => {
    const mockSupabase = buildMockSupabase({ multiplier: 2.0, bountyRow: MOCK_ACTIVE_BOUNTY });
    createClientMock.mockReturnValue(mockSupabase);
  });

  it("hides the panel when the Students tab is active", async () => {
    renderLeaderboard();

    // Default active tab is "students", so panel should not be visible
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByTestId("underdog-catchup-panel")).not.toBeInTheDocument();
  });
});
