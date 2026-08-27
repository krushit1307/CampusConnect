import React, { useState, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Clock,
  Calendar,
  Target,
  Sparkles,
  Zap,
  Shield,
  CheckCircle2,
  X,
  Check,
  Download,
  RefreshCw,
  Info,
  ChevronDown,
  BarChart3,
  PiggyBank,
  Gift,
  ArrowUpRight,
  Eye,
  Filter,
  Search,
} from "lucide-react";

import { SuggestionCard, OptimizerStats } from "../../components/surplus/SurplusOptimizer";
import CommunityInvestmentCard from "../../components/surplus/CommunityInvestmentCard";
import {
  FundingRequestCard,
  BulkActionsBar,
  RequestSummaryPanel,
} from "../../components/surplus/FundingRequestGenerator";
import { useSurplusAllocator } from "../../hooks/useSurplusAllocator";
import type {
  ClubBudget,
  DepreciatingAsset,
  CommunityInvestment,
  InvestmentCategory,
} from "../../types/surplus";

// ─── Toast System ────────────────────────────────────────────────────────

interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => (
  <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-sm animate-slide-in ${
          t.type === "success"
            ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
            : t.type === "error"
              ? "bg-red-950/90 border-red-700 text-red-200"
              : t.type === "warning"
                ? "bg-amber-950/90 border-amber-700 text-amber-200"
                : "bg-slate-800/90 border-slate-600 text-slate-200"
        }`}
      >
        {t.type === "success" && <Check className="w-4 h-4 flex-shrink-0" />}
        {t.type === "error" && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
        {t.type === "warning" && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
        {t.type === "info" && <Info className="w-4 h-4 flex-shrink-0" />}
        <span className="text-sm font-medium flex-1">{t.message}</span>
        <button
          onClick={() => onDismiss(t.id)}
          className="text-slate-400 hover:text-white flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
);

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// ─── Mock Data ───────────────────────────────────────────────────────────

const MOCK_BUDGET: ClubBudget = {
  clubId: "club-tech-2026",
  clubName: "Tech Innovation Club",
  fiscalYearStart: new Date("2025-09-01"),
  fiscalYearEnd: new Date("2026-05-01"),
  totalBudget: 8000,
  spent: 5920,
  remaining: 2080,
  surplusThreshold: 500,
  lastAuditDate: new Date(Date.now() - 86400000 * 14),
  treasurerName: "Alex Kim",
};

const MOCK_ASSETS: DepreciatingAsset[] = [
  {
    id: "a1",
    clubId: "club-tech-2026",
    name: "Canon EOS R6 Camera",
    category: "Photography",
    purchaseDate: new Date("2022-03-15"),
    purchasePrice: 2500,
    currentValue: 800,
    condition: "fair",
    expectedLifespanYears: 5,
    replacementCost: 2800,
    depreciationRate: 0.2,
    lastMaintenanceDate: new Date(Date.now() - 86400000 * 90),
    notes: "Used for event photography. Lens mount showing wear.",
  },
  {
    id: "a2",
    clubId: "club-tech-2026",
    name: "Epson PowerLite Projector",
    category: "Presentation",
    purchaseDate: new Date("2021-09-01"),
    purchasePrice: 1200,
    currentValue: 250,
    condition: "poor",
    expectedLifespanYears: 4,
    replacementCost: 1500,
    depreciationRate: 0.25,
    lastMaintenanceDate: new Date(Date.now() - 86400000 * 180),
    notes: "Dimming significantly. Color accuracy issues. Needs lamp replacement.",
  },
  {
    id: "a3",
    clubId: "club-tech-2026",
    name: "JBL PartyBox Speaker System",
    category: "Audio",
    purchaseDate: new Date("2023-01-20"),
    purchasePrice: 800,
    currentValue: 450,
    condition: "good",
    expectedLifespanYears: 6,
    replacementCost: 900,
    depreciationRate: 0.15,
    notes: "Working well. Minor scratch on housing.",
  },
  {
    id: "a4",
    clubId: "club-tech-2026",
    name: 'Dell 27" Monitor (x3)',
    category: "Computing",
    purchaseDate: new Date("2020-08-15"),
    purchasePrice: 1800,
    currentValue: 300,
    condition: "poor",
    expectedLifespanYears: 5,
    replacementCost: 2100,
    depreciationRate: 0.22,
    notes: "Two of three monitors have dead pixels. One has backlight bleed.",
  },
];

const MOCK_COMMUNITY: CommunityInvestment[] = [
  {
    id: "c1",
    organizationName: "Campus Food Bank",
    cause: "Student food insecurity and nutrition support",
    suggestedAmount: 300,
    gamificationPoints: 600,
    impactDescription:
      "Provides meals for approximately 15 students for one week. Demonstrates club's commitment to campus welfare and community service.",
    taxDeductible: true,
    verified: true,
    tags: ["Food Security", "Community Service", "High Impact"],
  },
  {
    id: "c2",
    organizationName: "STEM Outreach Program",
    cause: "Bringing STEM education to underrepresented K-12 students",
    suggestedAmount: 250,
    gamificationPoints: 500,
    impactDescription:
      "Funds a 2-hour coding workshop for 30 local high school students. Includes materials, snacks, and volunteer coordination.",
    taxDeductible: true,
    verified: true,
    tags: ["Education", "STEM", "Outreach"],
  },
  {
    id: "c3",
    organizationName: "Campus Sustainability Fund",
    cause: "Green campus initiatives and carbon offset programs",
    suggestedAmount: 200,
    gamificationPoints: 400,
    impactDescription:
      "Plants 20 trees on campus and funds reusable water bottle stations. Contributes to university sustainability goals.",
    taxDeductible: false,
    verified: true,
    tags: ["Environment", "Sustainability", "Green Campus"],
  },
];

// ─── Main Component ──────────────────────────────────────────────────────

export default function BudgetSurplusHub() {
  // ─── State ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"optimizer" | "community" | "requests">("optimizer");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<InvestmentCategory | "all">("all");

  // ─── Hook ──────────────────────────────────────────────────────────────
  const {
    deadline,
    analysis,
    suggestions,
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
  } = useSurplusAllocator(MOCK_BUDGET, MOCK_ASSETS, MOCK_COMMUNITY);

  // ─── Toast Helpers ─────────────────────────────────────────────────────
  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ─── Filtered Suggestions ──────────────────────────────────────────────
  const filteredSuggestions = useMemo(() => {
    if (categoryFilter === "all") return suggestions;
    return suggestions.filter((s) => s.category === categoryFilter);
  }, [suggestions, categoryFilter]);

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleCreateRequest = useCallback(
    (suggestionId: string) => {
      const allSuggestions = [...suggestions];
      const suggestion = allSuggestions.find((s) => s.id === suggestionId);
      if (suggestion) {
        createFundingRequest(suggestion);
        addToast("success", `Funding request created for "${suggestion.title}"`);
      }
    },
    [suggestions, createFundingRequest, addToast],
  );

  const handleBulkCreate = useCallback(() => {
    const requests = createBulkFundingRequests();
    addToast(
      "success",
      `Generated ${requests.length} funding request${requests.length !== 1 ? "s" : ""}`,
    );
  }, [createBulkFundingRequests, addToast]);

  const handleSubmitRequest = useCallback(
    (requestId: string) => {
      submitFundingRequest(requestId);
      addToast("success", "Funding request submitted for review");
    },
    [submitFundingRequest, addToast],
  );

  // ─── Deadline Warning Banner ───────────────────────────────────────────
  const showDeadlineWarning = deadline.alertTriggered;
  const deadlineBannerConfig = {
    safe: { bg: "bg-emerald-950/50", border: "border-emerald-800", text: "text-emerald-200" },
    caution: { bg: "bg-yellow-950/50", border: "border-yellow-800", text: "text-yellow-200" },
    warning: { bg: "bg-orange-950/50", border: "border-orange-800", text: "text-orange-200" },
    critical: { bg: "bg-red-950/50", border: "border-red-800", text: "text-red-200" },
  };
  const bannerCfg = deadlineBannerConfig[deadline.warningLevel];

  // ─── Tab Definitions ───────────────────────────────────────────────────
  const tabs = [
    {
      id: "optimizer" as const,
      label: "Surplus Optimizer",
      icon: <Zap className="w-4 h-4" />,
      count: suggestions.length,
    },
    {
      id: "community" as const,
      label: "Community Investments",
      icon: <Gift className="w-4 h-4" />,
      count: MOCK_COMMUNITY.length,
    },
    {
      id: "requests" as const,
      label: "Funding Requests",
      icon: <FileText className="w-4 h-4" />,
      count: fundingRequests.length,
    },
  ];

  // ─── Categories for filter ─────────────────────────────────────────────
  const categories: (InvestmentCategory | "all")[] = [
    "all",
    "asset-replacement",
    "community-donation",
    "skill-development",
    "infrastructure",
    "emergency-fund",
  ];

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* ── Header ── */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <PiggyBank className="w-4 h-4" />
                Dynamic Budget Surplus Re-Allocator
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
                Smart Surplus Optimizer
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Prevent "use it or lose it" panic spending. Algorithmically suggested investments
                replace wasteful purchases with high-impact, long-term club improvements and
                community contributions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={refreshSuggestions}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Analysis
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Deadline Warning Banner ── */}
      {showDeadlineWarning && (
        <div className={`${bannerCfg.bg} border-b ${bannerCfg.border}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className={`w-6 h-6 flex-shrink-0 ${
                  deadline.warningLevel === "critical"
                    ? "text-red-400 animate-pulse"
                    : "text-amber-400"
                }`}
              />
              <div>
                <h3 className={`text-sm font-bold ${bannerCfg.text}`}>
                  {deadline.warningLevel === "critical"
                    ? "🚨 CRITICAL: Budget Reclamation Imminent!"
                    : deadline.warningLevel === "warning"
                      ? "⚠️ Warning: Fiscal Deadline Approaching"
                      : "📅 Notice: Fiscal Year Ending Soon"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {deadline.daysRemaining} days remaining · $
                  {MOCK_BUDGET.remaining.toLocaleString()} unspent of $
                  {MOCK_BUDGET.totalBudget.toLocaleString()} budget · Reclaim threshold: $
                  {MOCK_BUDGET.surplusThreshold.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Overview ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <OptimizerStats
          totalSurplus={analysis.totalSurplus}
          totalSelectedCost={totalSelectedCost}
          selectedCount={selectedSuggestions.size}
          totalCount={suggestions.length}
          riskLevel={analysis.riskLevel}
          daysUntilDeadline={deadline.daysRemaining}
        />
      </div>

      {/* ── Tab Navigation ── */}
      <div className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? "bg-violet-500 text-white"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* ════════ SURPLUS OPTIMIZER TAB ════════ */}
        {activeTab === "optimizer" && (
          <>
            {/* Bulk Actions */}
            <BulkActionsBar
              selectedCount={selectedSuggestions.size}
              totalSelectedCost={totalSelectedCost}
              surplus={analysis.totalSurplus}
              onGenerateAll={handleBulkCreate}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              totalCount={suggestions.length}
            />

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const isActive = categoryFilter === cat;
                const label =
                  cat === "all"
                    ? "All Categories"
                    : cat
                        .split("-")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ");
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-colors ${
                      isActive
                        ? "bg-violet-600 border-violet-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Suggestion Cards */}
            <div className="space-y-3">
              {filteredSuggestions.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No suggestions match this category</p>
                </div>
              )}
              {filteredSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  isSelected={selectedSuggestions.has(suggestion.id)}
                  onToggle={() => toggleSuggestion(suggestion.id)}
                  onCreateRequest={() => handleCreateRequest(suggestion.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* ════════ COMMUNITY INVESTMENTS TAB ════════ */}
        {activeTab === "community" && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-emerald-950/50 border border-emerald-800 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <Gift className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-200">
                    Community Investment Opportunities
                  </h3>
                  <p className="text-xs text-emerald-300/70">
                    Invest surplus in community causes to earn gamification points, strengthen your
                    club's reputation, and make a positive impact on campus. All verified
                    organizations are eligible for tax deductions.
                  </p>
                </div>
              </div>
            </div>

            {/* Community Cards */}
            <div className="space-y-3">
              {MOCK_COMMUNITY.map((investment) => (
                <CommunityInvestmentCard
                  key={investment.id}
                  investment={investment}
                  isSelected={selectedSuggestions.has(investment.id)}
                  onToggle={() => toggleSuggestion(investment.id)}
                  onCreateRequest={() => {
                    createFundingRequest({
                      id: generateId(),
                      category: "community-donation",
                      title: `Donate to ${investment.organizationName}`,
                      description: investment.impactDescription,
                      estimatedCost: investment.suggestedAmount,
                      impactScore: 85,
                      urgency: "medium",
                      roi: `+${investment.gamificationPoints} gamification points`,
                      longTermBenefit: investment.impactDescription,
                      tags: investment.tags,
                      approved: false,
                      executed: false,
                    });
                    addToast(
                      "success",
                      `Donation request created for ${investment.organizationName}`,
                    );
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ════════ FUNDING REQUESTS TAB ════════ */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {/* Summary Panel */}
            {fundingRequests.length > 0 && <RequestSummaryPanel requests={fundingRequests} />}

            {/* Request Cards */}
            <div className="space-y-3">
              {fundingRequests.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No funding requests yet</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Go to the Surplus Optimizer or Community Investments tab to generate requests
                  </p>
                </div>
              )}
              {fundingRequests.map((request) => (
                <FundingRequestCard
                  key={request.id}
                  request={request}
                  onSubmit={handleSubmitRequest}
                  onDelete={(id) => {
                    addToast("info", "Funding request deleted");
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
