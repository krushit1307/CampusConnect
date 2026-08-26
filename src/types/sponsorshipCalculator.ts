// =============================================================================
// File: src/types/sponsorshipCalculator.ts
// Issue: #3951 - Develop a 'Dynamic "Sponsorship Value" Calculator'
// Description: Type definitions for club historical reach metrics, dynamic
//              sponsorship valuation algorithms, tier perks, and ROI modeling.
// =============================================================================

export type SponsorshipTierLevel = "bronze" | "silver" | "gold" | "platinum" | "title_sponsor";

export interface TierPerk {
  id: string;
  name: string;
  description: string;
  category: "branding" | "recruitment" | "speaking" | "digital" | "vip";
  baseFairMarketValue: number; // in USD
  isIncluded: boolean;
  reachMultiplier: number;
}

export interface ClubHistoricalReach {
  clubId: string;
  totalActiveMembers: number;
  avgEventRsvps: number;
  avgActualAttendance: number;
  totalAnnualImpressions: number;
  newsletterSubscriberCount: number;
  avgEmailOpenRate: number; // e.g. 0.42 for 42%
  socialFollowerCount: number;
  majorDistribution: {
    stem: number; // percentage
    business: number;
    artsAndHumanities: number;
  };
  historicalSponsorCount: number;
  repeatSponsorRate: number; // percentage
}

export interface ValuationModelParams {
  costPerAttendee: number; // base rate, default $1.50
  costPerImpressionMille: number; // CPM default $25.00
  costPerNewsletterClick: number; // default $3.00
  stemDemographicPremium: number; // 1.25x for tech/STEM clubs
  peakRecruitingSeasonMultiplier: number; // 1.30x for Fall/Spring Career weeks
  industryType: "tech_software" | "finance_consulting" | "consumer_retail" | "non_profit";
}

export interface SuggestedTierPricing {
  tierLevel: SponsorshipTierLevel;
  tierName: string;
  recommendedPrice: number;
  confidenceLowerBound: number;
  confidenceUpperBound: number;
  perkValuationTotal: number;
  attendanceValuation: number;
  impressionValuation: number;
  recruitmentLeadValuation: number;
  customPriceOverride?: number;
  perks: TierPerk[];
  estimatedSponsorROI: {
    estimatedImpressions: number;
    estimatedDirectInteractions: number;
    costPerInteraction: number;
    costPerQualifiedLead: number;
  };
}

export interface SponsorshipValuationReport {
  clubId: string;
  clubName: string;
  generatedAt: string;
  historicalMetrics: ClubHistoricalReach;
  valuationParameters: ValuationModelParams;
  suggestedTiers: SuggestedTierPricing[];
  totalPotentialRevenue: number;
  recommendedPackageName: string;
}

export interface SponsorshipProposalExportPayload {
  clubName: string;
  contactEmail: string;
  fiscalYear: number;
  tiers: {
    name: string;
    price: number;
    perks: string[];
    audienceReach: string;
  }[];
}
