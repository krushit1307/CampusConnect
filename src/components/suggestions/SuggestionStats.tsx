import { motion } from "framer-motion";
import { Lightbulb, TrendingUp, CheckCircle2, XCircle, BarChart3 } from "lucide-react";
import { useSuggestionStats } from "@/hooks/useSuggestions";
import { CATEGORY_META, type SuggestionStats as SuggestionStatsType } from "@/types/suggestions";
import { cn } from "@/lib/utils";

interface SuggestionStatsProps {
  clubId: string | null;
}

const statCardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.3, ease: "easeOut" },
  }),
};

export function SuggestionStatsPanel({ clubId }: SuggestionStatsProps) {
  const { data: stats, isLoading } = useSuggestionStats(clubId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: "Total Ideas",
      value: stats.total_suggestions,
      icon: Lightbulb,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Open for Voting",
      value: stats.open_suggestions,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Approved",
      value: stats.approved_count,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Rejected",
      value: stats.rejected_count,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={statCardVariants}
            className={cn(
              "rounded-xl border border-gray-200 p-4 transition-shadow hover:shadow-md",
              card.bg,
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <card.icon className={cn("h-5 w-5", card.color)} />
              <span className="text-2xl font-black tabular-nums text-gray-900">{card.value}</span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              {card.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Category breakdown */}
      {stats.top_categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-gray-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
              Popular Categories
            </h4>
          </div>
          <div className="space-y-2.5">
            {stats.top_categories.map((cat) => {
              const meta = CATEGORY_META[cat.category];
              const maxCount = stats.top_categories[0]?.count || 1;
              const pct = Math.round((cat.count / maxCount) * 100);

              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="w-24 text-xs font-medium text-gray-700 truncate">
                    {meta.icon} {meta.label}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-500 w-6 text-right tabular-nums">
                    {cat.count}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Total votes */}
      <div className="text-center text-xs text-gray-400 font-mono">
        {stats.total_votes_cast.toLocaleString()} total votes cast across all suggestions
      </div>
    </div>
  );
}
