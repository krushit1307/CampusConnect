import { type VenueScoreComparison } from "@/hooks/useVenueIntelligence";
import { TrendIndicator } from "./VenueIntelligenceDashboard";

// ─── Types ────────────────────────────────────────────────────────────

interface VenueRecommendationCardProps {
  comparison: VenueScoreComparison;
  rank: number;
  isSelected: boolean;
  onSelect: (venueId: string) => void;
  trendDirection?: "up" | "down" | "stable";
  costEstimate?: {
    subtotal: number;
    hourlyRate: number;
    notes: string[];
  };
}

// ─── Score Badge Color ────────────────────────────────────────────────

function getScoreBadgeClasses(score: number): string {
  if (score >= 90) return "bg-emerald-300 border-emerald-700 text-emerald-950";
  if (score >= 75) return "bg-lime-300 border-lime-700 text-lime-950";
  if (score >= 60) return "bg-yellow-300 border-yellow-700 text-yellow-950";
  if (score >= 40) return "bg-orange-300 border-orange-700 text-orange-950";
  return "bg-red-300 border-red-700 text-red-950";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent Match";
  if (score >= 75) return "Great Match";
  if (score >= 60) return "Good Match";
  if (score >= 40) return "Fair Match";
  return "Poor Match";
}

// ─── Component ────────────────────────────────────────────────────────

export function VenueRecommendationCard({
  comparison,
  rank,
  isSelected,
  onSelect,
  trendDirection,
  costEstimate,
}: VenueRecommendationCardProps) {
  const { breakdown, reasons, venueName, matchScore, estimatedCapacity } = comparison;

  const rankLabels = ["🥇", "🥈", "🥉"];
  const rankBg =
    rank === 0
      ? "bg-yellow-100 border-yellow-500"
      : rank === 1
        ? "bg-gray-100 border-gray-400"
        : rank === 2
          ? "bg-orange-50 border-orange-400"
          : "bg-white border-black";

  return (
    <div
      className={`neu-border p-5 transition-all cursor-pointer ${
        isSelected ? "bg-blue-50 border-blue-600 shadow-[6px_6px_0_0_#2563eb]" : rankBg
      } hover:-translate-y-1`}
      onClick={() => onSelect(comparison.venueId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(comparison.venueId);
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{rankLabels[rank] || `#${rank + 1}`}</span>
          <div>
            <h3 className="font-display text-lg font-black">{venueName}</h3>
            <p className="font-mono text-xs text-black/50">Capacity: {estimatedCapacity} seats</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`neu-border px-3 py-1 font-mono text-sm font-black ${getScoreBadgeClasses(matchScore)}`}
          >
            {matchScore}%
          </span>
          <span className="font-mono text-[9px] text-black/50 uppercase">
            {getScoreLabel(matchScore)}
          </span>
          {trendDirection && <TrendIndicator direction={trendDirection} />}
        </div>
      </div>

      {/* Score Breakdown Bars */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
        <ScoreBar label="Capacity Fit" value={breakdown.capacityFit} />
        <ScoreBar label="Amenities" value={breakdown.amenityMatch} />
        <ScoreBar label="Utilization" value={breakdown.utilizationEfficiency} />
        <ScoreBar label="Satisfaction" value={breakdown.satisfaction} />
        <ScoreBar label="Cost" value={breakdown.costEfficiency} />
        <ScoreBar label="Availability" value={breakdown.scheduleAvailability} />
      </div>

      {/* Reasons */}
      <div className="mb-3">
        <p className="font-mono text-[10px] font-bold uppercase text-black/40 mb-1">
          Why this venue?
        </p>
        <ul className="space-y-1">
          {reasons.map((r, i) => (
            <li key={i} className="font-mono text-xs text-black/70 flex items-start gap-1.5">
              <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Cost Estimate */}
      {costEstimate && (
        <div className="border-t-2 border-dashed border-black/20 pt-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase text-black/40">Est. Cost</span>
            <span className="font-mono text-sm font-black">
              {costEstimate.subtotal === 0 ? (
                <span className="text-emerald-700">FREE</span>
              ) : (
                `$${costEstimate.subtotal}`
              )}
            </span>
          </div>
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="mt-3 bg-blue-600 text-white text-center py-1.5 font-mono text-xs font-bold uppercase">
          ✓ Selected for comparison
        </div>
      )}
    </div>
  );
}

// ─── Score Bar Sub-component ──────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const barColor =
    value >= 80
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-lime-500"
        : value >= 40
          ? "bg-yellow-500"
          : "bg-orange-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-mono text-[10px] text-black/50 uppercase">{label}</span>
        <span className="font-mono text-[10px] font-bold">{value}</span>
      </div>
      <div className="h-1.5 bg-black/10 border border-black/20 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
