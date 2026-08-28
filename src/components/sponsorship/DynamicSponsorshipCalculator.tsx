// =============================================================================
// File: src/components/sponsorship/DynamicSponsorshipCalculator.tsx
// Issue: #3951 - Develop a 'Dynamic "Sponsorship Value" Calculator'
// Description: Interactive data-driven sponsorship valuation dashboard,
//              custom perk toggles, algorithmic pricing recommendations,
//              and pitch deck proposal generator.
// =============================================================================

import React, { useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  Award,
  Sparkles,
  Users,
  Eye,
  Sliders,
  CheckCircle2,
  Copy,
  Download,
  Building,
  Briefcase,
  Layers,
  HelpCircle,
  Save,
  Check,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  ClubHistoricalReach,
  ValuationModelParams,
  SuggestedTierPricing,
  TierPerk,
} from "@/types/sponsorshipCalculator";
import {
  getDefaultValuationParams,
  getMockClubHistoricalReach,
  calculateDynamicSponsorshipTiers,
  generateValuationReport,
  exportSponsorshipProposalText,
  saveClubSponsorshipTiers,
} from "@/services/sponsorshipCalculatorService";

interface DynamicSponsorshipCalculatorProps {
  clubId?: string;
  clubName?: string;
  initialReach?: ClubHistoricalReach;
}

export const DynamicSponsorshipCalculator: React.FC<DynamicSponsorshipCalculatorProps> = ({
  clubId = "club-demo-1",
  clubName = "ACM Student Chapter & Developer Guild",
  initialReach,
}) => {
  const [reach, setReach] = useState<ClubHistoricalReach>(
    initialReach || getMockClubHistoricalReach(clubId)
  );

  const [params, setParams] = useState<ValuationModelParams>(getDefaultValuationParams());
  const [customOverrides, setCustomOverrides] = useState<Record<string, number>>({});
  const [customPerks, setCustomPerks] = useState<Record<string, TierPerk[]>>({});
  const [copiedProposal, setCopiedProposal] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("tiers");

  // Dynamic calculated tiers
  const tiers: SuggestedTierPricing[] = useMemo(() => {
    const baseTiers = calculateDynamicSponsorshipTiers(reach, params);
    return baseTiers.map((tier) => {
      const activePerks = customPerks[tier.tierLevel] || tier.perks;
      const customPrice = customOverrides[tier.tierLevel];

      // Recompute price if perks were toggled
      const perkSum = activePerks.filter((p) => p.isIncluded).reduce((s, p) => s + p.baseFairMarketValue, 0);
      const perkAdjustment = perkSum - tier.perkValuationTotal;
      const adjustedPrice = Math.max(100, tier.recommendedPrice + perkAdjustment);

      return {
        ...tier,
        perks: activePerks,
        recommendedPrice: adjustedPrice,
        customPriceOverride: customPrice,
      };
    });
  }, [reach, params, customOverrides, customPerks]);

  // Overall potential revenue sum
  const totalProjectedRevenue = useMemo(() => {
    return tiers.reduce((sum, t) => sum + (t.customPriceOverride || t.recommendedPrice), 0);
  }, [tiers]);

  // Toggle perk inside a tier
  const handleTogglePerk = (tierLevel: string, perkId: string) => {
    const currentTier = tiers.find((t) => t.tierLevel === tierLevel);
    if (!currentTier) return;

    const updatedPerks = currentTier.perks.map((p) =>
      p.id === perkId ? { ...p, isIncluded: !p.isIncluded } : p
    );

    setCustomPerks((prev) => ({
      ...prev,
      [tierLevel]: updatedPerks,
    }));
  };

  // Handle manual price override
  const handlePriceOverride = (tierLevel: string, val: string) => {
    const num = parseInt(val, 10);
    setCustomOverrides((prev) => ({
      ...prev,
      [tierLevel]: isNaN(num) ? 0 : num,
    }));
  };

  // Generate copyable proposal report
  const proposalReport = useMemo(() => {
    return generateValuationReport(clubId, clubName, reach, params);
  }, [clubId, clubName, reach, params]);

  const proposalMarkdown = useMemo(() => {
    return exportSponsorshipProposalText(proposalReport);
  }, [proposalReport]);

  const handleCopyProposal = () => {
    navigator.clipboard.writeText(proposalMarkdown);
    setCopiedProposal(true);
    setTimeout(() => setCopiedProposal(false), 2500);
  };

  const handleSaveTiers = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    const res = await saveClubSponsorshipTiers(clubId, tiers);
    setIsSaving(false);
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Station */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-lime dark:bg-lime-400">
                <Sparkles className="h-5 w-5 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Dynamic Sponsorship Value Engine
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Algorithmic Fair-Market Pricing & Talent Acquisition ROI Calculator • {clubName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProposalModalOpen(true)}
              className="neu-border flex items-center gap-1.5 bg-zinc-100 font-mono text-xs font-bold uppercase text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white"
            >
              <FileSpreadsheetIcon className="h-3.5 w-3.5" />
              View Pitch Deck
            </Button>

            <Button
              size="sm"
              onClick={handleSaveTiers}
              disabled={isSaving}
              className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-800" /> Published!
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" /> {isSaving ? "Saving..." : "Save Tiers"}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Reach Metric Highlights */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Active Member Pool
            </span>
            <div className="mt-1 font-mono text-lg font-black text-zinc-900 dark:text-white">
              {reach.totalActiveMembers} Students
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              <Users className="h-3 w-3" /> {(reach.majorDistribution.stem * 100).toFixed(0)}% STEM Majors
            </div>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Avg Event Attendance
            </span>
            <div className="mt-1 font-mono text-lg font-black text-blue-600 dark:text-blue-400">
              {reach.avgActualAttendance} / event
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              <CheckCircle2 className="h-3 w-3" /> {reach.avgEventRsvps} RSVPs avg
            </div>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Annual Digital Impressions
            </span>
            <div className="mt-1 font-mono text-lg font-black text-purple-600 dark:text-purple-400">
              {(reach.totalAnnualImpressions / 1000).toFixed(1)}k Views
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              <Eye className="h-3 w-3" /> {reach.newsletterSubscriberCount} Newsletter Subs
            </div>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Sponsor Retention
            </span>
            <div className="mt-1 font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">
              {(reach.repeatSponsorRate * 100).toFixed(0)}% Repeat
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              <Award className="h-3 w-3" /> {reach.historicalSponsorCount} Past Partners
            </div>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Projected Revenue Pool
            </span>
            <div className="mt-1 font-mono text-lg font-black text-amber-600 dark:text-amber-400">
              ${totalProjectedRevenue.toLocaleString()}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              <Zap className="h-3 w-3 text-amber-500" /> Full Package Sum
            </div>
          </div>
        </div>
      </div>

      {/* Model Parameter Customizer Station */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-4 w-4 text-black dark:text-lime" />
          <h3 className="font-mono text-sm font-black uppercase text-zinc-900 dark:text-white">
            Valuation Parameters & Market Drivers
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* Industry Type Selector */}
          <div>
            <label className="block font-mono text-[11px] font-bold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
              Target Sponsor Industry
            </label>
            <select
              aria-label="Target Sponsor Industry"
              value={params.industryType}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  industryType: e.target.value as ValuationModelParams["industryType"],
                }))
              }
              className="neu-border w-full bg-white p-2 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
            >
              <option value="tech_software">Software & Tech (1.20x)</option>
              <option value="finance_consulting">Quantitative Finance & Consulting (1.35x)</option>
              <option value="consumer_retail">Consumer & Retail Brands (0.95x)</option>
              <option value="non_profit">Non-Profit / Research (0.75x)</option>
            </select>
          </div>

          {/* Expected Event Attendance Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-mono text-[11px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
                Avg Event Attendance
              </label>
              <span className="font-mono text-xs font-bold text-blue-600">
                {reach.avgActualAttendance} attendees
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="1500"
              step="25"
              value={reach.avgActualAttendance}
              onChange={(e) =>
                setReach((r) => ({
                  ...r,
                  avgActualAttendance: parseInt(e.target.value, 10),
                }))
              }
              className="w-full cursor-pointer accent-black dark:accent-lime"
            />
          </div>

          {/* Digital Impressions Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-mono text-[11px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
                Annual Digital Reach
              </label>
              <span className="font-mono text-xs font-bold text-purple-600">
                {(reach.totalAnnualImpressions / 1000).toFixed(0)}k views
              </span>
            </div>
            <input
              type="range"
              min="5000"
              max="200000"
              step="5000"
              value={reach.totalAnnualImpressions}
              onChange={(e) =>
                setReach((r) => ({
                  ...r,
                  totalAnnualImpressions: parseInt(e.target.value, 10),
                }))
              }
              className="w-full cursor-pointer accent-black dark:accent-lime"
            />
          </div>

          {/* Seasonal Multiplier Toggle */}
          <div>
            <label className="block font-mono text-[11px] font-bold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
              Recruiting Season Surge
            </label>
            <button
              type="button"
              onClick={() =>
                setParams((p) => ({
                  ...p,
                  peakRecruitingSeasonMultiplier: p.peakRecruitingSeasonMultiplier > 1 ? 1.0 : 1.25,
                }))
              }
              className={`neu-border w-full py-2 px-3 font-mono text-xs font-bold uppercase transition-colors ${
                params.peakRecruitingSeasonMultiplier > 1
                  ? "bg-amber-100 text-amber-900 border-amber-500 dark:bg-amber-950 dark:text-amber-200"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {params.peakRecruitingSeasonMultiplier > 1
                ? "🔥 Active Surge (1.25x)"
                : "Standard Season (1.0x)"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Tier Valuation Cards */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="neu-border grid w-full max-w-md grid-cols-2 bg-white p-1 dark:bg-zinc-900">
          <TabsTrigger
            value="tiers"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Tier Pricing & Perks
          </TabsTrigger>
          <TabsTrigger
            value="matrix"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Sponsor ROI Matrix
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tier Pricing Cards */}
        <TabsContent value="tiers" className="mt-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => {
              const displayPrice = tier.customPriceOverride || tier.recommendedPrice;
              const isOverridden =
                tier.customPriceOverride !== undefined &&
                tier.customPriceOverride !== tier.recommendedPrice;

              return (
                <div
                  key={tier.tierLevel}
                  className="neu-border flex flex-col justify-between bg-white p-5 dark:bg-zinc-900"
                >
                  <div>
                    {/* Tier Level Header */}
                    <div className="flex items-center justify-between border-b-2 border-black pb-2 dark:border-zinc-700">
                      <span className="font-mono text-xs font-black uppercase text-zinc-900 dark:text-white">
                        {tier.tierName}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-black uppercase ${
                          tier.tierLevel === "platinum"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            : tier.tierLevel === "gold"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : tier.tierLevel === "silver"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {tier.tierLevel}
                      </span>
                    </div>

                    {/* Algorithmic Price Recommendation */}
                    <div className="my-4">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-3xl font-black text-zinc-900 dark:text-white">
                          ${displayPrice.toLocaleString()}
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-500">/ package</span>
                      </div>

                      {/* Confidence Band Pill */}
                      <div className="mt-1 flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="h-3 w-3" />
                        <span>
                          AI Recommended: ${tier.recommendedPrice.toLocaleString()} (${tier.confidenceLowerBound} - ${tier.confidenceUpperBound})
                        </span>
                      </div>

                      {/* Manual Override Input */}
                      <div className="mt-3">
                        <label className="block font-mono text-[10px] font-bold uppercase text-zinc-500 mb-1">
                          Custom Price Override ($)
                        </label>
                        <input
                          type="number"
                          value={tier.customPriceOverride ?? tier.recommendedPrice}
                          onChange={(e) => handlePriceOverride(tier.tierLevel, e.target.value)}
                          className="neu-border w-full bg-zinc-50 p-1.5 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Sponsor ROI Snapshot */}
                    <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/60 mb-4">
                      <span className="block font-mono text-[10px] font-bold uppercase text-zinc-500 mb-1">
                        Sponsor Acquisition ROI
                      </span>
                      <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                        <div>
                          <span className="text-zinc-500">Cost/Interaction:</span>
                          <p className="font-bold text-zinc-900 dark:text-white">
                            ${tier.estimatedSponsorROI.costPerInteraction}
                          </p>
                        </div>
                        <div>
                          <span className="text-zinc-500">Est. Reach:</span>
                          <p className="font-bold text-zinc-900 dark:text-white">
                            {tier.estimatedSponsorROI.estimatedImpressions.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Included Perks Checklist */}
                    <div>
                      <span className="block font-mono text-[10px] font-bold uppercase text-zinc-500 mb-2">
                        Deliverable Perks ({tier.perks.filter((p) => p.isIncluded).length})
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {tier.perks.map((perk) => (
                          <label
                            key={perk.id}
                            className={`flex items-start gap-2 rounded p-1.5 cursor-pointer text-[11px] font-mono transition-colors ${
                              perk.isIncluded
                                ? "bg-lime/20 text-zinc-900 dark:bg-lime/10 dark:text-zinc-100"
                                : "text-zinc-400 hover:text-zinc-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={perk.isIncluded}
                              onChange={() => handleTogglePerk(tier.tierLevel, perk.id)}
                              className="mt-0.5 rounded accent-black"
                            />
                            <div className="leading-tight">
                              <p className="font-bold">{perk.name}</p>
                              <span className="text-[9px] text-zinc-500">
                                +${perk.baseFairMarketValue} FMV
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 2: Sponsor ROI Matrix */}
        <TabsContent value="matrix" className="mt-4">
          <div className="neu-border overflow-hidden bg-white dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b-2 border-black bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <tr>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Tier</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Price</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Direct Candidates</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Digital Impressions</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Cost per Lead</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Key Perks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {tiers.map((tier) => (
                    <tr key={tier.tierLevel} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                      <td className="p-3 font-bold text-zinc-900 dark:text-white">{tier.tierName}</td>
                      <td className="p-3 font-black text-emerald-600">
                        ${(tier.customPriceOverride || tier.recommendedPrice).toLocaleString()}
                      </td>
                      <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">
                        ~{tier.estimatedSponsorROI.estimatedDirectInteractions} students
                      </td>
                      <td className="p-3 text-zinc-700 dark:text-zinc-300">
                        {tier.estimatedSponsorROI.estimatedImpressions.toLocaleString()} views
                      </td>
                      <td className="p-3 font-bold text-blue-600 dark:text-blue-400">
                        ${tier.estimatedSponsorROI.costPerQualifiedLead} / lead
                      </td>
                      <td className="p-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                        {tier.perks
                          .filter((p) => p.isIncluded)
                          .map((p) => p.name)
                          .slice(0, 3)
                          .join(", ")}
                        {tier.perks.filter((p) => p.isIncluded).length > 3 ? "..." : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Pitch Deck Generator Dialog */}
      <Dialog open={isProposalModalOpen} onOpenChange={setIsProposalModalOpen}>
        <DialogContent className="neu-border max-w-3xl bg-white p-6 dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-xl font-black uppercase text-zinc-900 dark:text-white">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                Corporate Partnership Pitch Deck
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyProposal}
                className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold text-black"
              >
                {copiedProposal ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy Pitch Deck
                  </>
                )}
              </Button>
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
              Ready-to-send corporate sponsor proposal with audience metrics and transparent tier valuations.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <pre className="neu-border max-h-96 overflow-y-auto bg-zinc-900 p-4 font-mono text-xs text-zinc-100 whitespace-pre-wrap">
              {proposalMarkdown}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function FileSpreadsheetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M8 13h2" />
      <path d="M14 13h2" />
      <path d="M8 17h2" />
      <path d="M14 17h2" />
    </svg>
  );
}

export default DynamicSponsorshipCalculator;
