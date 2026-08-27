import React, { useState } from "react";
import {
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  BarChart3,
  Shield,
  Gift,
  Wrench,
  GraduationCap,
  Building2,
  PiggyBank,
  Check,
  X,
  Info,
} from "lucide-react";
import type { InvestmentSuggestion, InvestmentCategory, UrgencyLevel } from "../../types/surplus";

// ─── Constants ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  InvestmentCategory,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  "asset-replacement": {
    label: "Asset Replacement",
    icon: <Wrench className="w-4 h-4" />,
    color: "text-blue-400",
    bg: "bg-blue-900/50",
  },
  "community-donation": {
    label: "Community Donation",
    icon: <Gift className="w-4 h-4" />,
    color: "text-emerald-400",
    bg: "bg-emerald-900/50",
  },
  "skill-development": {
    label: "Skill Development",
    icon: <GraduationCap className="w-4 h-4" />,
    color: "text-violet-400",
    bg: "bg-violet-900/50",
  },
  infrastructure: {
    label: "Infrastructure",
    icon: <Building2 className="w-4 h-4" />,
    color: "text-amber-400",
    bg: "bg-amber-900/50",
  },
  "event-equipment": {
    label: "Event Equipment",
    icon: <Target className="w-4 h-4" />,
    color: "text-pink-400",
    bg: "bg-pink-900/50",
  },
  "emergency-fund": {
    label: "Emergency Fund",
    icon: <Shield className="w-4 h-4" />,
    color: "text-cyan-400",
    bg: "bg-cyan-900/50",
  },
};

const URGENCY_CONFIG: Record<
  UrgencyLevel,
  { label: string; color: string; bg: string; border: string }
> = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    bg: "bg-red-900/50",
    border: "border-red-800",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-900/50",
    border: "border-orange-800",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    bg: "bg-yellow-900/50",
    border: "border-yellow-800",
  },
  low: { label: "Low", color: "text-slate-400", bg: "bg-slate-800/50", border: "border-slate-700" },
};

// ─── Suggestion Card ─────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: InvestmentSuggestion;
  isSelected: boolean;
  onToggle: () => void;
  onCreateRequest: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  isSelected,
  onToggle,
  onCreateRequest,
}) => {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_CONFIG[suggestion.category];
  const urg = URGENCY_CONFIG[suggestion.urgency];

  return (
    <div
      className={`bg-slate-900 border rounded-2xl p-5 transition-all cursor-pointer ${
        isSelected
          ? "border-violet-600/50 ring-1 ring-violet-600/20"
          : suggestion.urgency === "critical"
            ? "border-red-800/50 hover:border-red-700"
            : "border-slate-800 hover:border-slate-700"
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        <div
          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
            isSelected
              ? "bg-violet-600 border-violet-500"
              : "border-slate-600 hover:border-slate-500"
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.bg} ${cat.color} ${cat.border}`}
                >
                  {cat.icon}
                  {cat.label}
                </span>
                <span
                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${urg.bg} ${urg.color} ${urg.border}`}
                >
                  <Zap className="w-2.5 h-2.5" />
                  {urg.label}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-2">{suggestion.title}</h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{suggestion.description}</p>
            </div>

            {/* Cost */}
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-black font-mono text-emerald-400">
                ${suggestion.estimatedCost.toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-500 uppercase font-bold">estimated</div>
            </div>
          </div>

          {/* Impact Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 font-bold">Impact Score</span>
              <span className="text-[10px] font-mono text-slate-400">
                {suggestion.impactScore}/100
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  suggestion.impactScore >= 80
                    ? "bg-emerald-500"
                    : suggestion.impactScore >= 60
                      ? "bg-yellow-500"
                      : "bg-orange-500"
                }`}
                style={{ width: `${suggestion.impactScore}%` }}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {suggestion.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Expanded Details */}
          {expanded && (
            <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    ROI
                  </span>
                  <p className="text-xs text-slate-300 mt-1">{suggestion.roi}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Long-term Benefit
                  </span>
                  <p className="text-xs text-slate-300 mt-1">{suggestion.longTermBenefit}</p>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Row */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5 transition-colors"
            >
              {expanded ? (
                <>
                  Less <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  Details <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateRequest();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold rounded-lg transition-colors"
            >
              <ArrowUpRight className="w-3 h-3" />
              Generate Funding Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Summary Stats ───────────────────────────────────────────────────────

interface OptimizerStatsProps {
  totalSurplus: number;
  totalSelectedCost: number;
  selectedCount: number;
  totalCount: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  daysUntilDeadline: number;
}

const OptimizerStats: React.FC<OptimizerStatsProps> = ({
  totalSurplus,
  totalSelectedCost,
  selectedCount,
  totalCount,
  riskLevel,
  daysUntilDeadline,
}) => {
  const riskConfig = {
    low: {
      label: "Low Risk",
      color: "text-emerald-400",
      bg: "bg-emerald-900/50",
      border: "border-emerald-800",
    },
    medium: {
      label: "Medium Risk",
      color: "text-yellow-400",
      bg: "bg-yellow-900/50",
      border: "border-yellow-800",
    },
    high: {
      label: "High Risk",
      color: "text-orange-400",
      bg: "bg-orange-900/50",
      border: "border-orange-800",
    },
    critical: {
      label: "Critical",
      color: "text-red-400",
      bg: "bg-red-900/50",
      border: "border-red-800",
    },
  };
  const risk = riskConfig[riskLevel];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <DollarSign className="w-5 h-5 text-emerald-400 mb-1" />
        <div className="text-lg font-black font-mono text-emerald-400">
          ${totalSurplus.toLocaleString()}
        </div>
        <div className="text-[10px] text-slate-500 uppercase font-bold">Surplus Available</div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <Target className="w-5 h-5 text-violet-400 mb-1" />
        <div className="text-lg font-black font-mono text-violet-400">
          ${totalSelectedCost.toLocaleString()}
        </div>
        <div className="text-[10px] text-slate-500 uppercase font-bold">
          {selectedCount}/{totalCount} Selected
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <Clock className="w-5 h-5 text-amber-400 mb-1" />
        <div
          className={`text-lg font-black font-mono ${daysUntilDeadline <= 14 ? "text-red-400" : daysUntilDeadline <= 30 ? "text-amber-400" : "text-slate-300"}`}
        >
          {daysUntilDeadline}d
        </div>
        <div className="text-[10px] text-slate-500 uppercase font-bold">Until Deadline</div>
      </div>

      <div className={`border rounded-xl p-4 ${risk.bg} ${risk.border}`}>
        <AlertTriangle className={`w-5 h-5 mb-1 ${risk.color}`} />
        <div className={`text-lg font-black ${risk.color}`}>{risk.label}</div>
        <div className="text-[10px] text-slate-500 uppercase font-bold">Risk Level</div>
      </div>
    </div>
  );
};

export { SuggestionCard, OptimizerStats, CATEGORY_CONFIG, URGENCY_CONFIG };
