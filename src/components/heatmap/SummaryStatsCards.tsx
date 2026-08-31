/**
 * SummaryStatsCards — Top-level KPI cards showing aggregate campus stats.
 */

import { motion } from "framer-motion";
import {
  Calendar,
  Users,
  MapPin,
  TrendingUp,
  BarChart3,
  Clock,
  Star,
  Activity,
} from "lucide-react";
import { SummaryStats } from "@/utils/activityHeatmap";

interface SummaryStatsCardsProps {
  stats: SummaryStats;
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 12) return `${hour === 0 ? 12 : 12}${hour < 12 ? "AM" : "PM"}`;
  return `${hour > 12 ? hour - 12 : hour}${hour < 12 ? "AM" : "PM"}`;
}

const CARDS = [
  {
    key: "totalEvents",
    label: "Total Events",
    icon: Calendar,
    color: "#06b6d4",
    format: (s: SummaryStats) => s.totalEvents.toLocaleString(),
  },
  {
    key: "totalRsvps",
    label: "Total RSVPs",
    icon: Users,
    color: "#a855f7",
    format: (s: SummaryStats) => s.totalRsvps.toLocaleString(),
  },
  {
    key: "avgFillRate",
    label: "Avg Fill Rate",
    icon: BarChart3,
    color: "#10b981",
    format: (s: SummaryStats) => `${Math.round(s.avgFillRate * 100)}%`,
  },
  {
    key: "peakDay",
    label: "Busiest Day",
    icon: Star,
    color: "#f59e0b",
    format: (s: SummaryStats) => s.peakDay,
  },
  {
    key: "peakHour",
    label: "Peak Hour",
    icon: Clock,
    color: "#f43f5e",
    format: (s: SummaryStats) => formatHour(s.peakHour),
  },
  {
    key: "mostActiveClub",
    label: "Top Club",
    icon: Activity,
    color: "#ec4899",
    format: (s: SummaryStats) => s.mostActiveClub,
  },
  {
    key: "busiestLocation",
    label: "Busiest Venue",
    icon: MapPin,
    color: "#14b8a6",
    format: (s: SummaryStats) => s.busiestLocation,
  },
  {
    key: "weeklyGrowth",
    label: "Semester Growth",
    icon: TrendingUp,
    color: "#6366f1",
    format: (s: SummaryStats) => {
      const pct = Math.round(s.weeklyGrowthRate * 100);
      return `${pct >= 0 ? "+" : ""}${pct}%`;
    },
  },
];

export function SummaryStatsCards({ stats }: SummaryStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {CARDS.map((card, i) => {
        const Icon = card.icon;
        const value = card.format(stats);

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${card.color}15` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
              </div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                {card.label}
              </span>
            </div>
            <div className="text-white text-lg font-bold truncate">{value}</div>
          </motion.div>
        );
      })}
    </div>
  );
}
