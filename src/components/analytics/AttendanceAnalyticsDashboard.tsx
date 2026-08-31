/**
 * AttendanceAnalyticsDashboard — Full-page analytics dashboard for event attendance.
 *
 * Composes KPI cards, trend charts, category breakdown, top events table,
 * attendance heatmap, and no-show analysis into a cohesive analytics view.
 */

import { motion } from "framer-motion";
import { BarChart3, RefreshCw, CalendarDays } from "lucide-react";
import { useAttendanceAnalytics } from "@/hooks/useAttendanceAnalytics";
import { AttendanceKpiCards } from "./AttendanceKpiCards";
import { AttendanceTrendChart } from "./AttendanceTrendChart";
import { CategoryPieChart } from "./CategoryPieChart";
import { TopEventsTable } from "./TopEventsTable";
import { AttendanceHeatmapChart } from "./AttendanceHeatmapChart";
import { NoShowAnalysis } from "./NoShowAnalysis";
import { AnalyticsFilterBar } from "./AnalyticsFilterBar";
import { downloadCsv } from "@/utils/attendanceAnalytics";

export default function AttendanceAnalyticsDashboard() {
  const {
    records,
    stats,
    categoryStats,
    trendData,
    heatmapData,
    filters,
    availableClubs,
    availableCategories,
    updateFilters,
    resetFilters,
  } = useAttendanceAnalytics();

  const handleExport = () => {
    downloadCsv(records);
  };

  const now = new Date();
  const lastUpdated = now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <BarChart3 className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Attendance Analytics
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Deep insights into event attendance patterns and trends
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-gray-500 text-xs">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Last updated: {lastUpdated}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="mb-6">
        <AnalyticsFilterBar
          filters={filters}
          availableCategories={availableCategories}
          availableClubs={availableClubs}
          onUpdateFilter={updateFilters}
          onReset={resetFilters}
          onExport={handleExport}
        />
      </div>

      {/* Content */}
      {records.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <BarChart3 className="w-16 h-16 text-gray-700 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Data Found</h2>
          <p className="text-gray-400 text-sm text-center max-w-md">
            No events match your current filter criteria. Try adjusting the date range, category, or
            club filters to see analytics data.
          </p>
          <button
            onClick={resetFilters}
            className="mt-6 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-all"
          >
            Reset Filters
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <AttendanceKpiCards stats={stats} />

          {/* Trend Chart — full width */}
          <AttendanceTrendChart data={trendData} />

          {/* Category Breakdown + Top Events */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <CategoryPieChart data={categoryStats} />
            <TopEventsTable records={records} maxRows={8} />
          </div>

          {/* Heatmap + No-Show Analysis */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <AttendanceHeatmapChart data={heatmapData} />
            <NoShowAnalysis records={records} />
          </div>

          {/* Footer Note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center text-gray-600 text-[10px] pb-4"
          >
            CampusConnect Attendance Analytics · Data updates in real-time · Export available via
            CSV
          </motion.div>
        </div>
      )}
    </div>
  );
}
