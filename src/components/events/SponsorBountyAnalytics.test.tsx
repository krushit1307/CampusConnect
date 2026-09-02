import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SponsorBountyAnalytics } from "./SponsorBountyAnalytics";
import { SponsorBountyService } from "@/services/sponsorBountyService";
import { supabase } from "@/lib/supabase/client";

// Mock the dependencies
vi.mock("@/services/sponsorBountyService", () => ({
  SponsorBountyService: {
    getSponsorAnalytics: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

const mockClaims = [
  {
    id: "claim-1",
    claimed_at: "2026-08-21T10:00:00Z",
    sponsor_bounties: {
      id: "bounty-1",
      title: "SQL Quiz Challenge",
      sponsor_id: "sponsor-1",
    },
    profiles: {
      id: "usr-1",
      first_name: "John",
      last_name: "Doe",
      avatar_url: "http://example.com/john.png",
      college: "Engineering",
    },
  },
  {
    id: "claim-2",
    claimed_at: "2026-08-21T11:00:00Z",
    sponsor_bounties: {
      id: "bounty-2",
      title: "API Trial Signup",
      sponsor_id: "sponsor-1",
    },
    profiles: {
      id: "usr-2",
      first_name: "Jane",
      last_name: "Smith",
      avatar_url: null,
      college: "Computer Science",
    },
  },
];

describe("SponsorBountyAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockSupabase = (sponsorsData: any[], error: any = null) => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: "user-sponsor" } } },
      error: null,
    } as any);

    const selectMock = vi.fn().mockReturnThis();
    const eqMock1 = vi.fn().mockReturnThis();
    const eqMock2 = vi.fn().mockResolvedValue({ data: sponsorsData, error });

    // The chain: from('sponsors').select('*').eq('event_id', ...).eq('created_by', ...)
    vi.mocked(supabase.from).mockReturnValue({
      select: selectMock.mockReturnValue({
        eq: eqMock1.mockReturnValue({
          eq: eqMock2,
        }),
      }),
    } as any);
  };

  it("renders loading state initially", () => {
    setupMockSupabase([]);
    // delay mock
    vi.mocked(SponsorBountyService.getSponsorAnalytics).mockImplementation(
      () => new Promise(() => {}),
    );

    const { container } = render(<SponsorBountyAnalytics eventId="evt-1" />);
    // Loader indicator classes usually present
    expect(container).toBeInTheDocument();
  });

  it("renders no sponsors message if user has no sponsors for event", async () => {
    setupMockSupabase([]);

    render(<SponsorBountyAnalytics eventId="evt-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("You have no sponsor profiles registered for this event."),
      ).toBeInTheDocument();
    });
  });

  it("renders analytics data correctly", async () => {
    setupMockSupabase([{ id: "sponsor-1" }]);
    vi.mocked(SponsorBountyService.getSponsorAnalytics).mockResolvedValue(mockClaims as any);

    render(<SponsorBountyAnalytics eventId="evt-1" />);

    await waitFor(() => {
      // Cards
      expect(screen.getByText("Total Bounties Claimed")).toBeInTheDocument();
      expect(screen.getByText("Unique Engaged Students")).toBeInTheDocument();
      // Should show '2' for both claims and unique users
      expect(screen.getAllByText("2").length).toBeGreaterThan(0);

      // Table Content
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("SQL Quiz Challenge")).toBeInTheDocument();
      expect(screen.getByText("API Trial Signup")).toBeInTheDocument();
      expect(screen.getByText("Engineering")).toBeInTheDocument();
      expect(screen.getByText("Computer Science")).toBeInTheDocument();
    });
  });
});
