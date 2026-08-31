/**
 * TrendComparisonCard — Displays a single metric comparison between
 * first-half and second-half of the semester with visual indicators.
 */

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { TrendComparison } from "@/hooks/useCampusActivityInsights";

interface TrendComparisonCardProps {
  comparison: TrendComparison;
  index: number;
}

const DIRECTION_CONFIG = {
  up: {
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.2)",
    Icon: TrendingUp,
    Arrow: ArrowUpRight,
    label: "Growing",
  },
  down: {
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.2)",
    Icon: TrendingDown,
    Arrow: ArrowDownRight,
    label: "Declining",
  },
  flat: {
    color: "#6b7280",
    bg: "rgba(107, 114, 128, 0.08)",
    border: "rgba(107, 114, 128, 0.2)",
    Icon: Minus,
    Arrow: Minus,
    label: "Stable",
  },
} as const;

export function TrendComparisonCard({ comparison, index }: TrendComparisonCardProps) {
  const config = DIRECTION_CONFIG[comparison.direction];
  const Icon = config.Icon;
  const Arrow = config.Arrow;

  const isPercentageMetric = comparison.metric.includes("Fill Rate");

  const formatValue = (val: number) => {
    if (isPercentageMetric) return `${val}%`;
    return val.toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">
          {comparison.metric}
        </span>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            color: config.color,
            backgroundColor: config.bg,
            border: `1px solid ${config.border}`,
          }}
        >
          <Icon className="w-3 h-3" />
          {config.label}
        </div>
      </div>

      {/* Values */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-[10px] text-gray-500 mb-1">1st Half</div>
          <div className="text-white text-xl font-bold">{formatValue(comparison.firstHalf)}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1">2nd Half</div>
          <div className="text-white text-xl font-bold">{formatValue(comparison.secondHalf)}</div>
        </div>
      </div>

      {/* Change Indicator */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
        <Arrow className="w-4 h-4" style={{ color: config.color }} />
        <span className="text-sm font-bold" style={{ color: config.color }}>
          {comparison.change >= 0 ? "+" : ""}
          {isPercentageMetric ? `${comparison.change}%` : comparison.change.toLocaleString()}
        </span>
        <span className="text-[10px] text-gray-500">
          ({comparison.changePercent >= 0 ? "+" : ""}
          {Math.round(comparison.changePercent)}% change)
        </span>
      </div>

      {/* Visual Bar Comparison */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-8 text-[9px] text-gray-500">1H</div>
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${
                  comparison.firstHalf + comparison.secondHalf > 0
                    ? (comparison.firstHalf / (comparison.firstHalf + comparison.secondHalf)) * 100
                    : 50
                }%`,
              }}
              transition={{ delay: 0.3 + index * 0.08, duration: 0.6 }}
              className="h-full rounded-full bg-gray-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 text-[9px] text-gray-500">2H</div>
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${
                  comparison.firstHalf + comparison.secondHalf > 0
                    ? (comparison.secondHalf / (comparison.firstHalf + comparison.secondHalf)) * 100
                    : 50
                }%`,
              }}
              transition={{ delay: 0.4 + index * 0.08, duration: 0.6 }}
              className="h-full rounded-full"
              style={{ backgroundColor: config.color }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
