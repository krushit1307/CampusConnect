/**
 * ClubEngagementRing — Donut/ring chart showing club engagement scores
 * with interactive hover details.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "lucide-react";
import { ClubEngagement } from "@/utils/activityHeatmap";

interface ClubEngagementRingProps {
  clubs: ClubEngagement[];
}

const RING_COLORS = [
  "#f43f5e",
  "#a855f7",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#3b82f6",
  "#14b8a6",
  "#f97316",
];

export function ClubEngagementRing({ clubs }: ClubEngagementRingProps) {
  const [hoveredClub, setHoveredClub] = useState<string | null>(null);
  const topClubs = clubs.slice(0, 10);

  const totalEvents = useMemo(() => topClubs.reduce((s, c) => s + c.totalEvents, 0), [topClubs]);

  // SVG donut segments
  const segments = useMemo(() => {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let accumulated = 0;

    return topClubs.map((club, i) => {
      const pct = totalEvents > 0 ? club.totalEvents / totalEvents : 0;
      const dashArray = `${pct * circumference} ${(1 - pct) * circumference}`;
      const rotation = (accumulated / totalEvents) * 360;
      accumulated += club.totalEvents;

      return {
        ...club,
        color: RING_COLORS[i % RING_COLORS.length],
        dashArray,
        rotation,
        pct,
      };
    });
  }, [topClubs, totalEvents]);

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="text-white font-semibold text-sm">Club Engagement</h3>
      </div>

      <div className="flex items-center gap-6">
        {/* SVG Donut */}
        <div className="relative w-[170px] h-[170px] shrink-0">
          <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
            {segments.map((seg, i) => (
              <circle
                key={seg.club}
                cx="90"
                cy="90"
                r="70"
                fill="none"
                stroke={seg.color}
                strokeWidth={hoveredClub === seg.club ? 22 : 18}
                strokeDasharray={seg.dashArray}
                strokeDashoffset={0}
                strokeLinecap="butt"
                transform={`rotate(${seg.rotation} 90 90)`}
                className="transition-all duration-200 cursor-pointer"
                style={{ opacity: hoveredClub && hoveredClub !== seg.club ? 0.3 : 1 }}
                onMouseEnter={() => setHoveredClub(seg.club)}
                onMouseLeave={() => setHoveredClub(null)}
              />
            ))}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{topClubs.length}</span>
            <span className="text-[9px] text-gray-400">active clubs</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {segments.map((seg, i) => (
            <motion.div
              key={seg.club}
              className="flex items-center gap-2 cursor-pointer group"
              onMouseEnter={() => setHoveredClub(seg.club)}
              onMouseLeave={() => setHoveredClub(null)}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span
                className={`text-[11px] truncate flex-1 transition-colors ${
                  hoveredClub === seg.club ? "text-white" : "text-gray-400"
                }`}
              >
                {seg.club}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">{seg.engagementScore}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Hover Detail Card */}
      <AnimatePresence>
        {hoveredClub &&
          (() => {
            const club = topClubs.find((c) => c.club === hoveredClub);
            if (!club) return null;
            return (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 bg-white/5 border border-white/10 rounded-xl p-3 overflow-hidden"
              >
                <div className="text-white text-xs font-semibold mb-1">{club.club}</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-gray-500 text-[9px]">Events</div>
                    <div className="text-white text-sm font-bold">{club.totalEvents}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[9px]">Total RSVPs</div>
                    <div className="text-white text-sm font-bold">
                      {club.totalRsvps.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[9px]">Fill Rate</div>
                    <div className="text-white text-sm font-bold">
                      {Math.round(club.avgFillRate * 100)}%
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}
      </AnimatePresence>
    </div>
  );
}
