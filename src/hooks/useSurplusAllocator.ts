import { useState, useMemo, useCallback } from "react";
import type {
  ClubBudget,
  DepreciatingAsset,
  InvestmentSuggestion,
  CommunityInvestment,
  FundingRequest,
  FiscalDeadline,
  SurplusAnalysis,
  InvestmentCategory,
  UrgencyLevel,
} from "../types/surplus";

// ─── Helpers ─────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

function calculateDepreciation(purchaseDate: Date, purchasePrice: number, rate: number): number {
  const years = (Date.now() - purchaseDate.getTime()) / (365.25 * 86400000);
  const depreciated = purchasePrice * Math.pow(1 - rate, years);
  return Math.max(0, Math.round(depreciated));
}

function calculateAssetScore(asset: DepreciatingAsset): number {
  const ageYears = (Date.now() - asset.purchaseDate.getTime()) / (365.25 * 86400000);
  const ageScore = Math.min(100, (ageYears / asset.expectedLifespanYears) * 100);
  const conditionScore =
    asset.condition === "critical"
      ? 100
      : asset.condition === "poor"
        ? 75
        : asset.condition === "fair"
          ? 50
          : asset.condition === "good"
            ? 25
            : 10;
  const valueScore = 100 - (asset.currentValue / asset.purchasePrice) * 100;

  return Math.round(ageScore * 0.4 + conditionScore * 0.35 + valueScore * 0.25);
}

function getUrgencyLevel(daysRemaining: number, surplusPct: number): UrgencyLevel {
  if (daysRemaining <= 7 || surplusPct > 50) return "critical";
  if (daysRemaining <= 14 || surplusPct > 30) return "high";
  if (daysRemaining <= 30 || surplusPct > 15) return "medium";
  return "low";
}

function getWarningLevel(
  daysRemaining: number,
  balance: number,
  threshold: number,
): FiscalDeadline["warningLevel"] {
  if (daysRemaining <= 7 && balance > threshold) return "critical";
  if (daysRemaining <= 14 && balance > threshold) return "warning";
  if (daysRemaining <= 30 && balance > threshold * 0.8) return "caution";
  return "safe";
}

// ─── Suggestion Generator ────────────────────────────────────────────────

function generateSuggestions(
  assets: DepreciatingAsset[],
  surplus: number,
  daysRemaining: number,
): InvestmentSuggestion[] {
  const suggestions: InvestmentSuggestion[] = [];

  // 1. Asset replacement suggestions for depreciating assets
  assets.forEach((asset) => {
    const score = calculateAssetScore(asset);
    if (score >= 50 || asset.condition === "poor" || asset.condition === "critical") {
      const urgency = getUrgencyLevel(daysRemaining, score);
      suggestions.push({
        id: generateId(),
        category: "asset-replacement",
        title: `Replace ${asset.name}`,
        description: `Your ${asset.name} is ${asset.condition} condition (${Math.round(score)}% replacement urgency). Purchased ${asset.purchaseDate.toLocaleDateString()}, originally $${asset.purchasePrice.toLocaleString()}. Current value: $${asset.currentValue.toLocaleString()}.`,
        estimatedCost: asset.replacementCost,
        impactScore: Math.round(score * 0.8),
        urgency,
        roi: `Prevents ~$${Math.round(asset.replacementCost * 0.15).toLocaleString()}/year in repair costs`,
        longTermBenefit: `New ${asset.name} expected to last ${asset.expectedLifespanYears} years with warranty coverage`,
        relatedAssetId: asset.id,
        tags: [
          "Asset Replacement",
          asset.category,
          `Age: ${Math.round((Date.now() - asset.purchaseDate.getTime()) / (365.25 * 86400000))}yr`,
        ],
        approved: false,
        executed: false,
      });
    }
  });

  // 2. Community investment suggestions
  if (surplus >= 200) {
    const communityAmount = Math.min(surplus * 0.15, 500);
    suggestions.push({
      id: generateId(),
      category: "community-donation",
      title: "Donate to Campus Food Bank",
      description: `Allocate $${communityAmount.toLocaleString()} to the Campus Food Bank. Earns ${Math.round(communityAmount * 2)} gamification points and demonstrates community commitment.`,
      estimatedCost: communityAmount,
      impactScore: 85,
      urgency: getUrgencyLevel(daysRemaining, 20),
      roi: `${Math.round(communityAmount * 2)} community gamification points`,
      longTermBenefit: "Strengthens club reputation, eligible for Community Impact Award",
      tags: ["Community", "Gamification", "Tax Deductible"],
      approved: false,
      executed: false,
    });
  }

  // 3. Skill development investments
  if (surplus >= 500) {
    const skillAmount = Math.min(surplus * 0.2, 800);
    suggestions.push({
      id: generateId(),
      category: "skill-development",
      title: "Workshop & Training Budget",
      description: `Fund ${Math.ceil(skillAmount / 50)} professional development workshops for members. Includes industry certifications, skill-building sessions, and guest speakers.`,
      estimatedCost: skillAmount,
      impactScore: 78,
      urgency: getUrgencyLevel(daysRemaining, 15),
      roi: `${Math.ceil(skillAmount / 50)} workshops × ~${Math.ceil(skillAmount / 50) * 8} member-hours of training`,
      longTermBenefit: "Improved member skills, higher retention, better project outcomes",
      tags: ["Training", "Members", "Professional Development"],
      approved: false,
      executed: false,
    });
  }

  // 4. Infrastructure upgrades
  if (surplus >= 1000) {
    const infraAmount = Math.min(surplus * 0.25, 1200);
    suggestions.push({
      id: generateId(),
      category: "infrastructure",
      title: "Club Infrastructure Upgrade",
      description: `Upgrade meeting space equipment: display monitors, collaboration tools, or storage solutions. Improves productivity for all future meetings.`,
      estimatedCost: infraAmount,
      impactScore: 72,
      urgency: getUrgencyLevel(daysRemaining, 10),
      roi: `~${Math.round(infraAmount * 0.3).toLocaleString()}/year saved on external venue costs`,
      longTermBenefit: "Lasting infrastructure improvement, reduced operational costs",
      tags: ["Infrastructure", "Long-term", "Productivity"],
      approved: false,
      executed: false,
    });
  }

  // 5. Emergency fund
  if (surplus >= 300) {
    const emergencyAmount = Math.min(surplus * 0.1, 300);
    suggestions.push({
      id: generateId(),
      category: "emergency-fund",
      title: "Establish Emergency Reserve",
      description: `Set aside $${emergencyAmount.toLocaleString()} as an emergency fund for unexpected operational costs next fiscal year.`,
      estimatedCost: emergencyAmount,
      impactScore: 65,
      urgency: getUrgencyLevel(daysRemaining, 8),
      roi: "Financial safety net for unexpected expenses",
      longTermBenefit: "Club financial resilience, reduced risk of budget crises",
      tags: ["Emergency", "Reserve", "Financial Health"],
      approved: false,
      executed: false,
    });
  }

  // Sort by urgency then impact
  const urgencyOrder: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  suggestions.sort((a, b) => {
    const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (uDiff !== 0) return uDiff;
    return b.impactScore - a.impactScore;
  });

  return suggestions;
}

// ─── Main Hook ───────────────────────────────────────────────────────────

export function useSurplusAllocator(
  budget: ClubBudget,
  assets: DepreciatingAsset[],
  communityInvestments: CommunityInvestment[],
) {
  const [suggestions, setSuggestions] = useState<InvestmentSuggestion[]>([]);
  const [fundingRequests, setFundingRequests] = useState<FundingRequest[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  // Fiscal deadline
  const deadline = useMemo<FiscalDeadline>(() => {
    const daysRemaining = daysBetween(new Date(), budget.fiscalYearEnd);
    return {
      id: generateId(),
      clubId: budget.clubId,
      deadlineDate: budget.fiscalYearEnd,
      daysRemaining,
      reclaimThreshold: budget.surplusThreshold,
      currentBalance: budget.remaining,
      alertTriggered: daysRemaining <= 60 && budget.remaining > budget.surplusThreshold,
      warningLevel: getWarningLevel(daysRemaining, budget.remaining, budget.surplusThreshold),
    };
  }, [budget]);

  // Surplus analysis
  const analysis = useMemo<SurplusAnalysis>(() => {
    const surplus = Math.max(0, budget.remaining - budget.surplusThreshold);
    const surplusPct = budget.totalBudget > 0 ? (surplus / budget.totalBudget) * 100 : 0;
    const generatedSuggestions = generateSuggestions(assets, surplus, deadline.daysRemaining);
    const totalSuggested = generatedSuggestions.reduce((sum, s) => sum + s.estimatedCost, 0);

    let riskLevel: SurplusAnalysis["riskLevel"] = "low";
    if (deadline.daysRemaining <= 7 && surplus > 0) riskLevel = "critical";
    else if (deadline.daysRemaining <= 14 && surplus > 0) riskLevel = "high";
    else if (deadline.daysRemaining <= 30 && surplus > 0) riskLevel = "medium";

    return {
      totalSurplus: surplus,
      surplusPercentage: surplusPct,
      daysUntilDeadline: deadline.daysRemaining,
      recommendedTotalAllocation: surplus,
      suggestions: generatedSuggestions,
      communityInvestments,
      totalSuggestedCost: totalSuggested,
      riskLevel,
    };
  }, [budget, assets, communityInvestments, deadline]);

  // Generate suggestions on first load
  const refreshSuggestions = useCallback(() => {
    const surplus = Math.max(0, budget.remaining - budget.surplusThreshold);
    const generated = generateSuggestions(assets, surplus, deadline.daysRemaining);
    setSuggestions(generated);
  }, [budget, assets, deadline]);

  // Toggle suggestion selection
  const toggleSuggestion = useCallback((id: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select all / deselect all
  const selectAll = useCallback(() => {
    setSelectedSuggestions(new Set(analysis.suggestions.map((s) => s.id)));
  }, [analysis.suggestions]);

  const deselectAll = useCallback(() => {
    setSelectedSuggestions(new Set());
  }, []);

  // Create funding request from suggestion
  const createFundingRequest = useCallback(
    (suggestion: InvestmentSuggestion) => {
      const request: FundingRequest = {
        id: generateId(),
        clubId: budget.clubId,
        title: suggestion.title,
        description: suggestion.description,
        amount: suggestion.estimatedCost,
        category: suggestion.category,
        justification: `${suggestion.roi}\n\nLong-term benefit: ${suggestion.longTermBenefit}`,
        supportingDocuments: [],
        status: "draft",
        submittedBy: budget.treasurerName,
        submittedAt: new Date(),
        relatedSuggestionId: suggestion.id,
      };
      setFundingRequests((prev) => [...prev, request]);
      return request;
    },
    [budget],
  );

  // Bulk create funding requests for selected suggestions
  const createBulkFundingRequests = useCallback(() => {
    const allSuggestions = [...analysis.suggestions, ...suggestions];
    const selected = allSuggestions.filter((s) => selectedSuggestions.has(s.id));
    const newRequests = selected.map((s) => ({
      id: generateId(),
      clubId: budget.clubId,
      title: s.title,
      description: s.description,
      amount: s.estimatedCost,
      category: s.category,
      justification: `${s.roi}\n\nLong-term benefit: ${s.longTermBenefit}`,
      supportingDocuments: [],
      status: "pending" as const,
      submittedBy: budget.treasurerName,
      submittedAt: new Date(),
      relatedSuggestionId: s.id,
    }));
    setFundingRequests((prev) => [...prev, ...newRequests]);
    setSelectedSuggestions(new Set());
    return newRequests;
  }, [analysis.suggestions, suggestions, selectedSuggestions, budget]);

  // Submit a funding request
  const submitFundingRequest = useCallback((requestId: string) => {
    setFundingRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: "pending" as const, submittedAt: new Date() } : r,
      ),
    );
  }, []);

  // Get total selected cost
  const totalSelectedCost = useMemo(() => {
    const allSuggestions = [...analysis.suggestions, ...suggestions];
    return allSuggestions
      .filter((s) => selectedSuggestions.has(s.id))
      .reduce((sum, s) => sum + s.estimatedCost, 0);
  }, [analysis.suggestions, suggestions, selectedSuggestions]);

  return {
    deadline,
    analysis,
    suggestions: suggestions.length > 0 ? suggestions : analysis.suggestions,
    fundingRequests,
    selectedSuggestions,
    totalSelectedCost,
    refreshSuggestions,
    toggleSuggestion,
    selectAll,
    deselectAll,
    createFundingRequest,
    createBulkFundingRequests,
    submitFundingRequest,
  };
}
