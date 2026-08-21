// src/components/Notices/NoticeBoardOccupancy.tsx
// -----------------------------------------------------------------------------
// Issue #3755 — Interactive Campus Notice Board Poster Permit & Takedown System
//
// The board manager's view: a day-by-day occupancy strip showing how full the
// board is across a date range, the queue of pending requests, and the list of
// posters that have outlived their permit — each attributed to a named owner.
//
// That last list is the point. Facilities currently strips whole boards because
// they have no way to tell a live poster from a dead one; this gives them a
// list of exactly what should come down and who is responsible.
// -----------------------------------------------------------------------------

import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useNoticeBoardPermits } from "@/hooks/useNoticeBoardPermits";
import {
  formatDay,
  parseDay,
  takedownStateLabel,
  type OccupancyDay,
} from "@/lib/noticeBoardPermits";

export interface NoticeBoardOccupancyProps {
  boardId: string;
  rangeStart: string;
  rangeEnd: string;
}

function saturationClass(day: OccupancyDay): string {
  if (day.capacity <= 0) return "bg-white/10";
  const ratio = day.slotsUsed / day.capacity;
  if (ratio >= 1) return "bg-red-500/70";
  if (ratio >= 0.75) return "bg-amber-500/70";
  if (ratio > 0) return "bg-sky-500/60";
  return "bg-white/10";
}

export function NoticeBoardOccupancy({ boardId, rangeStart, rangeEnd }: NoticeBoardOccupancyProps) {
  const {
    board,
    policy,
    permits,
    occupancy,
    pendingQueue,
    overdue,
    clubRecords,
    peakWindow,
    utilisation,
    isLoading,
    error,
    refresh,
    recordTakedown,
  } = useNoticeBoardPermits(boardId, rangeStart, rangeEnd);

  const permitsById = useMemo(() => new Map(permits.map((p) => [p.id, p])), [permits]);

  const worstClub = useMemo(
    () =>
      clubRecords.find(
        (record) => record.complianceRate !== null && record.complianceRate < 0.75,
      ) ?? null,
    [clubRecords],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 p-10 text-sm text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading board occupancy…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-red-300">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Could not load this notice board
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

  if (!board) {
    return (
      <div className="rounded-xl border border-white/10 p-10 text-center text-sm text-white/60">
        This notice board could not be found.
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <CalendarDays className="h-5 w-5 text-sky-400" aria-hidden="true" />
            {board.name}
          </h2>
          <p className="mt-1 text-sm text-white/60">
            {board.building}
            {board.locationDetail ? ` · ${board.locationDetail}` : ""} · {board.slotCapacity} slot
            {board.slotCapacity === 1 ? "" : "s"}
          </p>
          {!board.isActive && (
            <p className="mt-1 text-xs text-amber-300">
              This board is not currently accepting postings.
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

      {/* Occupancy strip */}
      <div className="rounded-xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-white/40">
            Occupancy {formatDay(parseDay(rangeStart))} – {formatDay(parseDay(rangeEnd))}
          </p>
          <p className="text-xs text-white/50">
            {Math.round(utilisation * 100)}% of slot-days used
          </p>
        </div>

        {occupancy.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/60">No dates in range.</p>
        ) : (
          <div
            className="mt-3 flex gap-0.5 overflow-x-auto"
            role="img"
            aria-label={`Daily occupancy for ${board.name}`}
          >
            {occupancy.map((day) => (
              <div
                key={day.dayMs}
                className="flex min-w-[1.5rem] flex-1 flex-col items-center gap-1"
              >
                <div
                  className={`h-10 w-full rounded-sm ${saturationClass(day)}`}
                  title={`${formatDay(day.dayMs)}: ${day.slotsUsed} of ${day.capacity} slots`}
                />
                <span className="text-[0.6rem] text-white/30">
                  {new Date(day.dayMs).getUTCDate()}
                </span>
              </div>
            ))}
          </div>
        )}

        {peakWindow && peakWindow.slotsUsed > 0 && (
          <p className="mt-3 text-sm text-white/60">
            Busiest stretch: {formatDay(peakWindow.startMs)}
            {peakWindow.endMs !== peakWindow.startMs && ` – ${formatDay(peakWindow.endMs)}`} at{" "}
            {peakWindow.slotsUsed} of {board.slotCapacity} slots.
          </p>
        )}
      </div>

      {/* Overdue takedowns */}
      {overdue.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-red-300">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {overdue.length} poster{overdue.length === 1 ? "" : "s"} past its permit
          </p>
          <p className="mt-1 text-sm text-white/70">
            These should come down. Everything not on this list is authorised to stay up.
          </p>
          <ul className="mt-3 space-y-2">
            {overdue.map((status) => {
              const permit = permitsById.get(status.permitId);
              return (
                <li
                  key={status.permitId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/25 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                      {permit?.title ?? "Untitled poster"}
                      <span className="ml-2 text-xs text-white/40">{permit?.clubName}</span>
                    </p>
                    <p className="text-xs text-red-300">{status.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void recordTakedown(status.permitId)}
                    className="rounded-lg border border-white/15 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                  >
                    Mark removed
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Pending queue */}
      <div className="rounded-xl border border-white/10 p-4">
        <p className="flex items-center gap-2 font-medium text-white">
          <ClipboardList className="h-4 w-4 text-sky-400" aria-hidden="true" />
          Pending requests
          <span className="text-sm font-normal text-white/40">({pendingQueue.length})</span>
        </p>

        {pendingQueue.length === 0 ? (
          <p className="mt-3 text-sm text-white/60">No requests are waiting for a decision.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {pendingQueue.map((permit) => (
              <li
                key={permit.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{permit.title}</p>
                  <p className="text-xs text-white/50">
                    {permit.clubName} · {formatDay(parseDay(permit.startsOn))} –{" "}
                    {formatDay(parseDay(permit.endsOn))} · {permit.slotsRequested} slot
                    {permit.slotsRequested === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  {takedownStateLabel("scheduled")}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-white/40">
          Permits run for at most {policy.maxDurationDays} days, and each club may hold{" "}
          {policy.maxConcurrentPerClub} overlapping permit
          {policy.maxConcurrentPerClub === 1 ? "" : "s"} on this board.
        </p>
      </div>

      {/* Takedown compliance */}
      {worstClub && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-300">Takedown compliance</p>
          <p className="mt-1 text-sm text-white/70">
            {worstClub.clubName} has removed {Math.round((worstClub.complianceRate ?? 0) * 100)}% of
            its posters on time
            {worstClub.currentlyOverdue > 0 &&
              `, and has ${worstClub.currentlyOverdue} still up past expiry`}
            . Worth considering when reviewing their next request.
          </p>
        </div>
      )}
    </section>
  );
}

export default NoticeBoardOccupancy;
