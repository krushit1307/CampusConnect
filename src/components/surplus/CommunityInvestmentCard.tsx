import React from "react";
import {
  Gift,
  Heart,
  Star,
  CheckCircle2,
  Shield,
  Sparkles,
  ArrowUpRight,
  Users,
  Award,
} from "lucide-react";
import type { CommunityInvestment } from "../../types/surplus";

// ─── Community Investment Card ───────────────────────────────────────────

interface CommunityInvestmentCardProps {
  investment: CommunityInvestment;
  isSelected: boolean;
  onToggle: () => void;
  onCreateRequest: () => void;
}

const CommunityInvestmentCard: React.FC<CommunityInvestmentCardProps> = ({
  investment,
  isSelected,
  onToggle,
  onCreateRequest,
}) => {
  return (
    <div
      className={`bg-slate-900 border rounded-2xl p-5 transition-all cursor-pointer ${
        isSelected
          ? "border-emerald-600/50 ring-1 ring-emerald-600/20"
          : "border-slate-800 hover:border-slate-700"
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        <div
          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
            isSelected
              ? "bg-emerald-600 border-emerald-500"
              : "border-slate-600 hover:border-slate-500"
          }`}
        >
          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
        </div>

        <div className="flex-1">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">{investment.organizationName}</h3>
                {investment.verified && (
                  <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" /> Verified
                  </span>
                )}
                {investment.taxDeductible && (
                  <span className="text-[9px] text-blue-400 font-bold">Tax Deductible</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{investment.cause}</p>
            </div>

            {/* Amount + Points */}
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-black font-mono text-emerald-400">
                ${investment.suggestedAmount.toLocaleString()}
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span className="text-xs font-bold text-amber-400">
                  +{investment.gamificationPoints.toLocaleString()} pts
                </span>
              </div>
            </div>
          </div>

          {/* Impact */}
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            {investment.impactDescription}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {investment.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 bg-emerald-900/30 border border-emerald-800/50 rounded-full text-emerald-400"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Action */}
          <div className="flex justify-end mt-3 pt-2 border-t border-slate-800/50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateRequest();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-colors"
            >
              <Gift className="w-3 h-3" />
              Generate Donation Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityInvestmentCard;
