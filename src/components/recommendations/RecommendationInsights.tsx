/**
 * RecommendationInsights — Analytics panel showing how the recommendation
 * engine works, what signals it uses, and the distribution of scoring.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Brain, Sparkles, TrendingUp, Filter, Shield, Zap } from "lucide-react";
import { ScoredEvent } from "@/utils/recommendationEngine";

interface RecommendationInsightsProps {
  scoredEvents: ScoredEvent[];
}

const SCORE_DISTRIBUTION_COLORS = ["#f43f5e", "#f59e0b", "#06b6d4", "#10b981", "#3b82f6"];

export function RecommendationInsights({ scoredEvents }: RecommendationInsightsProps) {
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: "0-20%", count: 0, label: "Low" },
      { range: "20-40%", count: 0, label: "Below Avg" },
      { range: "40-60%", count: 0, label: "Average" },
      { range: "60-80%", count: 0, label: "Good" },
      { range: "80-100%", count: 0, label: "Excellent" },
    ];

    scoredEvents.forEach((s) => {
      const pct = s.score * 100;
      if (pct < 20) buckets[0].count++;
      else if (pct < 40) buckets[1].count++;
      else if (pct < 60) buckets[2].count++;
      else if (pct < 80) buckets[3].count++;
      else buckets[4].count++;
    });

    return buckets.filter((b) => b.count > 0);
  }, [scoredEvents]);

  const signalAverages = useMemo(() => {
    if (scoredEvents.length === 0) return [];
    const len = scoredEvents.length;
    return [
      {
        signal: "Content",
        avg: scoredEvents.reduce((s, e) => s + e.contentScore, 0) / len,
        color: "#3b82f6",
      },
      {
        signal: "Social",
        avg: scoredEvents.reduce((s, e) => s + e.collaborativeScore, 0) / len,
        color: "#a855f7",
      },
      {
        signal: "Trending",
        avg: scoredEvents.reduce((s, e) => s + e.recencyScore, 0) / len,
        color: "#f59e0b",
      },
      {
        signal: "Popularity",
        avg: scoredEvents.reduce((s, e) => s + e.popularityScore, 0) / len,
        color: "#10b981",
      },
    ];
  }, [scoredEvents]);

  const topReasons = useMemo(() => {
    const reasonCounts: Record<string, number> = {};
    scoredEvents.forEach((s) => {
      s.reasons.forEach((r) => {
        reasonCounts[r.type] = (reasonCounts[r.type] || 0) + 1;
      });
    });
    return Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [scoredEvents]);

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-lg px-3 py-2 text-xs shadow-xl">
        <div className="text-white font-medium">
          {d.label}: {d.count} events
        </div>
      </div>
    );
  };

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-lg px-3 py-2 text-xs shadow-xl">
        <div className="text-white font-medium">
          {d.signal}: {Math.round(d.avg * 100)}%
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
          <Brain className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-base">How It Works</h3>
          <p className="text-gray-400 text-xs">Inside the recommendation engine</p>
        </div>
      </div>

      {/* Algorithm Explanation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
          <Sparkles className="w-4 h-4 text-blue-400 mb-1.5" />
          <div className="text-white text-xs font-medium">Content Match</div>
          <div className="text-gray-500 text-[10px] mt-0.5">
            40% weight — category &amp; tag similarity
          </div>
        </div>
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3">
          <Shield className="w-4 h-4 text-purple-400 mb-1.5" />
          <div className="text-white text-xs font-medium">Social Proof</div>
          <div className="text-gray-500 text-[10px] mt-0.5">
            25% weight — similar users&apos; ratings
          </div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <Zap className="w-4 h-4 text-amber-400 mb-1.5" />
          <div className="text-white text-xs font-medium">Trending</div>
          <div className="text-gray-500 text-[10px] mt-0.5">15% weight — event proximity</div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
          <TrendingUp className="w-4 h-4 text-emerald-400 mb-1.5" />
          <div className="text-white text-xs font-medium">Popularity</div>
          <div className="text-gray-500 text-[10px] mt-0.5">
            20% weight — RSVP &amp; rating count
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Score Distribution */}
        <div>
          <h4 className="text-white text-xs font-medium mb-3 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            Score Distribution
          </h4>
          {scoreDistribution.length > 0 ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {scoreDistribution.map((_, idx) => (
                      <Cell key={idx} fill={SCORE_DISTRIBUTION_COLORS[idx]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-600 text-xs">
              No data
            </div>
          )}
          <div className="flex flex-wrap gap-2 justify-center">
            {scoreDistribution.map((d, i) => (
              <div key={d.range} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: SCORE_DISTRIBUTION_COLORS[i] }}
                />
                <span className="text-[10px] text-gray-400">
                  {d.label} ({d.count})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Signal Averages */}
        <div>
          <h4 className="text-white text-xs font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
            Signal Strength
          </h4>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signalAverages} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="signal"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]} barSize={32}>
                  {signalAverages.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Reasons */}
      {topReasons.length > 0 && (
        <div className="mt-5">
          <h4 className="text-white text-xs font-medium mb-3">Top Recommendation Signals</h4>
          <div className="flex flex-wrap gap-2">
            {topReasons.map(([type, count]) => (
              <div
                key={type}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-300"
              >
                <span className="text-white font-medium">{count}×</span> {type.replace(/_/g, " ")}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
