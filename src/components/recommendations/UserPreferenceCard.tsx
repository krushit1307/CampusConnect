/**
 * UserPreferenceCard — Displays the user's interaction stats,
 * top interests, and preference summary in a glassmorphism card.
 */

import { motion } from "framer-motion";
import { User, Bookmark, Eye, Ticket, Heart, BarChart3 } from "lucide-react";
import { EventCategory, getCategoryColor } from "@/utils/recommendationEngine";

interface UserPreferenceCardProps {
  userStats: {
    totalInteractions: number;
    rsvps: number;
    bookmarks: number;
    views: number;
    topCategory: string;
    avgScore: number;
  };
  categoryAffinities: Record<EventCategory, number>;
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  academic: "Academic",
  cultural: "Cultural",
  sports: "Sports",
  tech: "Tech",
  social: "Social",
  workshop: "Workshop",
  seminar: "Seminar",
  concert: "Concert",
  exhibition: "Exhibition",
  networking: "Networking",
};

export function UserPreferenceCard({ userStats, categoryAffinities }: UserPreferenceCardProps) {
  const sortedCategories = Object.entries(categoryAffinities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxAffinity = sortedCategories[0]?.[1] || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-cyan-500/30 flex items-center justify-center">
          <User className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Your Profile</h3>
          <p className="text-gray-400 text-xs">
            Based on {userStats.totalInteractions} interactions
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <Ticket className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{userStats.rsvps}</div>
          <div className="text-[10px] text-gray-500">RSVPs</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <Bookmark className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{userStats.bookmarks}</div>
          <div className="text-[10px] text-gray-500">Bookmarks</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <Eye className="w-4 h-4 text-purple-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{userStats.views}</div>
          <div className="text-[10px] text-gray-500">Views</div>
        </div>
      </div>

      {/* Top Interests */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
            Top Interests
          </span>
        </div>
        <div className="space-y-2.5">
          {sortedCategories.map(([cat, affinity], i) => {
            const pct = (affinity / maxAffinity) * 100;
            const color = getCategoryColor(cat as EventCategory);
            return (
              <motion.div
                key={cat}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3"
              >
                <span className="text-[11px] text-gray-400 w-20 truncate">
                  {CATEGORY_LABELS[cat as EventCategory]}
                </span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 w-6 text-right">
                  {affinity.toFixed(1)}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Recommendation Score */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-3 flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-cyan-400" />
        <div className="flex-1">
          <div className="text-white text-sm font-medium">Match Score</div>
          <div className="text-gray-400 text-[10px]">How well we know your taste</div>
        </div>
        <div className="text-2xl font-bold text-cyan-400">
          {Math.round(userStats.avgScore * 100)}%
        </div>
      </div>
    </motion.div>
  );
}
