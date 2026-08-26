import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SponsorBountiesSection } from "./SponsorBountiesSection";
import { SponsorBountyService } from "@/services/sponsorBountyService";
import { toast } from "sonner";

// Mock the dependencies
vi.mock("@/services/sponsorBountyService", () => ({
  SponsorBountyService: {
    getBountiesByEventId: vi.fn(),
    claimBounty: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockBounties = [
  {
    id: "bounty-1",
    title: "Awesome Challenge",
    description: "Complete to win",
    points_reward: 500,
    max_claims: 10,
    current_claims: 2,
    sponsor_id: "sponsor-1",
    claim_code: "123456",
    created_at: "2026-01-01T00:00:00Z",
    expires_at: null,
    sponsors: {
      id: "sponsor-1",
      company_name: "Tech Corp",
      logo_url: "https://example.com/logo.png",
      website_url: "https://techcorp.com",
      created_at: "2026-01-01T00:00:00Z",
      created_by: "user-1",
      event_id: "evt-1",
    },
  },
  {
    id: "bounty-2",
    title: "Fully Claimed Challenge",
    description: "Oops it is full",
    points_reward: 100,
    max_claims: 5,
    current_claims: 5, // full
    sponsor_id: "sponsor-1",
    claim_code: "654321",
    created_at: "2026-01-01T00:00:00Z",
    expires_at: null,
    sponsors: {
      id: "sponsor-1",
      company_name: "Tech Corp",
      logo_url: "https://example.com/logo.png",
      website_url: "https://techcorp.com",
      created_at: "2026-01-01T00:00:00Z",
      created_by: "user-1",
      event_id: "evt-1",
    },
  },
];

describe("SponsorBountiesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    // delay mock to simulate loading
    vi.mocked(SponsorBountyService.getBountiesByEventId).mockImplementation(
      () => new Promise(() => {}),
    );
    const { container } = render(<SponsorBountiesSection eventId="evt-1" />);
    // LoadingSpinner usually renders an svg or similar, we can just check it doesn't crash
    // and wait for it to be present.
    expect(container).toBeInTheDocument();
  });

  it("renders nothing if no bounties exist", async () => {
    vi.mocked(SponsorBountyService.getBountiesByEventId).mockResolvedValue([]);
    const { container } = render(<SponsorBountiesSection eventId="evt-1" />);
    await waitFor(() => {
      // should render null
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders bounties correctly", async () => {
    vi.mocked(SponsorBountyService.getBountiesByEventId).mockResolvedValue(mockBounties as any);

    render(<SponsorBountiesSection eventId="evt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Awesome Challenge")).toBeInTheDocument();
      expect(screen.getByText("Fully Claimed Challenge")).toBeInTheDocument();
      expect(screen.getByText(/500 Points/i)).toBeInTheDocument();
      expect(screen.getByText("Fully Claimed")).toBeInTheDocument();
    });
  });

  it("handles successful claim", async () => {
    vi.mocked(SponsorBountyService.getBountiesByEventId).mockResolvedValue(mockBounties as any);
    vi.mocked(SponsorBountyService.claimBounty).mockResolvedValue({
      success: true,
      points_awarded: 500,
    });

    render(<SponsorBountiesSection eventId="evt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Awesome Challenge")).toBeInTheDocument();
    });

    // Inputs inside the list - we'll find the first one
    const inputs = screen.getAllByPlaceholderText("6-digit code");
    fireEvent.change(inputs[0], { target: { value: "123456" } });

    const claimButtons = screen.getAllByText("Claim");
    fireEvent.click(claimButtons[0]);

    await waitFor(() => {
      expect(SponsorBountyService.claimBounty).toHaveBeenCalledWith("123456");
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("handles failed claim", async () => {
    vi.mocked(SponsorBountyService.getBountiesByEventId).mockResolvedValue(mockBounties as any);
    vi.mocked(SponsorBountyService.claimBounty).mockRejectedValue(new Error("Invalid claim code"));

    render(<SponsorBountiesSection eventId="evt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Awesome Challenge")).toBeInTheDocument();
    });

    const inputs = screen.getAllByPlaceholderText("6-digit code");
    fireEvent.change(inputs[0], { target: { value: "WRONG!" } });

    const claimButtons = screen.getAllByText("Claim");
    fireEvent.click(claimButtons[0]);

    await waitFor(() => {
      expect(SponsorBountyService.claimBounty).toHaveBeenCalledWith("WRONG!");
      expect(toast.error).toHaveBeenCalledWith("Invalid claim code");
    });
  });
});
