import { useMemo } from "react";
import type { DayOfWeek } from "@/hooks/useVenueAnalytics";

// ─── Types ────────────────────────────────────────────────────────────

interface HeatmapCell {
  hour: number;
  day: DayOfWeek;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapCell[];
  width?: number;
  height?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getHeatColor(value: number): string {
  if (value >= 90) return "#1e1b4b"; // indigo-950 — peak
  if (value >= 75) return "#312e81"; // indigo-900
  if (value >= 60) return "#4338ca"; // indigo-700
  if (value >= 45) return "#6366f1"; // indigo-500
  if (value >= 30) return "#818cf8"; // indigo-400
  if (value >= 15) return "#a5b4fc"; // indigo-300
  if (value >= 5) return "#c7d2fe"; // indigo-200
  return "#e0e7ff"; // indigo-100 — idle
}

function getLabelColor(value: number): string {
  return value >= 60 ? "#ffffff" : "#312e81";
}

// ─── Component ────────────────────────────────────────────────────────

export function VenueHeatmapChart({ data, width = 700, height = 320 }: HeatmapChartProps) {
  const cellW = Math.floor((width - 80) / 24);
  const cellH = Math.floor((height - 60) / 7);
  const labelX = 70;
  const labelY = 40;

  const cellsByDay = useMemo(() => {
    const map = new Map<DayOfWeek, HeatmapCell[]>();
    for (const d of DAYS) map.set(d, []);
    for (const cell of data) {
      map.get(cell.day)?.push(cell);
    }
    return map;
  }, [data]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto font-mono"
        role="img"
        aria-label="Venue booking heatmap by hour and day"
      >
        {/* Hour labels */}
        {hours.map((h) => (
          <text
            key={`h-${h}`}
            x={labelX + h * cellW + cellW / 2}
            y={labelY - 8}
            textAnchor="middle"
            className="fill-current text-[9px] font-bold"
            style={{ fontFamily: "monospace" }}
          >
            {String(h).padStart(2, "0")}
          </text>
        ))}

        {/* Day labels + cells */}
        {DAYS.map((day, dayIdx) => (
          <g key={day}>
            <text
              x={labelX - 8}
              y={labelY + dayIdx * cellH + cellH / 2 + 3}
              textAnchor="end"
              className="fill-current text-[10px] font-bold"
              style={{ fontFamily: "monospace" }}
            >
              {day}
            </text>
            {hours.map((h) => {
              const cell = cellsByDay.get(day)?.find((c) => c.hour === h);
              const value = cell?.value ?? 0;
              return (
                <g key={`${day}-${h}`}>
                  <rect
                    x={labelX + h * cellW + 1}
                    y={labelY + dayIdx * cellH + 1}
                    width={cellW - 2}
                    height={cellH - 2}
                    rx={2}
                    fill={getHeatColor(value)}
                    stroke="#000"
                    strokeWidth={0.5}
                    className="transition-colors"
                  >
                    <title>{`${day} ${String(h).padStart(2, "0")}:00 — ${value}% utilization`}</title>
                  </rect>
                  {cellW >= 22 && (
                    <text
                      x={labelX + h * cellW + cellW / 2}
                      y={labelY + dayIdx * cellH + cellH / 2 + 3}
                      textAnchor="middle"
                      className="text-[7px] pointer-events-none"
                      fill={getLabelColor(value)}
                      style={{ fontFamily: "monospace" }}
                    >
                      {value}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────

const LEGEND_STEPS = [
  { label: "0–5%", color: getHeatColor(0) },
  { label: "5–15%", color: getHeatColor(10) },
  { label: "15–30%", color: getHeatColor(20) },
  { label: "30–45%", color: getHeatColor(35) },
  { label: "45–60%", color: getHeatColor(50) },
  { label: "60–75%", color: getHeatColor(65) },
  { label: "75–90%", color: getHeatColor(82) },
  { label: "90%+", color: getHeatColor(95) },
];

export function HeatmapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 font-mono text-[10px]">
      <span className="font-bold uppercase text-black/50 mr-1">Utilization:</span>
      {LEGEND_STEPS.map((s) => (
        <div key={s.label} className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 border border-black/30 rounded-sm"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-black/60">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
