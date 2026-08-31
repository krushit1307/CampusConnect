/**
 * CampusActivityHeatmap — Full-page campus activity visualization dashboard.
 *
 * Shows temporal heatmap grid, location activity, club engagement,
 * RSVP velocity trends, category breakdown, and summary KPIs.
 */

import { motion } from "framer-motion";
import { BarChart3, RefreshCw } from "lucide-react";
import { useCampusActivity } from "@/hooks/useCampusActivity";
import { TimeSlotGrid } from "./TimeSlotGrid";
import { LocationActivityBar } from "./LocationActivityBar";
import { ClubEngagementRing } from "./ClubEngagementRing";
import { RSVPVelocityTrend } from "./RSVPVelocityTrend";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { SummaryStatsCards } from "./SummaryStatsCards";
import { HeatmapFilterBar } from "./HeatmapFilterBar";

export default function CampusActivityHeatmap() {
  const {
    fullDataset,
    filteredTimeSlots,
    filteredLocations,
    gridMax,
    allLocations,
    filters,
    hoveredSlot,
    setHoveredSlot,
    toggleDay,
    toggleCategory,
    setLocation,
    resetFilters,
  } = useCampusActivity();

  const { clubs, rsvpVelocity, categories, summaryStats } = fullDataset;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30">
              <BarChart3 className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Campus Activity Heatmap
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Visualize event patterns, RSVP trends, and club engagement across the semester
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Summary KPIs */}
      <div className="mb-6">
        <SummaryStatsCards stats={summaryStats} />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <HeatmapFilterBar
          filters={filters}
          allLocations={allLocations}
          onToggleDay={toggleDay}
          onToggleCategory={toggleCategory}
          onSetLocation={setLocation}
          onReset={resetFilters}
        />
      </div>

      {/* Main Heatmap Grid */}
      <div className="mb-6">
        <TimeSlotGrid
          timeSlots={filteredTimeSlots}
          maxValue={gridMax}
          hoveredSlot={hoveredSlot}
          onHover={setHoveredSlot}
        />
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <LocationActivityBar
          locations={filteredLocations}
          maxEvents={Math.max(...filteredLocations.map((l) => l.totalEvents), 1)}
        />
        <RSVPVelocityTrend data={rsvpVelocity} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClubEngagementRing clubs={clubs} />
        <CategoryBreakdown categories={categories} />
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center text-gray-600 text-[10px] pt-8 pb-4"
      >
        CampusConnect Activity Analytics · Temporal Heatmap · Real-time RSVP Intelligence
      </motion.div>
    </div>
  );
}
