/**
 * ActivityInsightsReport — Full-page campus activity insights report
 * combining trend comparisons, predictive analytics, club performance
 * rankings, location insights, and category analysis with export support.
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Trophy,
  MapPin,
  Tag,
  Lightbulb,
  BarChart3,
  FileSpreadsheet,
  Zap,
} from "lucide-react";
import { useCampusActivityInsights } from "@/hooks/useCampusActivityInsights";
import { TrendComparisonCard } from "@/components/heatmap/TrendComparisonCard";
import { PredictiveTrendChart } from "@/components/heatmap/PredictiveTrendChart";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/utils/activityHeatmap";
import { useState } from "react";

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : score >= 25 ? "#f97316" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="6"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-3xl font-bold text-white"
        >
          {score}
        </motion.span>
        <span className="text-[9px] text-gray-500 uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

export default function ActivityInsightsReport() {
  const {
    report,
    allClubs,
    allLocations,
    reportFilters,
    toggleClub,
    toggleLocation,
    setCompareMode,
    resetFilters,
    exportReport,
    exportCSV,
  } = useCampusActivityInsights(42, 12);

  const [showFilters, setShowFilters] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    trends: true,
    predictions: true,
    clubs: true,
    locations: true,
    categories: true,
  });

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasActiveFilters =
    reportFilters.selectedClubs.length > 0 || reportFilters.selectedLocations.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
              <FileText className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Campus Activity Insights Report
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Comprehensive analytics with trend analysis, predictions, and actionable insights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={exportReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-xs ${
                showFilters || hasActiveFilters
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                  : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 w-4 h-4 rounded-full bg-cyan-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {reportFilters.selectedClubs.length + reportFilters.selectedLocations.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                  Report Filters
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-medium hover:bg-rose-500/20 transition-all"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>

              {/* Compare Mode */}
              <div className="mb-4">
                <div className="text-[10px] text-gray-500 mb-2">Comparison Mode</div>
                <div className="flex gap-2">
                  {[
                    {
                      value: "first-half-second-half" as const,
                      label: "1st Half vs 2nd Half",
                    },
                    {
                      value: "week-over-week" as const,
                      label: "Week over Week",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCompareMode(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                        reportFilters.compareMode === opt.value
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clubs Filter */}
              <div className="mb-4">
                <div className="text-[10px] text-gray-500 mb-2">Filter by Club</div>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {allClubs.map((club) => {
                    const active = reportFilters.selectedClubs.includes(club);
                    return (
                      <button
                        key={club}
                        onClick={() => toggleClub(club)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                          active
                            ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/40"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        {club}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Locations Filter */}
              <div>
                <div className="text-[10px] text-gray-500 mb-2">Filter by Location</div>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {allLocations.map((loc) => {
                    const active = reportFilters.selectedLocations.includes(loc);
                    return (
                      <button
                        key={loc}
                        onClick={() => toggleLocation(loc)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                          active
                            ? "bg-violet-500/15 text-violet-400 border-violet-500/40"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        {loc}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overall Score + Key Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center"
        >
          <h3 className="text-white font-semibold text-sm mb-3">Campus Health Score</h3>
          <ScoreGauge score={report.summaryScore} />
          <p className="text-[10px] text-gray-500 mt-3 text-center">
            Based on RSVP growth, fill rates, venue utilization, and club diversity
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h3 className="text-white font-semibold text-sm">Key Insights</h3>
          </div>
          <div className="space-y-2.5">
            {report.topInsights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.06 }}
                className="flex items-start gap-2"
              >
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[12px] text-gray-300 leading-relaxed">{insight}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Section: Trend Comparisons */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection("trends")}
          className="flex items-center gap-2 mb-3 text-white font-semibold text-sm hover:text-cyan-400 transition-colors"
        >
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          Trend Comparisons
          {expandedSections.trends ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        <AnimatePresence>
          {expandedSections.trends && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {report.trendComparisons.map((comp, i) => (
                  <TrendComparisonCard key={comp.metric} comparison={comp} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section: Predictive Trend */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection("predictions")}
          className="flex items-center gap-2 mb-3 text-white font-semibold text-sm hover:text-violet-400 transition-colors"
        >
          <Zap className="w-4 h-4 text-violet-400" />
          Predictive Analytics
          {expandedSections.predictions ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        <AnimatePresence>
          {expandedSections.predictions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <PredictiveTrendChart
                weeklyTrends={report.weeklyTrends}
                predictions={report.predictions}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section: Club Performance Rankings */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection("clubs")}
          className="flex items-center gap-2 mb-3 text-white font-semibold text-sm hover:text-amber-400 transition-colors"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          Club Performance Rankings
          {expandedSections.clubs ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        <AnimatePresence>
          {expandedSections.clubs && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-7 gap-2 px-5 py-3 border-b border-white/5 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                  <div className="col-span-2">Club</div>
                  <div className="text-center">Events</div>
                  <div className="text-center">RSVPs</div>
                  <div className="text-center">Fill Rate</div>
                  <div className="text-center">Growth</div>
                  <div className="text-center">Score</div>
                </div>

                {report.clubPerformance.map((club, i) => (
                  <motion.div
                    key={club.club}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-7 gap-2 px-5 py-3 border-b border-white/5 hover:bg-white/5 transition-colors items-center"
                  >
                    <div className="col-span-2 flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${
                          i === 0
                            ? "text-amber-400"
                            : i === 1
                              ? "text-gray-300"
                              : i === 2
                                ? "text-orange-400"
                                : "text-gray-500"
                        }`}
                      >
                        #{i + 1}
                      </span>
                      <span className="text-white text-xs font-medium truncate">{club.club}</span>
                    </div>
                    <div className="text-center text-gray-300 text-xs">{club.eventCount}</div>
                    <div className="text-center text-gray-300 text-xs">
                      {club.totalRsvps.toLocaleString()}
                    </div>
                    <div className="text-center text-xs">
                      <span
                        className={
                          club.avgFillRate > 0.7
                            ? "text-emerald-400"
                            : club.avgFillRate > 0.5
                              ? "text-amber-400"
                              : "text-gray-400"
                        }
                      >
                        {Math.round(club.avgFillRate * 100)}%
                      </span>
                    </div>
                    <div className="text-center text-xs">
                      <span
                        className={
                          club.growthRate > 0
                            ? "text-emerald-400"
                            : club.growthRate < 0
                              ? "text-rose-400"
                              : "text-gray-400"
                        }
                      >
                        {club.growthRate > 0 ? "+" : ""}
                        {Math.round(club.growthRate * 100)}%
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              club.overallScore >= 70
                                ? "#10b981"
                                : club.overallScore >= 40
                                  ? "#f59e0b"
                                  : "#ef4444",
                          }}
                        />
                        <span className="text-white text-xs font-bold">{club.overallScore}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section: Location Insights */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection("locations")}
          className="flex items-center gap-2 mb-3 text-white font-semibold text-sm hover:text-emerald-400 transition-colors"
        >
          <MapPin className="w-4 h-4 text-emerald-400" />
          Location Insights
          {expandedSections.locations ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        <AnimatePresence>
          {expandedSections.locations && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.locationInsights.map((loc, i) => (
                  <motion.div
                    key={loc.location}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white text-xs font-semibold truncate">{loc.location}</h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          loc.trend === "growing"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : loc.trend === "declining"
                              ? "bg-rose-500/15 text-rose-400"
                              : "bg-gray-500/15 text-gray-400"
                        }`}
                      >
                        {loc.trend}
                      </span>
                    </div>

                    <div className="mb-2">
                      <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
                        <span>Utilization</span>
                        <span>{Math.round(loc.utilizationRate * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${loc.utilizationRate * 100}%`,
                          }}
                          transition={{
                            delay: 0.3 + i * 0.06,
                            duration: 0.6,
                          }}
                          className="h-full rounded-full"
                          style={{
                            backgroundColor:
                              loc.utilizationRate > 0.8
                                ? "#ef4444"
                                : loc.utilizationRate > 0.5
                                  ? "#f59e0b"
                                  : "#10b981",
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-500 mb-1">
                      Peak: <span className="text-gray-300">{loc.peakWindow}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 leading-relaxed">
                      {loc.recommendedAction}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section: Category Insights */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection("categories")}
          className="flex items-center gap-2 mb-3 text-white font-semibold text-sm hover:text-pink-400 transition-colors"
        >
          <Tag className="w-4 h-4 text-pink-400" />
          Category Analysis
          {expandedSections.categories ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        <AnimatePresence>
          {expandedSections.categories && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.categoryInsights.map((cat, i) => {
                  const color = CATEGORY_COLORS[cat.category];
                  return (
                    <motion.div
                      key={cat.category}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-white text-xs font-semibold">
                          {CATEGORY_LABELS[cat.category]}
                        </span>
                        <span className="text-[10px] text-gray-500 ml-auto">
                          {cat.totalEvents} events
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div>
                          <div className="text-[9px] text-gray-500">RSVPs</div>
                          <div className="text-white text-sm font-bold">
                            {cat.totalRsvps.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-500">Fill Rate</div>
                          <div
                            className="text-sm font-bold"
                            style={{
                              color: cat.avgFillRate > 0.7 ? "#10b981" : "#f59e0b",
                            }}
                          >
                            {Math.round(cat.avgFillRate * 100)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-500">Growth</div>
                          <div
                            className="text-sm font-bold"
                            style={{
                              color:
                                cat.growthRate > 0.1
                                  ? "#10b981"
                                  : cat.growthRate < -0.1
                                    ? "#ef4444"
                                    : "#6b7280",
                            }}
                          >
                            {cat.growthRate > 0 ? "+" : ""}
                            {Math.round(cat.growthRate * 100)}%
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-gray-400 pt-2 border-t border-white/5">
                        {cat.recommendedFocus}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center text-gray-600 text-[10px] pt-8 pb-4"
      >
        CampusConnect Activity Insights Report · Data-driven campus analytics · Export available in
        CSV and JSON
      </motion.div>
    </div>
  );
}
