import { describe, it, expect } from "vitest";
import {
  calculateCostPerImpression,
  buildSponsorRoiDashboardData,
  SponsoredEventSummary,
} from "./sponsorRoiAnalytics";

describe("Dynamic Sponsor ROI Analytics Dashboard Suite (#3668)", () => {
  const sampleEvents: SponsoredEventSummary[] = [
    {
      eventId: "e_hackathon",
      eventTitle: "Annual Campus Hackathon",
      sponsorshipAmount: 1000.0,
      eventImpressions: 5000,
      assets: [
        {
          id: "a1",
          assetName: "Swag Bag Promo Code",
          assetType: "swag_link",
          impressions: 1000,
          clicks: 150,
        },
      ],
      attendeeDemographics: {
        "Computer Science": 70,
        "Electrical Engineering": 30,
      },
    },
  ];

  it("calculates Cost-Per-Impression (CPI) accurately", () => {
    // $1,000 / 5,000 impressions = $0.20 per impression
    const cpi = calculateCostPerImpression(1000, 5000);
    expect(cpi).toBe(0.2);

    expect(calculateCostPerImpression(1000, 0)).toBe(0.0);
  });

  it("aggregates engagement metrics and anonymized attendee demographics for corporate dashboard", () => {
    const dashboard = buildSponsorRoiDashboardData("sp_techcorp", "TechCorp Inc.", sampleEvents);

    expect(dashboard.totalInvestment).toBe(1000.0);
    expect(dashboard.totalImpressions).toBe(5000);
    expect(dashboard.totalSwagClicks).toBe(150);
    expect(dashboard.swagClickThroughRate).toBe(15.0); // 150 / 1000 = 15%
    expect(dashboard.costPerImpression).toBe(0.2);

    // Demographics check (70% CS, 30% EE)
    expect(dashboard.demographicBreakdown[0].major).toBe("Computer Science");
    expect(dashboard.demographicBreakdown[0].percentage).toBe(70.0);
  });
});
