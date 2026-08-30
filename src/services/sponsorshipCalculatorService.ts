// =============================================================================
// File: src/services/sponsorshipCalculatorService.ts
// Issue: #3951 - Develop a 'Dynamic "Sponsorship Value" Calculator'
// Description: Algorithmic pricing models, CPM/CPV calculations, perk catalogs,
//              and pitch deck proposal generator for student organizations.
// =============================================================================

import { supabase } from "@/lib/supabase/client";
import type {
  ClubHistoricalReach,
  ValuationModelParams,
  TierPerk,
  SuggestedTierPricing,
  SponsorshipTierLevel,
  SponsorshipValuationReport,
} from "@/types/sponsorshipCalculator";

/**
 * Standard catalog of sponsorship perks with fair-market baseline valuations.
 */
export const STANDARD_PERKS_CATALOG: TierPerk[] = [
  {
    id: "perk-logo-web",
    name: "Logo on Event Website & Portal",
    description: "Prominent company logo on all digital RSVP pages and club website.",
    category: "digital",
    baseFairMarketValue: 150,
    isIncluded: true,
    reachMultiplier: 1.0,
  },
  {
    id: "perk-logo-tshirt",
    name: "Logo on Official Event T-Shirts / Merch",
    description: "Printed sponsor logo on attendee and volunteer shirts (1-year walking impression life).",
    category: "branding",
    baseFairMarketValue: 350,
    isIncluded: false,
    reachMultiplier: 1.4,
  },
  {
    id: "perk-booth-priority",
    name: "Prime Career Fair / Hackathon Booth Space",
    description: "6ft table with high-traffic lobby placement, power strip, and fast Wi-Fi.",
    category: "recruitment",
    baseFairMarketValue: 500,
    isIncluded: false,
    reachMultiplier: 1.6,
  },
  {
    id: "perk-resume-book",
    name: "Opt-In Opt-Out Student Resume Book Access",
    description: "Searchable database of attendee resumes, GitHub handles, and LinkedIn profiles.",
    category: "recruitment",
    baseFairMarketValue: 650,
    isIncluded: false,
    reachMultiplier: 1.8,
  },
  {
    id: "perk-keynote-slot",
    name: "10-Minute Opening Keynote or Tech Talk",
    description: "Direct speaking slot to all attendees before hackathon kickoff or workshop.",
    category: "speaking",
    baseFairMarketValue: 800,
    isIncluded: false,
    reachMultiplier: 2.2,
  },
  {
    id: "perk-dedicated-email",
    name: "Dedicated Newsletter / Email Blast",
    description: "Solo sponsor spotlight email sent to all active club subscribers (no competing ads).",
    category: "digital",
    baseFairMarketValue: 300,
    isIncluded: false,
    reachMultiplier: 1.3,
  },
  {
    id: "perk-mentor-access",
    name: "Company Mentors / Judges Placement",
    description: "Dedicated mentor stations for company engineers/recruiters to judge projects.",
    category: "vip",
    baseFairMarketValue: 400,
    isIncluded: false,
    reachMultiplier: 1.5,
  },
  {
    id: "perk-custom-challenge",
    name: "Sponsored API / Track Bounty Challenge",
    description: "Company-branded contest prize track with direct developer adoption of company APIs.",
    category: "vip",
    baseFairMarketValue: 750,
    isIncluded: false,
    reachMultiplier: 2.0,
  },
];

/**
 * Returns default valuation parameters for calculation algorithms.
 */
export function getDefaultValuationParams(): ValuationModelParams {
  return {
    costPerAttendee: 1.75, // $1.75 per direct venue attendee
    costPerImpressionMille: 28.0, // $28.00 CPM (industry average for tech talent)
    costPerNewsletterClick: 3.5, // $3.50 per high-intent subscriber lead
    stemDemographicPremium: 1.3, // 30% premium for high-demand STEM talent
    peakRecruitingSeasonMultiplier: 1.25, // 25% surge during peak fall/spring hiring
    industryType: "tech_software",
  };
}

/**
 * Default mock historical reach metrics for a campus club.
 */
export function getMockClubHistoricalReach(clubId: string = "club-demo-1"): ClubHistoricalReach {
  return {
    clubId,
    totalActiveMembers: 320,
    avgEventRsvps: 450,
    avgActualAttendance: 380,
    totalAnnualImpressions: 48000,
    newsletterSubscriberCount: 1250,
    avgEmailOpenRate: 0.44, // 44% open rate
    socialFollowerCount: 2600,
    majorDistribution: {
      stem: 0.72,
      business: 0.18,
      artsAndHumanities: 0.1,
    },
    historicalSponsorCount: 6,
    repeatSponsorRate: 0.67,
  };
}

/**
 * Core Algorithmic Pricing Engine: Computes fair market value recommendations
 * for Bronze, Silver, Gold, Platinum, and Title Sponsorship tiers.
 */
export function calculateDynamicSponsorshipTiers(
  reach: ClubHistoricalReach,
  params: ValuationModelParams = getDefaultValuationParams()
): SuggestedTierPricing[] {
  const industryMultiplier =
    params.industryType === "tech_software"
      ? 1.2
      : params.industryType === "finance_consulting"
      ? 1.35
      : params.industryType === "consumer_retail"
      ? 0.95
      : 0.75;

  const demographicMultiplier =
    1.0 + (reach.majorDistribution.stem * (params.stemDemographicPremium - 1.0));

  const totalMultiplier =
    industryMultiplier * demographicMultiplier * params.peakRecruitingSeasonMultiplier;

  // Base reach valuations
  const annualAttendance = reach.avgActualAttendance * 4; // 4 events/year average
  const baseAttendanceValue = annualAttendance * params.costPerAttendee;
  const baseImpressionValue = (reach.totalAnnualImpressions / 1000) * params.costPerImpressionMille;
  const baseDigitalValue =
    reach.newsletterSubscriberCount * reach.avgEmailOpenRate * params.costPerNewsletterClick * 6;

  // Tier 1: Bronze (Entry branding)
  const bronzePerks = STANDARD_PERKS_CATALOG.map((p) => ({
    ...p,
    isIncluded: p.id === "perk-logo-web" || p.id === "perk-dedicated-email",
  }));
  const bronzePerkSum = bronzePerks.filter((p) => p.isIncluded).reduce((s, p) => s + p.baseFairMarketValue, 0);
  const bronzeRaw = (baseAttendanceValue * 0.15 + baseImpressionValue * 0.2 + bronzePerkSum) * totalMultiplier;
  const bronzePrice = Math.round(bronzeRaw / 50) * 50;

  // Tier 2: Silver (Career engagement)
  const silverPerks = STANDARD_PERKS_CATALOG.map((p) => ({
    ...p,
    isIncluded:
      p.id === "perk-logo-web" ||
      p.id === "perk-logo-tshirt" ||
      p.id === "perk-booth-priority" ||
      p.id === "perk-dedicated-email",
  }));
  const silverPerkSum = silverPerks.filter((p) => p.isIncluded).reduce((s, p) => s + p.baseFairMarketValue, 0);
  const silverRaw = (baseAttendanceValue * 0.4 + baseImpressionValue * 0.45 + silverPerkSum) * totalMultiplier;
  const silverPrice = Math.round(silverRaw / 50) * 50;

  // Tier 3: Gold (Full recruiting access)
  const goldPerks = STANDARD_PERKS_CATALOG.map((p) => ({
    ...p,
    isIncluded:
      p.id === "perk-logo-web" ||
      p.id === "perk-logo-tshirt" ||
      p.id === "perk-booth-priority" ||
      p.id === "perk-resume-book" ||
      p.id === "perk-mentor-access" ||
      p.id === "perk-dedicated-email",
  }));
  const goldPerkSum = goldPerks.filter((p) => p.isIncluded).reduce((s, p) => s + p.baseFairMarketValue, 0);
  const goldRaw = (baseAttendanceValue * 0.75 + baseImpressionValue * 0.75 + baseDigitalValue * 0.5 + goldPerkSum) * totalMultiplier;
  const goldPrice = Math.round(goldRaw / 50) * 50;

  // Tier 4: Platinum (Keynote + Primary Branding)
  const platinumPerks = STANDARD_PERKS_CATALOG.map((p) => ({
    ...p,
    isIncluded: true,
  }));
  const platinumPerkSum = platinumPerks.reduce((s, p) => s + p.baseFairMarketValue, 0);
  const platinumRaw = (baseAttendanceValue * 1.0 + baseImpressionValue * 1.0 + baseDigitalValue * 0.9 + platinumPerkSum) * totalMultiplier;
  const platinumPrice = Math.round(platinumRaw / 50) * 50;

  const createTierPricing = (
    tierLevel: SponsorshipTierLevel,
    tierName: string,
    price: number,
    perks: TierPerk[],
    weight: number
  ): SuggestedTierPricing => {
    const margin = Math.round(price * 0.12);
    const perkSum = perks.filter((p) => p.isIncluded).reduce((s, p) => s + p.baseFairMarketValue, 0);
    const estimatedInteractions = Math.round(reach.avgActualAttendance * weight * 1.2);
    const estimatedImpressions = Math.round(reach.totalAnnualImpressions * weight * 0.8);

    return {
      tierLevel,
      tierName,
      recommendedPrice: price,
      confidenceLowerBound: Math.max(100, price - margin),
      confidenceUpperBound: price + margin,
      perkValuationTotal: perkSum,
      attendanceValuation: Math.round(baseAttendanceValue * weight * totalMultiplier),
      impressionValuation: Math.round(baseImpressionValue * weight * totalMultiplier),
      recruitmentLeadValuation: Math.round(baseDigitalValue * weight * totalMultiplier),
      perks,
      estimatedSponsorROI: {
        estimatedImpressions,
        estimatedDirectInteractions: estimatedInteractions,
        costPerInteraction: Number((price / Math.max(1, estimatedInteractions)).toFixed(2)),
        costPerQualifiedLead: Number((price / Math.max(1, reach.totalActiveMembers * weight * 0.6)).toFixed(2)),
      },
    };
  };

  return [
    createTierPricing("bronze", "Bronze Supporter Tier", bronzePrice, bronzePerks, 0.25),
    createTierPricing("silver", "Silver Partner Tier", silverPrice, silverPerks, 0.5),
    createTierPricing("gold", "Gold Premier Tier", goldPrice, goldPerks, 0.8),
    createTierPricing("platinum", "Platinum Title Sponsor", platinumPrice, platinumPerks, 1.0),
  ];
}

/**
 * Generate full comprehensive valuation report.
 */
export function generateValuationReport(
  clubId: string,
  clubName: string,
  reach: ClubHistoricalReach,
  params: ValuationModelParams
): SponsorshipValuationReport {
  const suggestedTiers = calculateDynamicSponsorshipTiers(reach, params);
  const totalPotentialRevenue = suggestedTiers.reduce((sum, t) => sum + (t.customPriceOverride || t.recommendedPrice), 0);

  return {
    clubId,
    clubName,
    generatedAt: new Date().toISOString(),
    historicalMetrics: reach,
    valuationParameters: params,
    suggestedTiers,
    totalPotentialRevenue,
    recommendedPackageName: `${clubName} 2026-2027 Corporate Partnership Package`,
  };
}

/**
 * Export customized sponsorship proposal deck as Markdown / Text format.
 */
export function exportSponsorshipProposalText(report: SponsorshipValuationReport): string {
  const lines = [
    `# CORPORATE SPONSORSHIP & PARTNERSHIP PROPOSAL`,
    `**Organization**: ${report.clubName}`,
    `**Date Generated**: ${new Date(report.generatedAt).toLocaleDateString()}`,
    `**Audience**: ${report.historicalMetrics.totalActiveMembers} Active Members • ${report.historicalMetrics.avgActualAttendance} Average Event Attendance • ${report.historicalMetrics.totalAnnualImpressions.toLocaleString()} Annual Impressions`,
    `\n---\n`,
    `## SPONSORSHIP TIERS & DATA-DRIVEN FAIR MARKET PRICING\n`,
  ];

  report.suggestedTiers.forEach((tier) => {
    const finalPrice = tier.customPriceOverride || tier.recommendedPrice;
    lines.push(`### ${tier.tierName} - $${finalPrice.toLocaleString()} USD`);
    lines.push(`- **Estimated Reach**: ${tier.estimatedSponsorROI.estimatedImpressions.toLocaleString()} impressions`);
    lines.push(`- **Direct Student Interactions**: ~${tier.estimatedSponsorROI.estimatedDirectInteractions} candidates`);
    lines.push(`- **Cost per Direct Interaction**: $${tier.estimatedSponsorROI.costPerInteraction.toFixed(2)}`);
    lines.push(`- **Included Package Perks**:`);
    tier.perks
      .filter((p) => p.isIncluded)
      .forEach((p) => {
        lines.push(`  - [x] ${p.name} (${p.description})`);
      });
    lines.push(`\n`);
  });

  lines.push(`---\n*Pricing algorithmically verified by CampusConnect Dynamic Valuation Engine based on historical attendee engagement and industry talent acquisition standards.*`);

  return lines.join("\n");
}

/**
 * Save custom tier pricing override to Supabase.
 */
export async function saveClubSponsorshipTiers(
  clubId: string,
  tiers: SuggestedTierPricing[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = tiers.map((t) => ({
      club_id: clubId,
      tier_level: t.tierLevel,
      tier_name: t.tierName,
      recommended_price: t.recommendedPrice,
      custom_price: t.customPriceOverride || t.recommendedPrice,
      perks_json: t.perks,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("club_sponsorship_tiers")
      .upsert(payload, { onConflict: "club_id,tier_level" });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to persist sponsorship tiers" };
  }
}
