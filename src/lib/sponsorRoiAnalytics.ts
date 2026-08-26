export interface MarketingAssetMetrics {
  id: string;
  assetName: string;
  assetType: "logo_placement" | "swag_link" | "banner";
  impressions: number;
  clicks: number;
}

export interface SponsoredEventSummary {
  eventId: string;
  eventTitle: string;
  sponsorshipAmount: number;
  eventImpressions: number;
  assets: MarketingAssetMetrics[];
  attendeeDemographics: Record<string, number>; // e.g. { "Computer Science": 70, "Electrical Eng": 30 }
}

export interface SponsorRoiDashboardMetrics {
  sponsorId: string;
  companyName: string;
  totalInvestment: number;
  totalImpressions: number;
  totalSwagClicks: number;
  costPerImpression: number; // CPI = Investment / Total Impressions
  swagClickThroughRate: number; // CTR = (Swag Clicks / Total Swag Impressions) * 100
  demographicBreakdown: Array<{ major: string; percentage: number }>;
}

/**
 * Calculates Cost Per Impression (CPI) accurately.
 */
export function calculateCostPerImpression(investment: number, impressions: number): number {
  if (impressions <= 0 || investment <= 0) return 0.0;
  return Number((investment / impressions).toFixed(4));
}

/**
 * Aggregates multi-event sponsorship metrics into a comprehensive Sponsor ROI payload.
 */
export function buildSponsorRoiDashboardData(
  sponsorId: string,
  companyName: string,
  events: SponsoredEventSummary[],
): SponsorRoiDashboardMetrics {
  let totalInvestment = 0;
  let totalImpressions = 0;
  let totalSwagClicks = 0;
  let totalSwagImpressions = 0;

  const demographicCounts: Record<string, number> = {};
  let totalDemographicSamples = 0;

  for (const evt of events) {
    totalInvestment += evt.sponsorshipAmount;
    totalImpressions += evt.eventImpressions;

    for (const asset of evt.assets) {
      if (asset.assetType === "swag_link") {
        totalSwagClicks += asset.clicks;
        totalSwagImpressions += asset.impressions;
      }
    }

    // Merge anonymized demographic data
    for (const [major, count] of Object.entries(evt.attendeeDemographics)) {
      demographicCounts[major] = (demographicCounts[major] || 0) + count;
      totalDemographicSamples += count;
    }
  }

  const costPerImpression = calculateCostPerImpression(totalInvestment, totalImpressions);

  const swagClickThroughRate =
    totalSwagImpressions > 0
      ? Number(((totalSwagClicks / totalSwagImpressions) * 100).toFixed(2))
      : 0.0;

  // Format demographic percentages
  const demographicBreakdown = Object.entries(demographicCounts)
    .map(([major, count]) => ({
      major,
      percentage:
        totalDemographicSamples > 0
          ? Number(((count / totalDemographicSamples) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return {
    sponsorId,
    companyName,
    totalInvestment: Number(totalInvestment.toFixed(2)),
    totalImpressions,
    totalSwagClicks,
    costPerImpression,
    swagClickThroughRate,
    demographicBreakdown,
  };
}
