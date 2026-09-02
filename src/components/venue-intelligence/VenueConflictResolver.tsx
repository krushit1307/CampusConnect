import type { DetectedConflict } from "@/lib/venue-intelligence/venueScoringEngine";

// ─── Types ────────────────────────────────────────────────────────────

interface VenueConflictResolverProps {
  conflicts: DetectedConflict[];
  onDismiss?: (index: number) => void;
}

// ─── Severity Styling ─────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; border: string; badge: string; icon: string }> =
  {
    high: {
      bg: "bg-red-50",
      border: "border-red-500",
      badge: "bg-red-500 text-white",
      icon: "🔴",
    },
    medium: {
      bg: "bg-amber-50",
      border: "border-amber-400",
      badge: "bg-amber-400 text-black",
      icon: "🟡",
    },
    low: {
      bg: "bg-sky-50",
      border: "border-sky-400",
      badge: "bg-sky-400 text-white",
      icon: "🔵",
    },
  };

// ─── Helper ───────────────────────────────────────────────────────────

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Component ────────────────────────────────────────────────────────

export function VenueConflictResolver({ conflicts, onDismiss }: VenueConflictResolverProps) {
  if (conflicts.length === 0) {
    return (
      <div className="neu-border bg-emerald-50 p-6 text-center">
        <p className="font-display text-xl font-black text-emerald-800">✓ No Conflicts</p>
        <p className="font-mono text-xs text-emerald-700/70 mt-2">
          All upcoming bookings have non-overlapping schedules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="neu-border bg-red-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-display text-lg font-black text-red-900">
              {conflicts.length} Booking Conflict{conflicts.length !== 1 ? "s" : ""} Detected
            </p>
            <p className="font-mono text-xs text-red-700/70">
              Resolve scheduling overlaps before they impact event quality.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(["high", "medium", "low"] as const).map((sev) => {
            const count = conflicts.filter((c) => c.severity === sev).length;
            if (count === 0) return null;
            return (
              <span
                key={sev}
                className={`font-mono text-[10px] font-bold uppercase px-2 py-1 ${SEVERITY_STYLES[sev].badge}`}
              >
                {count} {sev}
              </span>
            );
          })}
        </div>
      </div>

      {/* Conflict cards */}
      {conflicts.map((conflict, idx) => {
        const style = SEVERITY_STYLES[conflict.severity];
        return (
          <div
            key={idx}
            className={`neu-border ${style.bg} ${style.border} p-4 transition-all hover:-translate-y-0.5`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{style.icon}</span>
                <div>
                  <h4 className="font-mono text-sm font-black uppercase">
                    {conflict.booking1.eventName}
                  </h4>
                  <p className="font-mono text-[10px] text-black/50">vs.</p>
                  <h4 className="font-mono text-sm font-black uppercase">
                    {conflict.booking2.eventName}
                  </h4>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 ${style.badge}`}
                >
                  {conflict.severity}
                </span>
                <p className="font-mono text-[10px] text-black/50 mt-1">
                  {formatMinutes(conflict.overlapMinutes)} overlap
                </p>
              </div>
            </div>

            {/* Time details */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-white border border-black/10 p-2">
                <p className="font-mono text-[9px] text-black/40 uppercase">Event A</p>
                <p className="font-mono text-xs font-bold">
                  {conflict.booking1.startTime} – {conflict.booking1.endTime}
                </p>
                <p className="font-mono text-[10px] text-black/50">{conflict.booking1.date}</p>
              </div>
              <div className="bg-white border border-black/10 p-2">
                <p className="font-mono text-[9px] text-black/40 uppercase">Event B</p>
                <p className="font-mono text-xs font-bold">
                  {conflict.booking2.startTime} – {conflict.booking2.endTime}
                </p>
                <p className="font-mono text-[10px] text-black/50">{conflict.booking2.date}</p>
              </div>
            </div>

            {/* Suggested resolution */}
            <div className="bg-white border border-dashed border-black/30 p-3">
              <p className="font-mono text-[10px] font-bold uppercase text-black/40 mb-1">
                💡 Suggested Resolution
              </p>
              <p className="font-mono text-xs text-black/70">
                {conflict.overlapMinutes >= 60
                  ? `Consider rescheduling "${conflict.booking2.eventName}" to a later time slot, or moving one event to an alternative venue.`
                  : `Short overlap of ${formatMinutes(conflict.overlapMinutes)}. Coordinate start/end times between organizers to eliminate the gap.`}
              </p>
            </div>

            {onDismiss && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(idx);
                }}
                className="mt-3 font-mono text-[10px] font-bold uppercase text-black/40 hover:text-black/70 underline"
              >
                Dismiss
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
