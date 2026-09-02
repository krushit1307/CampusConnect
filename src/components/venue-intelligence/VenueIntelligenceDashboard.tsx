import { useState } from "react";
import { useVenueIntelligence, AVAILABLE_AMENITIES } from "@/hooks/useVenueIntelligence";
import { VenueHeatmapChart, HeatmapLegend } from "./VenueHeatmapChart";
import { VenueRecommendationCard } from "./VenueRecommendationCard";
import { VenueConflictResolver } from "./VenueConflictResolver";
import Building from "lucide-react/dist/esm/icons/building";
import Users from "lucide-react/dist/esm/icons/users";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Clock from "lucide-react/dist/esm/icons/clock";
import Filter from "lucide-react/dist/esm/icons/filter";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Target from "lucide-react/dist/esm/icons/target";
import Zap from "lucide-react/dist/esm/icons/zap";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import Minus from "lucide-react/dist/esm/icons/minus";

// ─── Trend Indicator (exported for use by sub-components) ─────────────

export function TrendIndicator({
  direction,
  size = 14,
}: {
  direction: "up" | "down" | "stable";
  size?: number;
}) {
  if (direction === "up") return <TrendingUp size={size} className="text-emerald-600" />;
  if (direction === "down") return <TrendingDown size={size} className="text-red-500" />;
  return <Minus size={size} className="text-gray-400" />;
}

// ─── Stat Card ────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  subtext,
  accent = "bg-white",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  accent?: string;
}) {
  return (
    <div className={`neu-border ${accent} p-4 shadow-[3px_3px_0_0_#000]`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-mono text-[10px] font-bold uppercase text-black/50">{label}</span>
      </div>
      <p className="font-display text-2xl font-black">{value}</p>
      {subtext && <p className="font-mono text-[10px] text-black/40 mt-1">{subtext}</p>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────

export function VenueIntelligenceDashboard() {
  const intel = useVenueIntelligence();
  const [dismissedConflicts, setDismissedConflicts] = useState<number[]>([]);

  const {
    summary,
    recommendations,
    topPicks,
    trendAnalyses,
    detectedConflicts,
    costEstimates,
    heatmapData,
    venues,
    state,
    setRequiredCapacity,
    toggleAmenity,
    setBudget,
    setEventDurationHours,
    toggleVenueSelection,
    clearVenueSelection,
    setShowConflictPanel,
    setSearchMode,
    selectedVenueScores,
  } = intel;

  const visibleConflicts = detectedConflicts.filter((_, i) => !dismissedConflicts.includes(i));

  return (
    <div className="space-y-8">
      {/* ═══ Header ═══ */}
      <div className="neu-border bg-indigo-100 p-8 shadow-[4px_4px_0_0_#000]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="eyebrow flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-indigo-900">
              <Zap className="h-4 w-4 text-indigo-700 animate-pulse" />
              AI-Powered Venue Intelligence
            </p>
            <h1 className="font-display text-4xl font-black text-black md:text-5xl uppercase mt-2">
              Venue Intelligence
            </h1>
            <p className="max-w-xl font-mono text-sm text-black/60 mt-2">
              Smart venue recommendations, utilization heatmaps, conflict detection, and cost
              estimation — all in one place.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSearchMode("discover")}
              className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                state.searchMode === "discover"
                  ? "bg-black text-cream shadow-none translate-y-0.5"
                  : "bg-white text-black hover:-translate-y-0.5 shadow-[2px_2px_0_0_#000]"
              }`}
            >
              🔍 Discover
            </button>
            <button
              onClick={() => setSearchMode("compare")}
              className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                state.searchMode === "compare"
                  ? "bg-black text-cream shadow-none translate-y-0.5"
                  : "bg-white text-black hover:-translate-y-0.5 shadow-[2px_2px_0_0_#000]"
              }`}
            >
              ⚖️ Compare
            </button>
            <button
              onClick={() => setSearchMode("analyze")}
              className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                state.searchMode === "analyze"
                  ? "bg-black text-cream shadow-none translate-y-0.5"
                  : "bg-white text-black hover:-translate-y-0.5 shadow-[2px_2px_0_0_#000]"
              }`}
            >
              📊 Analyze
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Summary Stats ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Building size={16} className="text-indigo-600" />}
          label="Total Venues"
          value={summary.totalVenues}
          subtext={`${summary.activeVenues} active`}
        />
        <StatCard
          icon={<BarChart3 size={16} className="text-emerald-600" />}
          label="Avg Utilization"
          value={`${summary.avgUtilizationRate}%`}
          subtext={`${summary.weeklyTrend > 0 ? "+" : ""}${summary.weeklyTrend}% this week`}
        />
        <StatCard
          icon={<DollarSign size={16} className="text-amber-600" />}
          label="Total Revenue"
          value={`$${summary.totalRevenue.toLocaleString()}`}
          subtext={`${summary.monthlyTrend > 0 ? "+" : ""}${summary.monthlyTrend}% monthly`}
        />
        <StatCard
          icon={<AlertTriangle size={16} className="text-red-500" />}
          label="Conflicts"
          value={visibleConflicts.length}
          subtext="pending resolutions"
          accent={visibleConflicts.length > 0 ? "bg-red-50" : "bg-white"}
        />
      </div>

      {/* ═══ Event Parameters Panel ═══ */}
      <div className="neu-border bg-white p-6 shadow-[3px_3px_0_0_#000]">
        <h2 className="font-display text-xl font-black uppercase mb-4 flex items-center gap-2">
          <Filter size={18} /> Event Parameters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Required Capacity */}
          <div>
            <label className="font-mono text-[10px] font-bold uppercase text-black/40 block mb-1">
              <Users size={10} className="inline mr-1" />
              Required Capacity
            </label>
            <input
              type="number"
              min={1}
              max={5000}
              value={state.requiredCapacity}
              onChange={(e) => setRequiredCapacity(Number(e.target.value))}
              className="w-full border-2 border-black px-3 py-2 font-mono text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Budget */}
          <div>
            <label className="font-mono text-[10px] font-bold uppercase text-black/40 block mb-1">
              <DollarSign size={10} className="inline mr-1" />
              Budget ($)
            </label>
            <input
              type="number"
              min={0}
              value={state.budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full border-2 border-black px-3 py-2 font-mono text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="font-mono text-[10px] font-bold uppercase text-black/40 block mb-1">
              <Clock size={10} className="inline mr-1" />
              Duration (hours)
            </label>
            <input
              type="number"
              min={1}
              max={24}
              value={state.eventDurationHours}
              onChange={(e) => setEventDurationHours(Number(e.target.value))}
              className="w-full border-2 border-black px-3 py-2 font-mono text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Conflicts toggle */}
          <div className="flex items-end">
            <button
              onClick={() => setShowConflictPanel(!state.showConflictPanel)}
              className={`w-full neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                state.showConflictPanel
                  ? "bg-red-100 text-red-800 border-red-500"
                  : "bg-white text-black hover:bg-gray-50"
              }`}
            >
              <AlertTriangle size={12} className="inline mr-1" />
              Conflicts ({visibleConflicts.length})
            </button>
          </div>
        </div>

        {/* Amenity Toggles */}
        <div>
          <p className="font-mono text-[10px] font-bold uppercase text-black/40 mb-2">
            Preferred Amenities
          </p>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_AMENITIES.map((amenity) => {
              const active = state.preferredAmenities.includes(amenity);
              return (
                <button
                  key={amenity}
                  onClick={() => toggleAmenity(amenity)}
                  className={`neu-border px-3 py-1 font-mono text-[10px] font-bold uppercase transition-all ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-800 shadow-none translate-y-0.5"
                      : "bg-white text-black hover:-translate-y-0.5 shadow-[1px_1px_0_0_#000]"
                  }`}
                >
                  {amenity.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Conflict Panel ═══ */}
      {state.showConflictPanel && (
        <div className="neu-border bg-white p-6 shadow-[3px_3px_0_0_#000]">
          <h2 className="font-display text-xl font-black uppercase mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" /> Conflict Resolution
          </h2>
          <VenueConflictResolver
            conflicts={visibleConflicts}
            onDismiss={(idx) => setDismissedConflicts((prev) => [...prev, idx])}
          />
        </div>
      )}

      {/* ═══ Top Picks ═══ */}
      {topPicks.length > 0 && (
        <div>
          <h2 className="font-display text-xl font-black uppercase mb-4 flex items-center gap-2">
            <Target size={18} className="text-indigo-600" /> Top Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topPicks.map((pick, idx) => {
              const trend = trendAnalyses.get(pick.venueId);
              const cost = costEstimates.get(pick.venueId);
              return (
                <VenueRecommendationCard
                  key={pick.venueId}
                  comparison={pick}
                  rank={idx}
                  isSelected={state.selectedVenueIds.includes(pick.venueId)}
                  onSelect={toggleVenueSelection}
                  trendDirection={trend?.direction}
                  costEstimate={
                    cost
                      ? {
                          subtotal: cost.subtotal,
                          hourlyRate: cost.hourlyRate,
                          notes: cost.notes,
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ All Venue Rankings ═══ */}
      <div className="neu-border bg-white p-6 shadow-[3px_3px_0_0_#000]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-black uppercase flex items-center gap-2">
            <BarChart3 size={18} /> All Venue Rankings
          </h2>
          {state.selectedVenueIds.length > 0 && (
            <button
              onClick={clearVenueSelection}
              className="font-mono text-[10px] font-bold uppercase text-black/40 hover:text-black/70 underline"
            >
              Clear selection ({state.selectedVenueIds.length})
            </button>
          )}
        </div>

        <div className="divide-y-2 divide-black">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 py-2 bg-black text-cream px-3 font-mono text-[10px] font-bold uppercase">
            <div className="col-span-1">#</div>
            <div className="col-span-3">Venue</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-1 text-center">Cap</div>
            <div className="col-span-1 text-center">Score</div>
            <div className="col-span-1 text-center">Util%</div>
            <div className="col-span-1 text-center">Trend</div>
            <div className="col-span-1 text-center">Cost</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {recommendations.map((rec, idx) => {
            const venue = venues.find((v) => v.id === rec.venueId);
            const trend = trendAnalyses.get(rec.venueId);
            const cost = costEstimates.get(rec.venueId);
            const util = intel.utilization.find((u) => u.venueId === rec.venueId);
            const isSelected = state.selectedVenueIds.includes(rec.venueId);

            return (
              <div
                key={rec.venueId}
                className={`grid grid-cols-12 gap-2 py-3 px-3 font-mono text-xs items-center transition-colors ${
                  isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="col-span-1 font-bold text-center">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                </div>
                <div className="col-span-3 font-bold truncate">{rec.venueName}</div>
                <div className="col-span-2 text-[10px] uppercase text-black/50">
                  {venue?.type?.replace(/_/g, " ") ?? "—"}
                </div>
                <div className="col-span-1 text-center">{venue?.capacity ?? "—"}</div>
                <div className="col-span-1 text-center">
                  <span
                    className={`inline-block px-1.5 py-0.5 font-bold text-[10px] border ${
                      rec.matchScore >= 80
                        ? "bg-emerald-100 border-emerald-400 text-emerald-800"
                        : rec.matchScore >= 60
                          ? "bg-yellow-100 border-yellow-400 text-yellow-800"
                          : "bg-orange-100 border-orange-400 text-orange-800"
                    }`}
                  >
                    {rec.matchScore}
                  </span>
                </div>
                <div className="col-span-1 text-center">{util?.avgUtilization ?? "—"}%</div>
                <div className="col-span-1 text-center">
                  {trend && <TrendIndicator direction={trend.direction} />}
                </div>
                <div className="col-span-1 text-center font-bold">
                  {cost?.subtotal === 0 ? (
                    <span className="text-emerald-700">FREE</span>
                  ) : (
                    `$${cost?.subtotal ?? "—"}`
                  )}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => toggleVenueSelection(rec.venueId)}
                    className={`neu-border px-2 py-1 font-mono text-[9px] font-bold uppercase transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-800"
                        : "bg-white text-black hover:bg-gray-100"
                    }`}
                  >
                    {isSelected ? "✓" : "Select"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Heatmap ═══ */}
      <div className="neu-border bg-white p-6 shadow-[3px_3px_0_0_#000]">
        <h2 className="font-display text-xl font-black uppercase mb-4 flex items-center gap-2">
          <BarChart3 size={18} /> Campus Booking Heatmap
        </h2>
        <p className="font-mono text-xs text-black/50 mb-4">
          Hourly utilization across all venues, aggregated by day of week. Darker cells indicate
          higher booking density.
        </p>
        <VenueHeatmapChart data={heatmapData} />
        <HeatmapLegend />
      </div>

      {/* ═══ Trend Insights ═══ */}
      <div className="neu-border bg-white p-6 shadow-[3px_3px_0_0_#000]">
        <h2 className="font-display text-xl font-black uppercase mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-600" /> Utilization Trends
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {intel.utilization.map((u) => {
            const trend = trendAnalyses.get(u.venueId);
            if (!trend) return null;
            return (
              <div key={u.venueId} className="border-2 border-black p-4 bg-cream">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-mono text-xs font-bold truncate">{u.venueName}</h4>
                  <TrendIndicator direction={trend.direction} />
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-display text-2xl font-black">{u.avgUtilization}%</span>
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      trend.weeklyChange > 0
                        ? "text-emerald-600"
                        : trend.weeklyChange < 0
                          ? "text-red-500"
                          : "text-gray-400"
                    }`}
                  >
                    {trend.weeklyChange > 0 ? "+" : ""}
                    {trend.weeklyChange}%
                  </span>
                </div>
                <p className="font-mono text-[10px] text-black/50 leading-relaxed">
                  {trend.insight}
                </p>
                <div className="mt-2 border-t border-dashed border-black/20 pt-2">
                  <p className="font-mono text-[9px] text-black/40 uppercase">
                    Projected next week: {trend.projectedNextWeek}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Cost Comparison ═══ */}
      <div className="neu-border bg-white p-6 shadow-[3px_3px_0_0_#000]">
        <h2 className="font-display text-xl font-black uppercase mb-4 flex items-center gap-2">
          <DollarSign size={18} /> Cost Estimates ({state.eventDurationHours}h Event)
        </h2>
        <div className="space-y-3">
          {Array.from(costEstimates.values())
            .sort((a, b) => a.subtotal - b.subtotal)
            .map((cost) => (
              <div
                key={cost.venueId}
                className="flex items-center justify-between border-2 border-black p-3 bg-cream hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-bold truncate">{cost.venueName}</p>
                  <p className="font-mono text-[9px] text-black/40">
                    ${cost.hourlyRate}/hr × {cost.estimatedHours}h
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="font-display text-lg font-black">
                    {cost.subtotal === 0 ? (
                      <span className="text-emerald-700">FREE</span>
                    ) : (
                      `$${cost.subtotal}`
                    )}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
