// src/components/Volunteers/ShiftRiskDashboard.tsx
// -----------------------------------------------------------------------------
// Issue #3751 — Dynamic Volunteer Shift Reliability Score & No-Show Risk Forecast
//
// The coordinator's view of the shift board, sorted by how likely each shift is
// to come up short on the day. The headline number is *forecast attendance*,
// not signup count, because the signup count is the number that has been
// lying to coordinators all along.
// -----------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, UserMinus, Users } from "lucide-react";
import { useVolunteerReliability } from "@/hooks/useVolunteerReliability";
import {
  bandLabel,
  explainForecast,
  formatScorePercent,
  riskLabel,
  type ReliabilityBand,
  type ShiftForecast,
  type StaffingRisk,
} from "@/lib/volunteerReliability";

export interface ShiftRiskDashboardProps {
  eventId: string;
  clubId: string;
  eventTitle?: string;
}

const RISK_STYLES: Record<StaffingRisk, string> = {
  healthy: "border-emerald-500/40 bg-emerald-500/5",
  thin: "border-amber-500/40 bg-amber-500/5",
  at_risk: "border-orange-500/50 bg-orange-500/5",
  critical: "border-red-500/60 bg-red-500/10",
};

const RISK_BADGE: Record<StaffingRisk, string> = {
  healthy: "bg-emerald-500/15 text-emerald-400",
  thin: "bg-amber-500/15 text-amber-400",
  at_risk: "bg-orange-500/15 text-orange-400",
  critical: "bg-red-500/15 text-red-400",
};

const BAND_BADGE: Record<ReliabilityBand, string> = {
  exemplary: "bg-emerald-500/15 text-emerald-400",
  reliable: "bg-sky-500/15 text-sky-400",
  watch: "bg-amber-500/15 text-amber-400",
  at_risk: "bg-red-500/15 text-red-400",
};

function formatShiftWindow(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Time not set";
  }
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  return `${dateLabel}, ${start.toLocaleTimeString(undefined, timeOpts)} – ${end.toLocaleTimeString(undefined, timeOpts)}`;
}

function ForecastBar({ forecast }: { forecast: ShiftForecast }) {
  // Two overlaid bars: signups (faint) against forecast attendance (solid).
  // The visible difference between them is the whole point of the feature.
  const denominator = Math.max(
    forecast.capacity,
    forecast.signupCount,
    forecast.expectedAttendance,
    1,
  );
  const signupPct = (forecast.signupCount / denominator) * 100;
  const expectedPct = (forecast.expectedAttendance / denominator) * 100;
  const capacityPct = (forecast.capacity / denominator) * 100;

  return (
    <div
      className="relative mt-3 h-3 w-full rounded-full bg-white/5"
      role="img"
      aria-label={`${forecast.signupCount} signed up, ${forecast.expectedAttendance} forecast to attend, ${forecast.capacity} needed`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-white/15"
        style={{ width: `${signupPct}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-sky-400/80"
        style={{ width: `${expectedPct}%` }}
      />
      {/* The capacity line — everything left of it is the hole. */}
      <div
        className="absolute inset-y-[-4px] w-0.5 bg-white/70"
        style={{ left: `${capacityPct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

export function ShiftRiskDashboard({ eventId, clubId, eventTitle }: ShiftRiskDashboardProps) {
  const {
    forecasts,
    volunteers,
    atRiskVolunteers,
    understaffedShifts,
    totalForecastGap,
    isLoading,
    error,
    refresh,
  } = useVolunteerReliability(eventId, clubId);

  const [showAllVolunteers, setShowAllVolunteers] = useState(false);

  const visibleVolunteers = useMemo(() => {
    if (showAllVolunteers) {
      return [...volunteers].sort((a, b) => a.profile.score - b.profile.score);
    }
    return atRiskVolunteers;
  }, [showAllVolunteers, volunteers, atRiskVolunteers]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 p-10 text-sm text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Forecasting shift attendance…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-red-300">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Could not load the staffing forecast
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

  if (forecasts.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 p-10 text-center text-sm text-white/60">
        No volunteer shifts have been created for this event yet.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Users className="h-5 w-5 text-sky-400" aria-hidden="true" />
            Shift staffing forecast
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/60">
            {eventTitle ? `${eventTitle} — ` : ""}forecast attendance is the sum of each
            assignee&apos;s reliability score, so a shift can be &ldquo;full&rdquo; on paper and
            still come up short.
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

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Shifts at risk</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {understaffedShifts.length}
            <span className="ml-1 text-base font-normal text-white/40">/ {forecasts.length}</span>
          </p>
        </div>
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Forecast shortfall</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {totalForecastGap}
            <span className="ml-1 text-base font-normal text-white/40">volunteers</span>
          </p>
        </div>
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Assignees to chase</p>
          <p className="mt-1 text-2xl font-semibold text-white">{atRiskVolunteers.length}</p>
        </div>
      </div>

      {/* Shift list, worst first */}
      <ul className="space-y-3">
        {forecasts.map((forecast) => (
          <li
            key={forecast.shiftId}
            className={`rounded-xl border p-4 ${RISK_STYLES[forecast.risk]}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-medium text-white">{forecast.shiftTitle}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${RISK_BADGE[forecast.risk]}`}
                  >
                    {riskLabel(forecast.risk)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-white/50">
                  {formatShiftWindow(forecast.startTime, forecast.endTime)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-white">
                  <span className="text-lg font-semibold">{forecast.expectedAttendance}</span>
                  <span className="text-white/50"> / {forecast.capacity}</span>
                </p>
                <p className="text-xs text-white/50">{forecast.signupCount} signed up</p>
              </div>
            </div>

            <ForecastBar forecast={forecast} />

            <p className="mt-3 text-sm text-white/70">{explainForecast(forecast)}</p>

            {forecast.recommendedBackups > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Recruit {forecast.recommendedBackups} backup
                {forecast.recommendedBackups === 1 ? "" : "s"} to close this gap.
              </p>
            )}

            {forecast.risk === "healthy" && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                No action needed.
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Volunteers worth chasing */}
      <div className="rounded-xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-medium text-white">
            <UserMinus className="h-4 w-4 text-amber-400" aria-hidden="true" />
            {showAllVolunteers ? "All assignees" : "Assignees to confirm"}
          </h3>
          <button
            type="button"
            onClick={() => setShowAllVolunteers((prev) => !prev)}
            className="text-sm text-sky-400 hover:underline"
          >
            {showAllVolunteers ? "Show only at-risk" : "Show everyone"}
          </button>
        </div>

        {visibleVolunteers.length === 0 ? (
          <p className="mt-3 text-sm text-white/60">
            Every assignee on this event has a solid attendance record.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {visibleVolunteers.map(({ userId, displayName, profile }) => (
              <li key={userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{displayName}</p>
                  <p className="text-xs text-white/50">
                    {profile.counts.attended} attended · {profile.counts.no_show} missed
                    {profile.currentNoShowStreak > 1 &&
                      ` · ${profile.currentNoShowStreak} in a row`}
                    {profile.isProvisional && " · new volunteer"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {formatScorePercent(profile.score)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND_BADGE[profile.band]}`}
                  >
                    {bandLabel(profile.band)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-white/40">
          Reliability scores are visible to club coordinators only, and are never shown to the
          volunteers themselves.
        </p>
      </div>
    </section>
  );
}

export default ShiftRiskDashboard;
