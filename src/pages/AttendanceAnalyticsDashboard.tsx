import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import {
  useAttendanceAnalytics,
  type EventAttendanceSummary,
  type AttendanceTrend,
  type ZoneAnalytics,
  type AttendanceInsight,
  type AttendanceFilterState,
  type TimeRange,
} from "@/hooks/useAttendanceAnalytics";

/* ─────────────────────── SVG CHART COMPONENTS ─────────────────────── */

function MiniBarChart({
  data,
  height = 60,
  barColor = "#a855f7",
  label,
}: {
  data: number[];
  height?: number;
  barColor?: string;
  label?: string;
}) {
  const max = Math.max(...data, 1);
  const barWidth = `${100 / data.length}%`;

  return (
    <div>
      {label && <div className="text-[10px] text-gray-500 mb-1">{label}</div>}
      <div className="flex items-end gap-px" style={{ height: `${height}px` }}>
        {data.map((val, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all duration-300"
            style={{
              height: `${(val / max) * 100}%`,
              backgroundColor: barColor,
              opacity: 0.7 + (val / max) * 0.3,
              minWidth: "2px",
            }}
            title={`${i}:00 — ${val} visitors`}
          />
        ))}
      </div>
    </div>
  );
}

function SparkLine({
  data,
  width = 200,
  height = 40,
  color = "#a855f7",
  showArea = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
}) {
  if (data.length === 0) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 4;

  const points = data.map((val, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + ((max - val) / range) * (height - padding * 2),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {showArea && <path d={areaD} fill={color} fillOpacity={0.1} />}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
}

function DonutChart({
  segments,
  size = 120,
  thickness = 18,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="transform -rotate-90">
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * circumference;
          const offset = cumulativeOffset;
          cumulativeOffset += pct;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${pct} ${circumference - pct}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-400">{seg.label}</span>
            <span className="font-bold text-gray-200">{seg.value}</span>
            <span className="text-gray-600 text-[10px]">
              ({Math.round((seg.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  suffix = "",
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  suffix?: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-[11px] text-gray-400 truncate text-right">{label}</div>
      <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(pct, 2)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className="w-14 text-xs font-bold text-gray-300 text-right">
        {value}
        {suffix}
      </div>
    </div>
  );
}

function RatingRing({
  value,
  max = 100,
  size = 80,
  color,
}: {
  value: number;
  max?: number;
  size?: number;
  color: string;
}) {
  const pct = (value / max) * 100;
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#374151" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize="16"
        fontWeight="bold"
        className="transform rotate-90"
        style={{ transformOrigin: "center" }}
      >
        {value}
        {max === 100 ? "%" : ""}
      </text>
    </svg>
  );
}

/* ─────────────────────── FILTER BAR ─────────────────────── */

function FilterBar({
  filter,
  categories,
  events,
  updateTimeRange,
  updateCategory,
  updateSelectedEvent,
  resetFilters,
  exportCsv,
}: {
  filter: AttendanceFilterState;
  categories: string[];
  events: EventAttendanceSummary[];
  updateTimeRange: (r: TimeRange) => void;
  updateCategory: (c: string | null) => void;
  updateSelectedEvent: (id: string | null) => void;
  resetFilters: () => void;
  exportCsv: () => void;
}) {
  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Time Range */}
      <div className="flex bg-gray-100 dark:bg-gray-900/50 rounded-xl p-1 border border-gray-200 dark:border-gray-800">
        {timeRanges.map((tr) => (
          <button
            key={tr.value}
            onClick={() => updateTimeRange(tr.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter.timeRange === tr.value
                ? "bg-purple-600 text-white shadow-md"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tr.label}
          </button>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => updateCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
              (filter.category === null && cat === "All") || filter.category === cat
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                : "bg-gray-100 dark:bg-gray-900/30 text-gray-500 border border-gray-200 dark:border-gray-800 hover:border-gray-400"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Event Selector */}
      <select
        value={filter.selectedEventId || ""}
        onChange={(e) => updateSelectedEvent(e.target.value || null)}
        className="bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-500 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      >
        <option value="">All Events</option>
        {events.map((e) => (
          <option key={e.eventId} value={e.eventId}>
            {e.eventName}
          </option>
        ))}
      </select>

      <div className="flex-1" />

      {/* Actions */}
      <button
        onClick={resetFilters}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
      >
        Reset
      </button>
      <button
        onClick={exportCsv}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-md"
      >
        📥 Export CSV
      </button>
    </div>
  );
}

/* ─────────────────────── INSIGHTS CARD ─────────────────────── */

function InsightsPanel({ insights }: { insights: AttendanceInsight[] }) {
  const colorMap = {
    positive: "bg-emerald-500/10 border-emerald-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
    info: "bg-blue-500/10 border-blue-500/20",
    neutral: "bg-gray-500/10 border-gray-500/20",
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2">💡 Smart Insights</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight, i) => (
          <div key={i} className={`p-4 rounded-2xl border ${colorMap[insight.type]}`}>
            <div className="flex items-start gap-3">
              <span className="text-xl">{insight.icon}</span>
              <div className="flex-1">
                <div className="text-xs font-bold">{insight.title}</div>
                <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  {insight.description}
                </div>
                {insight.metric && (
                  <div className="mt-2 inline-block px-2 py-0.5 bg-white/5 rounded-md text-xs font-bold text-gray-300">
                    {insight.metric}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── TREND CHART ─────────────────────── */

function TrendChart({ trends }: { trends: AttendanceTrend[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxRsvp = Math.max(...trends.map((t) => t.rsvps), 1);
  const chartHeight = 160;
  const chartWidth = 100;

  const rsvpPoints = trends.map((t, i) => ({
    x: (i / (trends.length - 1)) * chartWidth,
    y: 100 - (t.rsvps / maxRsvp) * 80,
  }));

  const checkInPoints = trends.map((t, i) => ({
    x: (i / (trends.length - 1)) * chartWidth,
    y: 100 - (t.checkIns / maxRsvp) * 80,
  }));

  const rsvpPath = rsvpPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const checkInPath = checkInPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold">📈 Attendance Trends</h3>
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-purple-500 rounded" />
            <span className="text-gray-400">RSVPs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-emerald-500 rounded" />
            <span className="text-gray-400">Check-ins</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-red-400 rounded" />
            <span className="text-gray-400">No-shows</span>
          </div>
        </div>
      </div>

      <div
        className="relative"
        style={{ height: `${chartHeight}px` }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <div
            key={y}
            className="absolute w-full border-t border-gray-700/30"
            style={{ top: `${y}%` }}
          />
        ))}

        {/* SVG Lines */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          style={{ overflow: "visible" }}
        >
          <path
            d={rsvpPath}
            fill="none"
            stroke="#a855f7"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={checkInPath}
            fill="none"
            stroke="#22c55e"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Hover interaction columns */}
        {trends.map((t, i) => (
          <div
            key={i}
            className="absolute top-0 h-full cursor-pointer"
            style={{
              left: `${(i / (trends.length - 1)) * 100}%`,
              width: `${100 / trends.length}%`,
              transform: "translateX(-50%)",
            }}
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Hover tooltip */}
        {hoveredIdx !== null && trends[hoveredIdx] && (
          <div
            className="absolute z-10 bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-[10px] shadow-xl pointer-events-none"
            style={{
              left: `${(hoveredIdx / (trends.length - 1)) * 100}%`,
              top: "0",
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-bold text-gray-200">{trends[hoveredIdx].date}</div>
            <div className="text-purple-400 mt-1">RSVPs: {trends[hoveredIdx].rsvps}</div>
            <div className="text-emerald-400">Check-ins: {trends[hoveredIdx].checkIns}</div>
            <div className="text-red-400">No-shows: {trends[hoveredIdx].noShows}</div>
            <div className="text-amber-400 mt-0.5">Rate: {trends[hoveredIdx].checkInRate}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── ZONE HEATMAP ─────────────────────── */

function ZoneHeatmap({ zones }: { zones: ZoneAnalytics[] }) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const maxVisits = Math.max(...zones.map((z) => z.totalVisits), 1);
  const sortedZones = [...zones].sort((a, b) => b.totalVisits - a.totalVisits);

  return (
    <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
      <h3 className="text-sm font-bold mb-4">🗺️ Zone Check-in Heatmap</h3>

      <div className="space-y-2">
        {sortedZones.map((zone) => {
          const zoneInfo = ZONE_META[zone.zone] || {
            label: zone.zone,
            icon: "📍",
            color: "#a855f7",
          };
          const pct = (zone.totalVisits / maxVisits) * 100;

          return (
            <div
              key={zone.zone}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                selectedZone === zone.zone
                  ? "border-purple-500/50 bg-purple-500/5"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-700"
              }`}
              onClick={() => setSelectedZone(selectedZone === zone.zone ? null : zone.zone)}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{zoneInfo.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{zoneInfo.label}</span>
                    <span className="text-[10px] text-gray-500">
                      {zone.totalVisits.toLocaleString()} visits · {zone.averageDurationMinutes} min
                      avg
                    </span>
                  </div>
                  <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(pct, 3)}%`,
                        backgroundColor: zoneInfo.color,
                        opacity: 0.6 + (pct / 100) * 0.4,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold" style={{ color: zoneInfo.color }}>
                    {Math.round((zone.totalVisits / maxVisits) * 100)}%
                  </div>
                  <div className="text-[9px] text-gray-600">popularity</div>
                </div>
              </div>

              {selectedZone === zone.zone && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                    <span>Hourly Traffic Distribution</span>
                    <span>{zone.uniqueVisitors} unique visitors</span>
                  </div>
                  <MiniBarChart data={zone.hourlyTraffic} height={50} barColor={zoneInfo.color} />
                  <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                    <span>12AM</span>
                    <span>6AM</span>
                    <span>12PM</span>
                    <span>6PM</span>
                    <span>11PM</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ZONE_META: Record<string, { label: string; icon: string; color: string }> = {
  main_stage: { label: "Main Stage", icon: "🎤", color: "#a855f7" },
  workshop_a: { label: "Workshop A", icon: "💻", color: "#3b82f6" },
  workshop_b: { label: "Workshop B", icon: "🔬", color: "#06b6d4" },
  food_court: { label: "Food Court", icon: "🍕", color: "#f59e0b" },
  networking_lounge: { label: "Networking Lounge", icon: "🤝", color: "#22c55e" },
  exhibition_hall: { label: "Exhibition Hall", icon: "🖼️", color: "#ef4444" },
};

/* ─────────────────────── EVENT DETAIL TABLE ─────────────────────── */

function EventTable({
  events,
  onSelect,
  selectedId,
}: {
  events: EventAttendanceSummary[];
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}) {
  const [sortField, setSortField] = useState<keyof EventAttendanceSummary>("eventDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [events, sortField, sortDir]);

  const toggleSort = (field: keyof EventAttendanceSummary) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const columns: { key: keyof EventAttendanceSummary; label: string; width?: string }[] = [
    { key: "eventName", label: "Event", width: "30%" },
    { key: "eventDate", label: "Date", width: "12%" },
    { key: "totalRsvps", label: "RSVPs", width: "10%" },
    { key: "totalCheckedIn", label: "Checked In", width: "10%" },
    { key: "checkInRate", label: "Check-in %", width: "10%" },
    { key: "noShowRate", label: "No-show %", width: "10%" },
    { key: "averageStayMinutes", label: "Avg Stay", width: "10%" },
  ];

  return (
    <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
      <h3 className="text-sm font-bold mb-4">📋 Event Attendance Details</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left py-2 px-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider cursor-pointer hover:text-gray-300 transition select-none"
                  style={{ width: col.width }}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label} {sortField === col.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((event) => {
              const isSelected = selectedId === event.eventId;
              const rateColor =
                event.checkInRate >= 90
                  ? "text-emerald-400"
                  : event.checkInRate >= 80
                    ? "text-amber-400"
                    : "text-red-400";

              return (
                <tr
                  key={event.eventId}
                  className={`border-b border-gray-200/50 dark:border-gray-800/50 cursor-pointer transition-all ${
                    isSelected
                      ? "bg-purple-500/10 border-purple-500/20"
                      : "hover:bg-gray-200/50 dark:hover:bg-gray-800/50"
                  }`}
                  onClick={() => onSelect(isSelected ? null : event.eventId)}
                >
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-gray-200">{event.eventName}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {event.clubName} · {event.category}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-gray-400">{event.eventDate}</td>
                  <td className="py-2.5 px-3 text-gray-300 font-semibold">{event.totalRsvps}</td>
                  <td className="py-2.5 px-3 text-gray-300 font-semibold">
                    {event.totalCheckedIn}
                  </td>
                  <td className={`py-2.5 px-3 font-bold ${rateColor}`}>{event.checkInRate}%</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        event.noShowRate > 10
                          ? "bg-red-500/20 text-red-400"
                          : event.noShowRate > 7
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {event.noShowRate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-400">{event.averageStayMinutes}m</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm font-bold">No events match the current filters</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the time range or category</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── HOURLY HEATMAP ─────────────────────── */

function HourlyTrafficHeatmap({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
      <h3 className="text-sm font-bold mb-4">🕐 Hourly Traffic Distribution</h3>
      <div className="grid grid-cols-12 gap-1">
        {hours.map((hour) => {
          const val = data[hour] || 0;
          const intensity = val / max;
          const bg =
            intensity > 0.7
              ? "bg-purple-500"
              : intensity > 0.4
                ? "bg-purple-500/60"
                : intensity > 0.15
                  ? "bg-purple-500/30"
                  : "bg-purple-500/10";

          return (
            <div key={hour} className="text-center">
              <div
                className={`w-full aspect-square rounded-md ${bg} transition-all duration-300 hover:ring-2 hover:ring-purple-400/50`}
                title={`${hour}:00 — ${val} visitors`}
              />
              <div className="text-[8px] text-gray-600 mt-1">
                {hour % 3 === 0 ? `${hour}h` : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 text-[10px] text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-500/10" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-500/60" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── MAIN PAGE ─────────────────────── */

export default function AttendanceAnalyticsDashboard() {
  const analytics = useAttendanceAnalytics();
  const [activeTab, setActiveTab] = useState<"overview" | "zones" | "events" | "insights">(
    "overview",
  );

  const tabs = [
    { id: "overview" as const, label: "📊 Overview" },
    { id: "zones" as const, label: "🗺️ Zones" },
    { id: "events" as const, label: "📋 Events" },
    { id: "insights" as const, label: "💡 Insights" },
  ];

  return (
    <>
      <Helmet>
        <title>Attendance Analytics Dashboard — CampusConnect</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-mono font-bold uppercase text-purple-400">
              .campus analytics
            </span>
            <h1 className="text-2xl md:text-3xl font-black mt-1">
              📊 Attendance Analytics Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Track attendance patterns, RSVP trends, and zone engagement across{" "}
              {analytics.filteredEvents.length} events
            </p>
          </div>
        </div>

        {/* FILTERS */}
        <FilterBar
          filter={analytics.filter}
          categories={analytics.categories}
          events={analytics.MOCK_EVENTS}
          updateTimeRange={analytics.updateTimeRange}
          updateCategory={analytics.updateCategory}
          updateSelectedEvent={analytics.updateSelectedEvent}
          resetFilters={analytics.resetFilters}
          exportCsv={analytics.exportCsv}
        />

        {/* SUMMARY STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard
            label="Total RSVPs"
            value={analytics.aggregate.totalRsvps.toLocaleString()}
            icon="🎟️"
            color="purple"
          />
          <StatCard
            label="Checked In"
            value={analytics.aggregate.totalCheckedIn.toLocaleString()}
            icon="✅"
            color="emerald"
          />
          <StatCard
            label="Avg Check-in Rate"
            value={`${analytics.aggregate.averageCheckInRate}%`}
            icon="📈"
            color={analytics.aggregate.averageCheckInRate >= 88 ? "emerald" : "amber"}
          />
          <StatCard
            label="No-Show Rate"
            value={`${analytics.aggregate.averageNoShowRate}%`}
            icon="🚫"
            color={analytics.aggregate.averageNoShowRate <= 8 ? "emerald" : "red"}
          />
          <StatCard
            label="Avg Stay"
            value={`${analytics.aggregate.averageStayMinutes}m`}
            icon="⏱️"
            color="blue"
          />
          <StatCard
            label="Utilization"
            value={`${analytics.aggregate.utilizationRate}%`}
            icon="🏟️"
            color="cyan"
          />
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? "bg-purple-600 text-white shadow-lg"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════ OVERVIEW TAB ═══════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Trend Chart */}
            <TrendChart trends={analytics.trends} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Referral Breakdown */}
              <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-bold mb-4">📱 Referral Source Breakdown</h3>
                <DonutChart
                  segments={analytics.referralStats.map((rs) => {
                    const sourceInfo = analytics.REFERRAL_SOURCES[rs.source] || {
                      label: rs.source,
                      icon: "🔗",
                    };
                    const colors: Record<string, string> = {
                      organic: "#a855f7",
                      social: "#3b82f6",
                      email: "#f59e0b",
                      club_feed: "#22c55e",
                      search: "#06b6d4",
                    };
                    return {
                      value: rs.count,
                      color: colors[rs.source] || "#6b7280",
                      label: `${sourceInfo.icon} ${sourceInfo.label}`,
                    };
                  })}
                />
              </div>

              {/* Status Breakdown */}
              <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-bold mb-4">📋 Attendance Status</h3>
                <div className="space-y-3">
                  <HorizontalBar
                    label="✅ Checked In"
                    value={analytics.statusBreakdown.checked_in}
                    maxValue={Math.max(...Object.values(analytics.statusBreakdown), 1)}
                    color="#22c55e"
                  />
                  <HorizontalBar
                    label="🎟️ RSVP Only"
                    value={analytics.statusBreakdown.rsvped}
                    maxValue={Math.max(...Object.values(analytics.statusBreakdown), 1)}
                    color="#3b82f6"
                  />
                  <HorizontalBar
                    label="🚫 No Show"
                    value={analytics.statusBreakdown.no_show}
                    maxValue={Math.max(...Object.values(analytics.statusBreakdown), 1)}
                    color="#ef4444"
                  />
                  <HorizontalBar
                    label="❌ Cancelled"
                    value={analytics.statusBreakdown.cancelled}
                    maxValue={Math.max(...Object.values(analytics.statusBreakdown), 1)}
                    color="#6b7280"
                  />
                </div>
              </div>
            </div>

            {/* Hourly Traffic */}
            <HourlyTrafficHeatmap data={analytics.hourlyDistribution} />

            {/* Early Bird Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-3xl mb-2">🐦</div>
                <div className="text-2xl font-black text-purple-400">
                  {analytics.aggregate.earlyBirdRate}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Early Bird Rate</div>
                <div className="text-[10px] text-gray-600 mt-0.5">
                  {analytics.aggregate.totalEarlyBirds.toLocaleString()} early registrants
                </div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-3xl mb-2">🏆</div>
                <div className="text-2xl font-black text-emerald-400">
                  {analytics.aggregate.bestPerformingEvent?.checkInRate || 0}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Best Check-in Rate</div>
                <div className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[150px] mx-auto">
                  {analytics.aggregate.bestPerformingEvent?.eventName || "N/A"}
                </div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-3xl mb-2">⏱️</div>
                <div className="text-2xl font-black text-blue-400">
                  {analytics.aggregate.averageStayMinutes}m
                </div>
                <div className="text-xs text-gray-500 mt-1">Average Stay Duration</div>
                <div className="text-[10px] text-gray-600 mt-0.5">across all events</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ ZONES TAB ═══════════ */}
        {activeTab === "zones" && (
          <div className="space-y-6">
            <ZoneHeatmap zones={analytics.zoneAnalytics} />

            {/* Zone Comparison */}
            <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-bold mb-4">📊 Zone Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="text-left py-2 px-3 text-[10px] text-gray-500 font-semibold">
                        Zone
                      </th>
                      <th className="text-right py-2 px-3 text-[10px] text-gray-500 font-semibold">
                        Total Visits
                      </th>
                      <th className="text-right py-2 px-3 text-[10px] text-gray-500 font-semibold">
                        Unique Visitors
                      </th>
                      <th className="text-right py-2 px-3 text-[10px] text-gray-500 font-semibold">
                        Avg Duration
                      </th>
                      <th className="text-right py-2 px-3 text-[10px] text-gray-500 font-semibold">
                        Popularity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.zoneAnalytics
                      .sort((a, b) => b.totalVisits - a.totalVisits)
                      .map((zone) => {
                        const meta = ZONE_META[zone.zone] || {
                          label: zone.zone,
                          icon: "📍",
                          color: "#a855f7",
                        };
                        return (
                          <tr
                            key={zone.zone}
                            className="border-b border-gray-200/50 dark:border-gray-800/50"
                          >
                            <td className="py-2.5 px-3 font-bold text-gray-200">
                              {meta.icon} {meta.label}
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-300 font-semibold">
                              {zone.totalVisits.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-400">
                              {zone.uniqueVisitors.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-400">
                              {zone.averageDurationMinutes}m
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{
                                  backgroundColor: `${meta.color}20`,
                                  color: meta.color,
                                }}
                              >
                                {zone.popularityIndex}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Peak Hour per Zone */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {analytics.zoneAnalytics.map((zone) => {
                const meta = ZONE_META[zone.zone] || {
                  label: zone.zone,
                  icon: "📍",
                  color: "#a855f7",
                };
                const peakHour = zone.hourlyTraffic.indexOf(Math.max(...zone.hourlyTraffic));

                return (
                  <div
                    key={zone.zone}
                    className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center"
                  >
                    <div className="text-2xl mb-1">{meta.icon}</div>
                    <div className="text-xs font-bold text-gray-300">{meta.label}</div>
                    <div className="text-lg font-black mt-2" style={{ color: meta.color }}>
                      {peakHour}:00
                    </div>
                    <div className="text-[10px] text-gray-600">peak hour</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════ EVENTS TAB ═══════════ */}
        {activeTab === "events" && (
          <div className="space-y-6">
            <EventTable
              events={analytics.filteredEvents}
              onSelect={analytics.updateSelectedEvent}
              selectedId={analytics.filter.selectedEventId}
            />

            {/* Event Detail Card */}
            {analytics.filter.selectedEventId && (
              <EventDetailCard
                event={analytics.filteredEvents.find(
                  (e) => e.eventId === analytics.filter.selectedEventId,
                )}
              />
            )}
          </div>
        )}

        {/* ═══════════ INSIGHTS TAB ═══════════ */}
        {activeTab === "insights" && (
          <div className="space-y-6">
            <InsightsPanel insights={analytics.insights} />

            {/* Performance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-bold mb-3">🏆 Event Performance Rankings</h3>
                <div className="space-y-2">
                  {[...analytics.filteredEvents]
                    .sort((a, b) => b.checkInRate - a.checkInRate)
                    .map((event, i) => (
                      <div
                        key={event.eventId}
                        className="flex items-center gap-3 p-2.5 bg-gray-200 dark:bg-gray-800 rounded-xl"
                      >
                        <span className="text-lg font-bold text-gray-500 w-6">{i + 1}</span>
                        <div className="flex-1">
                          <div className="text-xs font-bold">{event.eventName}</div>
                          <div className="text-[10px] text-gray-500">
                            {event.clubName} · {event.totalRsvps} RSVPs
                          </div>
                        </div>
                        <RatingRing
                          value={Math.round(event.checkInRate)}
                          size={50}
                          color={
                            event.checkInRate >= 90
                              ? "#22c55e"
                              : event.checkInRate >= 80
                                ? "#f59e0b"
                                : "#ef4444"
                          }
                        />
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-bold mb-3">📊 Category Comparison</h3>
                <div className="space-y-3">
                  {Array.from(
                    analytics.filteredEvents.reduce((acc, e) => {
                      if (!acc.has(e.category)) acc.set(e.category, []);
                      acc.get(e.category)!.push(e);
                      return acc;
                    }, new Map<string, EventAttendanceSummary[]>()),
                  ).map(([category, events]) => {
                    const avgRate = events.reduce((s, e) => s + e.checkInRate, 0) / events.length;
                    const avgStay =
                      events.reduce((s, e) => s + e.averageStayMinutes, 0) / events.length;
                    const totalRsvps = events.reduce((s, e) => s + e.totalRsvps, 0);

                    const catColors: Record<string, string> = {
                      Technology: "#a855f7",
                      Cultural: "#f59e0b",
                      Career: "#3b82f6",
                      Social: "#22c55e",
                      Academic: "#06b6d4",
                    };

                    return (
                      <div key={category} className="p-3 bg-gray-200 dark:bg-gray-800 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold">{category}</span>
                          <span
                            className="text-xs font-bold"
                            style={{ color: catColors[category] || "#a855f7" }}
                          >
                            {events.length} events
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-sm font-bold text-gray-200">
                              {Math.round(avgRate)}%
                            </div>
                            <div className="text-[9px] text-gray-500">Check-in</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-200">
                              {Math.round(avgStay)}m
                            </div>
                            <div className="text-[9px] text-gray-500">Avg Stay</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-200">
                              {totalRsvps.toLocaleString()}
                            </div>
                            <div className="text-[9px] text-gray-500">RSVPs</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────── SHARED COMPONENTS ─────────────────────── */

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    purple: "text-purple-500",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    red: "text-red-500",
    blue: "text-blue-500",
    cyan: "text-cyan-500",
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
      <div className="text-xl mb-1">{icon}</div>
      <div className={`text-lg font-black ${colorMap[color] || "text-gray-500"}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function EventDetailCard({ event }: { event?: EventAttendanceSummary }) {
  if (!event) return null;

  return (
    <div className="bg-gray-100 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] text-purple-400 uppercase font-bold">Event Detail</div>
          <h3 className="text-lg font-black mt-1">{event.eventName}</h3>
          <div className="text-xs text-gray-500 mt-0.5">
            {event.clubName} · {event.category} · {event.eventDate}
          </div>
        </div>
        <RatingRing
          value={Math.round(event.checkInRate)}
          size={70}
          color={
            event.checkInRate >= 90 ? "#22c55e" : event.checkInRate >= 80 ? "#f59e0b" : "#ef4444"
          }
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-2xl font-black text-purple-400">{event.totalCapacity}</div>
          <div className="text-[10px] text-gray-500">Total Capacity</div>
        </div>
        <div>
          <div className="text-2xl font-black text-blue-400">{event.totalRsvps}</div>
          <div className="text-[10px] text-gray-500">RSVPs</div>
        </div>
        <div>
          <div className="text-2xl font-black text-emerald-400">{event.totalCheckedIn}</div>
          <div className="text-[10px] text-gray-500">Checked In</div>
        </div>
        <div>
          <div className="text-2xl font-black text-red-400">{event.totalNoShows}</div>
          <div className="text-[10px] text-gray-500">No Shows</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-gray-200 dark:bg-gray-800 rounded-xl text-center">
          <div className="text-sm font-bold text-emerald-400">{event.checkInRate}%</div>
          <div className="text-[9px] text-gray-500">Check-in Rate</div>
        </div>
        <div className="p-3 bg-gray-200 dark:bg-gray-800 rounded-xl text-center">
          <div className="text-sm font-bold text-red-400">{event.noShowRate}%</div>
          <div className="text-[9px] text-gray-500">No-Show Rate</div>
        </div>
        <div className="p-3 bg-gray-200 dark:bg-gray-800 rounded-xl text-center">
          <div className="text-sm font-bold text-blue-400">{event.averageStayMinutes}m</div>
          <div className="text-[9px] text-gray-500">Avg Stay</div>
        </div>
        <div className="p-3 bg-gray-200 dark:bg-gray-800 rounded-xl text-center">
          <div className="text-sm font-bold text-amber-400">{event.earlyBirdCount}</div>
          <div className="text-[9px] text-gray-500">Early Birds</div>
        </div>
      </div>

      {/* Referral Breakdown for this event */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <div className="text-xs font-bold mb-2 text-gray-400">Referral Breakdown</div>
        <div className="space-y-1.5">
          {Object.entries(event.referralBreakdown).map(([source, count]) => {
            const pct = Math.round((count / event.totalRsvps) * 100);
            return (
              <div key={source} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-16 text-right capitalize">
                  {source.replace("_", " ")}
                </span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400 w-10">
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
