// src/components/Safety/ResponderCoverageTimeline.tsx
// -----------------------------------------------------------------------------
// Issue #3754 — Dynamic Certified First-Aid Responder Coverage Planner
//
// The coverage timeline. A band per responder shows when they are on duty, an
// aggregate line shows qualified cover against the required threshold, and gaps
// are rendered as unmissable red intervals with their duration spelled out.
//
// The design principle throughout: a gap must be impossible to miss at a
// glance, because the entire failure mode this feature exists to prevent is
// "nobody noticed until an incident".
// -----------------------------------------------------------------------------

import { useMemo } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useResponderCoverage } from "@/hooks/useResponderCoverage";
import {
  complianceVerdict,
  formatClock,
  formatMinutes,
  levelLabel,
  tierLabel,
  verdictSummary,
  type CoverageGap,
} from "@/lib/responderCoverage";

export interface ResponderCoverageTimelineProps {
  eventId: string;
}

const GAP_LABEL: Record<CoverageGap["kind"], string> = {
  no_cover: "No cover",
  under_staffed: "Short-staffed",
  under_certified: "Under-certified",
};

export function ResponderCoverageTimeline({ eventId }: ResponderCoverageTimelineProps) {
  const { assessment, effectiveTier, analysis, duties, isLoading, error, refresh } =
    useResponderCoverage(eventId);

  const windowBounds = useMemo(() => {
    if (!assessment) return null;
    const start = new Date(assessment.coverage_starts_at).getTime();
    const end = new Date(assessment.coverage_ends_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return null;
    }
    return { start, end, span: end - start };
  }, [assessment]);

  const pct = (ms: number) => {
    if (!windowBounds) return 0;
    return ((ms - windowBounds.start) / windowBounds.span) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 p-10 text-sm text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking responder coverage…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-red-300">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Could not load the coverage roster
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

  if (!assessment || !analysis || !effectiveTier || !windowBounds) {
    return (
      <div className="rounded-xl border border-white/10 p-10 text-center text-sm text-white/60">
        No safety assessment has been recorded for this event. Set the expected attendance, activity
        type, and coverage window to begin planning.
      </div>
    );
  }

  const verdict = complianceVerdict(analysis);
  const isCompliant = verdict === "compliant";

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck className="h-5 w-5 text-sky-400" aria-hidden="true" />
            First-aid coverage
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/60">
            {tierLabel(effectiveTier)} — requires {analysis.requirement.requiredConcurrent}{" "}
            concurrent {levelLabel(analysis.requirement.minimumLevel).toLowerCase()} responder
            {analysis.requirement.requiredConcurrent === 1 ? "" : "s"} from{" "}
            {formatClock(windowBounds.start)} to {formatClock(windowBounds.end)}.
          </p>
          {assessment.override_tier && (
            <p className="mt-1 text-xs text-amber-300/90">
              Tier manually overridden: {assessment.override_reason}
            </p>
          )}
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

      {/* Verdict */}
      <div
        role={isCompliant ? undefined : "alert"}
        className={`rounded-xl border p-4 ${
          isCompliant ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/50 bg-red-500/10"
        }`}
      >
        <p
          className={`flex items-center gap-2 text-sm font-medium ${
            isCompliant ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {isCompliant ? (
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <AlertOctagon className="h-4 w-4" aria-hidden="true" />
          )}
          {isCompliant ? "Coverage is compliant" : "Coverage is not compliant"}
        </p>
        <p className="mt-1 text-sm text-white/70">{verdictSummary(analysis)}</p>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-white/10 p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-white/40">Duty timeline</p>

        {duties.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/60">
            Nobody is rostered. The entire event window is uncovered.
          </p>
        ) : (
          <ul className="space-y-2">
            {duties.map((duty) => {
              const start = new Date(duty.startsAt).getTime();
              const end = new Date(duty.endsAt).getTime();
              const left = Math.max(0, pct(start));
              const right = Math.min(100, pct(end));
              return (
                <li
                  key={duty.id}
                  className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3"
                >
                  <p className="truncate text-sm text-white">
                    {duty.responderName}
                    {duty.station && (
                      <span className="block text-xs text-white/40">{duty.station}</span>
                    )}
                  </p>
                  <div className="relative h-5 rounded bg-white/5">
                    <div
                      className="absolute inset-y-0 rounded bg-sky-500/70"
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(right - left, 0.5)}%`,
                      }}
                      title={`${formatClock(start)} – ${formatClock(end)}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Aggregate coverage against the requirement */}
        <div className="mt-4 grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3">
          <p className="text-sm font-medium text-white">Qualified cover</p>
          <div
            className="relative h-6 overflow-hidden rounded bg-white/5"
            role="img"
            aria-label={`Coverage across the event window with ${analysis.gaps.length} gaps`}
          >
            {analysis.slices.map((slice) => {
              const left = pct(slice.startMs);
              const width = pct(slice.endMs) - left;
              const isShort = slice.qualifiedCount < analysis.requirement.requiredConcurrent;
              return (
                <div
                  key={`${slice.startMs}-${slice.endMs}`}
                  className={`absolute inset-y-0 ${
                    isShort ? "bg-red-500/70" : "bg-emerald-500/60"
                  }`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.2)}%` }}
                  title={`${formatClock(slice.startMs)}: ${slice.qualifiedCount} of ${slice.requiredCount} required`}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex justify-between text-xs text-white/40">
          <span>{formatClock(windowBounds.start)}</span>
          <span>{formatClock(windowBounds.end)}</span>
        </div>
      </div>

      {/* Gaps */}
      {analysis.gaps.length > 0 && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-300">
            {analysis.gaps.length} coverage gap
            {analysis.gaps.length === 1 ? "" : "s"} — {formatMinutes(analysis.totalGapMinutes)}{" "}
            total
          </p>
          <ul className="mt-2 space-y-2">
            {analysis.gaps.map((gap) => (
              <li key={`${gap.startMs}-${gap.endMs}`} className="rounded-lg bg-black/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white">
                    {formatClock(gap.startMs)} – {formatClock(gap.endMs)}
                  </p>
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">
                    {GAP_LABEL[gap.kind]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/70">{gap.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Certification lapses during the event */}
      {analysis.expiringDuringEvent.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Certification lapses during this event
          </p>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {analysis.expiringDuringEvent.map((entry) => (
              <li key={`${entry.responderId}-${entry.expiresAtMs}`}>
                {entry.responderName}&apos;s certification expires at{" "}
                {formatClock(entry.expiresAtMs)} — they stop counting toward cover from that moment.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fragile handovers */}
      {analysis.fragileHandovers.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-300">
            {analysis.fragileHandovers.length} handover
            {analysis.fragileHandovers.length === 1 ? "" : "s"} with no overlap
          </p>
          <p className="mt-1 text-sm text-white/70">
            These blocks abut exactly, so cover is technically continuous but depends on the
            incoming responder arriving to the minute.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-white/60">
            {analysis.fragileHandovers.map((handover) => (
              <li key={`${handover.atMs}-${handover.incomingResponderId}`}>
                Handover at {formatClock(handover.atMs)} with no overlap window.
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default ResponderCoverageTimeline;
