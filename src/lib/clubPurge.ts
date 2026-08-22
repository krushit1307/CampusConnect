// src/lib/clubPurge.ts
// -----------------------------------------------------------------------------
// Issue: #3682 — Implement 'Automated "Inactive Member" Purge'
//
// TypeScript types + pure helpers for the club roster purge feature.
// Kept framework-agnostic (no React, no Supabase imports) so the
// helpers can be unit-tested in isolation.
// -----------------------------------------------------------------------------

/** Shape returned by the `prune_club_rosters()` RPC. */
export interface PurgeSummary {
  dry_run: boolean;
  inactivity_threshold_months: number;
  cutoff: string;
  total_archived: number;
  clubs_touched: number;
  per_club: Array<{
    club_id: string;
    club_name: string;
    members_archived: number;
  }>;
}

/** Shape returned by `get_club_prune_report(club_id)`. */
export interface ClubPruneReport {
  club_id: string;
  members_archived: number;
  dry_run: boolean;
  ran_at: string;
  run_id: number;
  message?: string;
}

/**
 * Formats the President's summary string:
 *   "We pruned 120 inactive members from your roster to improve your
 *    engagement metrics."
 */
export function formatPruneSummary(report: ClubPruneReport): string {
  if (report.members_archived === 0) {
    return "No inactive members were pruned in the latest run.";
  }
  const memberWord = report.members_archived === 1 ? "member" : "members";
  return `We pruned ${report.members_archived} inactive ${memberWord} from your roster to improve your engagement metrics.`;
}

/**
 * Formats the relative time of the last run, e.g. "ran 2 hours ago" /
 * "ran yesterday" / "ran 3 days ago". Returns "never" when the run_at
 * timestamp is missing.
 */
export function formatRelativeRunTime(
  isoTimestamp: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!isoTimestamp) return "never";
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return "never";
  const diffMs = now.getTime() - then;
  if (diffMs < 0) return "just now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `ran ${min} minute${min === 1 ? "" : "s"} ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `ran ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ran yesterday";
  if (days < 30) return `ran ${days} days ago`;
  const months = Math.floor(days / 30);
  return `ran ${months} month${months === 1 ? "" : "s"} ago`;
}

/**
 * Returns true if the latest run is "stale" — older than 36 hours.
 * The cron runs every 24h, so a 36h+ gap suggests the cron is
 * misconfigured or paused. Uses strict > (36h exactly is NOT stale).
 */
export function isReportStale(
  report: ClubPruneReport | null,
  now: Date = new Date(),
): boolean {
  if (!report?.ran_at) return true;
  const then = new Date(report.ran_at).getTime();
  if (Number.isNaN(then)) return true;
  const diffMs = now.getTime() - then;
  return diffMs > 36 * 60 * 60 * 1000;
}
