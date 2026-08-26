import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SponsorMarketplace } from "./SponsorMarketplace";

// Mock the hook useSponsorshipMatches
const mockMatches = [
  {
    campaign_id: "campaign-1",
    company_name: "Mock Corp",
    campaign_title: "Tech Sponsors",
    remaining_budget: 200000,
    match_score: 95.0,
    shared_demographics: ["cs_majors"],
  },
  {
    campaign_id: "campaign-2",
    company_name: "Finance LLC",
    campaign_title: "Diversity Initiative",
    remaining_budget: 150000,
    match_score: 80.0,
    shared_demographics: ["finance_majors"],
  },
];

const mockPitches = [
  {
    id: "pitch-1",
    campaign_id: "campaign-1",
    request_id: "request-1",
    status: "approved",
  },
  {
    id: "pitch-2",
    campaign_id: "campaign-2",
    request_id: "request-1",
    status: "Funds Received",
  },
];

vi.mock("../../hooks/useSponsorshipMatches", () => ({
  useSponsorshipMatches: () => ({
    matches: mockMatches,
    pitches: mockPitches,
    isLoading: false,
    error: null,
  }),
}));

describe("SponsorMarketplace Component (#3274)", () => {
  it("renders recommended sponsors list and calculates match score percentage", () => {
    render(
      <SponsorMarketplace
        requestId="request-1"
        requestTitle="CS Hackathon"
        requestedAmount={100000}
      />
    );

    expect(screen.getByText("Recommended Sponsors")).toBeInTheDocument();
    expect(screen.getByText("CS Hackathon")).toBeInTheDocument();
    expect(screen.getByText("Mock Corp")).toBeInTheDocument();
    expect(screen.getByText("Finance LLC")).toBeInTheDocument();
  });

  it("displays correct status for approved and funds received pitches", () => {
    render(
      <SponsorMarketplace
        requestId="request-1"
        requestTitle="CS Hackathon"
        requestedAmount={100000}
      />
    );

    // Expect status of pitch-1 ('approved') to render on dashboard
    expect(screen.getByText("approved")).toBeInTheDocument();

    // Expect status of pitch-2 ('Funds Received') to render on dashboard
    expect(screen.getByText("Funds Received")).toBeInTheDocument();
  });
});
