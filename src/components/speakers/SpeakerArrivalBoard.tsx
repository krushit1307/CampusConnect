// src/components/speakers/SpeakerArrivalBoard.tsx
// -----------------------------------------------------------------------------
// Issue #3753 — Automated Speaker Travel Itinerary & Arrival Buffer Coordination
//
// The organiser's arrival board: every inbound speaker, sorted by how likely
// they are to miss their own session, each showing the buffer and the specific
// reason it is flagged. The arithmetic breakdown is expandable, because an
// organiser will not act on "11:25" unless they can see why a 09:15 landing
// becomes an 11:25 campus arrival.
// -----------------------------------------------------------------------------

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  PlaneLanding,
  RefreshCw,
  UserX,
} from "lucide-react";
import { useArrivalBoard } from "@/hooks/useArrivalBoard";
import {
  bandLabel,
  explainArrival,
  formatBuffer,
  formatClock,
  modeLabel,
  type ArrivalProjection,
  type ArrivalRiskBand,
  type ItineraryDirection,
} from "@/lib/speakerItinerary";

export interface SpeakerArrivalBoardProps {
  eventId: string;
  direction?: ItineraryDirection;
}

const BAND_CARD: Record<ArrivalRiskBand, string> = {
  comfortable: "border-emerald-500/30 bg-emerald-500/5",
  tight: "border-amber-500/40 bg-amber-500/5",
  critical: "border-orange-500/50 bg-orange-500/5",
  will_miss: "border-red-500/60 bg-red-500/10",
};

const BAND_BADGE: Record<ArrivalRiskBand, string> = {
  comfortable: "bg-emerald-500/15 text-emerald-400",
  tight: "bg-amber-500/15 text-amber-400",
  critical: "bg-orange-500/15 text-orange-400",
  will_miss: "bg-red-500/15 text-red-400",
};

function ItineraryCard({
  projection,
  onReportDelay,
}: {
  projection: ArrivalProjection;
  onReportDelay: (legId: string, minutes: number) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(
    projection.band === "will_miss" || projection.band === "critical",
  );

  return (
    <li className={`rounded-xl border p-4 ${BAND_CARD[projection.band]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-white">{projection.speakerName}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND_BADGE[projection.band]}`}
            >
              {bandLabel(projection.band)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-white/50">
            Due on site {formatClock(projection.callTime)}
            {projection.hostName ? ` · host ${projection.hostName}` : " · no host assigned"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-white">
            {formatBuffer(projection.bufferMinutes)}
          </p>
          <p className="text-xs text-white/50">
            {projection.projectedCampusArrival
              ? `on campus ${formatClock(projection.projectedCampusArrival)}`
              : "arrival unknown"}
          </p>
        </div>
      </div>

      {projection.flagReason && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {projection.flagReason}
        </p>
      )}

      {!projection.flagReason && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Arriving with room to spare.
        </p>
      )}

      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="mt-3 inline-flex items-center gap-1 text-sm text-sky-400 hover:underline"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isExpanded ? "Hide journey" : "Show journey"}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          <ol className="space-y-2">
            {projection.legs.map((leg) => (
              <li
                key={leg.id}
                className={`rounded-lg border p-3 ${
                  leg.connectionMissed ? "border-red-500/50 bg-red-500/5" : "border-white/10"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white">
                    <span className="text-white/50">{leg.sequence}.</span> {leg.origin} →{" "}
                    {leg.destination}
                    <span className="ml-2 text-xs text-white/40">
                      {modeLabel(leg.mode)}
                      {leg.carrier ? ` · ${leg.carrier}` : ""}
                      {leg.reference ? ` ${leg.reference}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-white/60">
                    {formatClock(leg.projectedDeparture)} – {formatClock(leg.projectedArrival)}
                    {leg.totalDelayMinutes > 0 && (
                      <span className="ml-1 text-amber-300">(+{leg.totalDelayMinutes}m)</span>
                    )}
                  </p>
                </div>

                {leg.connectionMissed && (
                  <p className="mt-1 text-xs text-red-300">
                    This connection is no longer achievable.
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-white/50" htmlFor={`delay-${leg.id}`}>
                    Delay (min)
                  </label>
                  <input
                    id={`delay-${leg.id}`}
                    type="number"
                    defaultValue={leg.delayMinutes}
                    onBlur={(e) => {
                      const value = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(value) && value !== leg.delayMinutes) {
                        onReportDelay(leg.id, value);
                      }
                    }}
                    className="w-20 rounded border border-white/15 bg-black/20 px-2 py-1 text-sm text-white"
                  />
                </div>
              </li>
            ))}
          </ol>

          {/* The arithmetic, spelled out. */}
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs uppercase tracking-wide text-white/40">
              How this arrival was calculated
            </p>
            <ul className="mt-1 space-y-0.5">
              {explainArrival(projection).map((step) => (
                <li key={step} className="text-sm text-white/70">
                  {step}
                </li>
              ))}
            </ul>
          </div>

          {projection.problems.length > 0 && (
            <ul className="space-y-1">
              {projection.problems.map((problem) => (
                <li
                  key={`${problem.kind}-${problem.legIds.join("-")}`}
                  className="text-xs text-amber-300/90"
                >
                  {problem.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function SpeakerArrivalBoard({ eventId, direction = "inbound" }: SpeakerArrivalBoardProps) {
  const { projections, atRisk, unhosted, isLoading, error, refresh, reportDelay } = useArrivalBoard(
    eventId,
    direction,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 p-10 text-sm text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Projecting speaker arrivals…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-red-300">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Could not load the arrival board
        </p>
        <p className="mt-1 text-sm text-white/60">{error}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  if (projections.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 p-10 text-center text-sm text-white/60">
        No {direction} speaker journeys have been recorded for this event yet.
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <PlaneLanding className="h-5 w-5 text-sky-400" aria-hidden="true" />
            Speaker arrivals
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/60">
            Projected campus arrival accounts for delays, immigration and baggage, and the ground
            transfer — not just the landing time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </header>

      {atRisk.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-300">
            {atRisk.length} of {projections.length} journeys need attention
          </p>
          <p className="mt-1 text-sm text-white/70">
            {atRisk
              .slice(0, 3)
              .map((p) => p.speakerName)
              .join(", ")}
            {atRisk.length > 3 ? ` and ${atRisk.length - 3} more` : ""}.
          </p>
        </div>
      )}

      {unhosted.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-amber-300/90">
          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
          {unhosted.length} speaker{unhosted.length === 1 ? " has" : "s have"} no host assigned to
          meet them.
        </p>
      )}

      <ul className="space-y-3">
        {projections.map((projection) => (
          <ItineraryCard
            key={projection.itineraryId}
            projection={projection}
            onReportDelay={(legId, minutes) => void reportDelay(legId, minutes)}
          />
        ))}
      </ul>
    </section>
  );
}

export default SpeakerArrivalBoard;
