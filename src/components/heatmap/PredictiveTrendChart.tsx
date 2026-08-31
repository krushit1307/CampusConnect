/**
 * PredictiveTrendChart — Visualizes weekly RSVP trends with linear
 * regression predictions and confidence bands for future weeks.
 */

import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Info } from "lucide-react";
import { WeeklyTrendPoint, PredictionPoint } from "@/hooks/useCampusActivityInsights";

interface PredictiveTrendChartProps {
  weeklyTrends: WeeklyTrendPoint[];
  predictions: PredictionPoint[];
}

export function PredictiveTrendChart({ weeklyTrends, predictions }: PredictiveTrendChartProps) {
  const allPoints = [
    ...weeklyTrends.map((t) => ({
      label: t.label,
      value: t.rsvps,
      isPrediction: false,
    })),
    ...predictions.map((p) => ({
      label: p.label,
      value: p.predictedRsvps,
      isPrediction: true,
    })),
  ];

  const maxVal = Math.max(
    ...allPoints.map((p) => p.value),
    ...predictions.map((p) => p.upperBound),
    1,
  );

  const chartHeight = 200;
  const barWidth = `${100 / allPoints.length}%`;

  const historicalPoints = weeklyTrends
    .map((t, i) => {
      const x = (i / (allPoints.length - 1)) * 100;
      const y = chartHeight - (t.rsvps / maxVal) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const predictionLinePoints = predictions
    .map((p, i) => {
      const idx = weeklyTrends.length + i;
      const x = (idx / (allPoints.length - 1)) * 100;
      const y = chartHeight - (p.predictedRsvps / maxVal) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const bandTop = predictions
    .map((p, i) => {
      const idx = weeklyTrends.length + i;
      const x = (idx / (allPoints.length - 1)) * 100;
      const y = chartHeight - (p.upperBound / maxVal) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const bandBottom = predictions
    .map((p, i) => {
      const idx = weeklyTrends.length + i;
      const x = (idx / (allPoints.length - 1)) * 100;
      const y = chartHeight - (p.lowerBound / maxVal) * chartHeight;
      return `${x},${y}`;
    })
    .reverse()
    .join(" ");

  const dividerX =
    weeklyTrends.length > 0 ? ((weeklyTrends.length - 0.5) / (allPoints.length - 1)) * 100 : 50;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <TrendingUp className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">RSVP Trend & Forecast</h3>
            <p className="text-[10px] text-gray-500">
              Historical data + linear regression prediction
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Sparkles className="w-3 h-3 text-violet-400" />
          {predictions.length > 0 && <span>Confidence: {predictions[0].confidence}%</span>}
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: chartHeight + 40 }}>
        <svg
          viewBox={`0 0 100 ${chartHeight}`}
          className="w-full"
          preserveAspectRatio="none"
          style={{ height: chartHeight }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              y1={chartHeight * (1 - ratio)}
              x2="100"
              y2={chartHeight * (1 - ratio)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.3"
            />
          ))}

          {/* Confidence band */}
          {bandTop && bandBottom && (
            <polygon
              points={`${bandTop} ${bandBottom}`}
              fill="rgba(139, 92, 246, 0.08)"
              stroke="none"
            />
          )}

          {/* Historical trend line */}
          <polyline
            points={historicalPoints}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="0.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Prediction trend line (dashed) */}
          {predictionLinePoints &&
            weeklyTrends.length > 0 &&
            (() => {
              const lastIdx = weeklyTrends.length - 1;
              const lx = (lastIdx / (allPoints.length - 1)) * 100;
              const ly = chartHeight - (weeklyTrends[lastIdx].rsvps / maxVal) * chartHeight;
              return (
                <polyline
                  points={`${lx},${ly} ${predictionLinePoints}`}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="0.8"
                  strokeDasharray="2,1.5"
                  strokeLinejoin="round"
                />
              );
            })()}

          {/* Divider line */}
          <line
            x1={dividerX}
            y1="0"
            x2={dividerX}
            y2={chartHeight}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.3"
            strokeDasharray="1.5,1"
          />

          {/* Historical data points */}
          {weeklyTrends.map((t, i) => {
            const x = (i / (allPoints.length - 1)) * 100;
            const y = chartHeight - (t.rsvps / maxVal) * chartHeight;
            return (
              <circle
                key={`hist-${i}`}
                cx={x}
                cy={y}
                r="1"
                fill="#06b6d4"
                stroke="rgba(6, 182, 212, 0.3)"
                strokeWidth="0.5"
              />
            );
          })}

          {/* Prediction data points */}
          {predictions.map((p, i) => {
            const idx = weeklyTrends.length + i;
            const x = (idx / (allPoints.length - 1)) * 100;
            const y = chartHeight - (p.predictedRsvps / maxVal) * chartHeight;
            return (
              <g key={`pred-${i}`}>
                <circle
                  cx={x}
                  cy={y}
                  r="1.2"
                  fill="#a855f7"
                  stroke="rgba(168, 85, 247, 0.3)"
                  strokeWidth="0.5"
                />
                <circle
                  cx={x}
                  cy={chartHeight - (p.upperBound / maxVal) * chartHeight}
                  r="0.4"
                  fill="none"
                  stroke="rgba(168, 85, 247, 0.4)"
                  strokeWidth="0.3"
                />
                <circle
                  cx={x}
                  cy={chartHeight - (p.lowerBound / maxVal) * chartHeight}
                  r="0.4"
                  fill="none"
                  stroke="rgba(168, 85, 247, 0.4)"
                  strokeWidth="0.3"
                />
              </g>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1">
          {allPoints.map((p, i) => (
            <div
              key={i}
              className={`text-[8px] text-center ${p.isPrediction ? "text-violet-400/70" : "text-gray-500"}`}
              style={{ width: barWidth }}
            >
              {p.label.replace("Week ", "W")}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-cyan-500 rounded" />
          <span className="text-[10px] text-gray-400">Historical RSVPs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="2" viewBox="0 0 12 2">
            <line
              x1="0"
              y1="1"
              x2="12"
              y2="1"
              stroke="#a855f7"
              strokeWidth="1"
              strokeDasharray="2,1.5"
            />
          </svg>
          <span className="text-[10px] text-gray-400">Predicted Trend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 bg-violet-500/10 rounded border border-violet-500/20" />
          <span className="text-[10px] text-gray-400">95% Confidence</span>
        </div>
      </div>

      {/* Prediction Summary Cards */}
      {predictions.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {predictions.slice(0, 4).map((p, i) => (
            <motion.div
              key={p.week}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="bg-white/5 rounded-xl p-3 border border-violet-500/10"
            >
              <div className="text-[9px] text-violet-400 font-medium mb-1">{p.label}</div>
              <div className="text-white text-sm font-bold">
                {p.predictedRsvps.toLocaleString()}
              </div>
              <div className="text-[9px] text-gray-500">
                Range: {p.lowerBound.toLocaleString()}–{p.upperBound.toLocaleString()}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Methodology Note */}
      <div className="flex items-start gap-1.5 mt-3 text-[9px] text-gray-600">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          Predictions use simple linear regression on weekly RSVP totals. Confidence intervals widen
          for later forecasts. Actual results may vary based on event quality, marketing, and
          external factors.
        </span>
      </div>
    </div>
  );
}
