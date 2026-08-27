// src/components/Clubs/ClubPruneReportPanel.tsx
// -----------------------------------------------------------------------------
// Issue: #3682 — Implement 'Automated "Inactive Member" Purge'
//
// Renders the President-facing purge summary panel. Visible only when
// the current user is an admin of the club (enforced by the
// get_club_prune_report RPC, which raises on non-admins).
// -----------------------------------------------------------------------------

import { useMemo } from "react";
import { Sparkles, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useClubPruneReport } from "@/hooks/useClubPruneReport";
import {
  formatPruneSummary,
  formatRelativeRunTime,
  isReportStale,
} from "@/lib/clubPurge";

export interface ClubPruneReportPanelProps {
  clubId: string;
}

export function ClubPruneReportPanel({ clubId }: ClubPruneReportPanelProps) {
  const {
    report,
    isLoading,
    error,
    isDryRunLoading,
    triggerDryRun,
    refresh,
  } = useClubPruneReport(clubId);

  const summaryText = useMemo(() => {
    if (!report) return "";
    return formatPruneSummary(report);
  }, [report]);

  const relativeTime = useMemo(() => {
    return formatRelativeRunTime(report?.ran_at);
  }, [report]);

  const stale = useMemo(() => isReportStale(report), [report]);

  const handleDryRun = async () => {
    const result = await triggerDryRun();
    if (result) {
      const myClubSlice = result.per_club.find((p) => p.club_id === clubId);
      const count = myClubSlice?.members_archived ?? 0;
      if (count === 0) {
        toast.success(
          "Dry-run complete — no inactive members would be archived right now.",
        );
      } else {
        toast.info(
          `Dry-run complete: ${count} inactive ${count === 1 ? "member" : "members"} would be archived in the next purge.`,
        );
      }
    }
  };

  if (isLoading) {
    return (
      <div
        className="neu-border bg-white p-4 flex items-center gap-2"
        data-testid="club-prune-report-loading"
      >
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        <span className="font-mono text-sm text-gray-600">
          Loading purge report…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="neu-border bg-red-50 p-4 border-red-400"
        data-testid="club-prune-report-error"
      >
        <p className="font-mono text-sm text-red-800">
          Could not load the purge report: {error}
        </p>
      </div>
    );
  }

  return (
    <div
      className="neu-border bg-white p-5 space-y-3"
      data-testid="club-prune-report-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h3 className="font-display text-lg font-bold uppercase tracking-tight">
            Roster Pruning Report
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="flex items-center gap-1 border-2 border-black bg-gray-100 px-2 py-1 font-mono text-xs font-bold uppercase hover:bg-gray-200"
          aria-label="Refresh report"
          data-testid="prune-report-refresh"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {/* Stale warning */}
      {stale && report && (
        <div
          className="flex items-center gap-2 border-2 border-amber-400 bg-amber-50 p-2"
          data-testid="prune-report-stale-warning"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <p className="font-mono text-xs text-amber-800">
            The last purge ran {relativeTime}. The nightly cron may be paused.
          </p>
        </div>
      )}

      {/* Summary sentence */}
      {report && (
        <p
          className="font-mono text-sm text-gray-800 leading-relaxed"
          data-testid="prune-report-summary"
        >
          {summaryText}
        </p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-gray-600">
        {report && (
          <span data-testid="prune-report-last-run">
            Last run: <strong className="text-gray-800">{relativeTime}</strong>
          </span>
        )}
        {report && report.dry_run && (
          <span className="border border-amber-400 bg-amber-50 px-2 py-0.5 text-amber-700">
            (last run was a dry-run)
          </span>
        )}
      </div>

      {/* Effects list */}
      <div
        className="border-t border-gray-200 pt-3"
        data-testid="prune-report-effects"
      >
        <p className="font-mono text-xs uppercase text-gray-500 mb-2">
          Archived members no longer:
        </p>
        <ul className="font-mono text-xs text-gray-700 space-y-1">
          <li>• count toward your public "Total Members" badge</li>
          <li>• receive push notifications or weekly digest emails</li>
          <li>• appear in the active member directory</li>
        </ul>
      </div>

      {/* Dry-run action */}
      <div className="flex items-center gap-2 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={handleDryRun}
          disabled={isDryRunLoading}
          className="flex items-center gap-2 border-2 border-black bg-purple-300 px-3 py-1.5 font-mono text-xs font-bold uppercase hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="prune-report-dry-run-btn"
        >
          {isDryRunLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Running preview…
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              Run dry-run preview
            </>
          )}
        </button>
        <span className="font-mono text-[10px] text-gray-400">
          Preview only — no members are archived.
        </span>
      </div>
    </div>
  );
}
