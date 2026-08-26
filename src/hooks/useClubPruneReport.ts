// src/hooks/useClubPruneReport.ts
// -----------------------------------------------------------------------------
// Issue: #3682 — Implement 'Automated "Inactive Member" Purge'
//
// React hook that fetches the most recent purge report for a club.
// Also exposes a `triggerDryRun` action so the President can preview
// what the next purge would do without actually archiving anyone.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClubPruneReport, PurgeSummary } from "@/lib/clubPurge";

export interface UseClubPruneReportResult {
  report: ClubPruneReport | null;
  isLoading: boolean;
  error: string | null;
  triggerDryRun: () => Promise<PurgeSummary | null>;
  isDryRunLoading: boolean;
  refresh: () => Promise<void>;
}

export function useClubPruneReport(
  clubId: string | null | undefined,
): UseClubPruneReportResult {
  const supabase = createClient();
  const [report, setReport] = useState<ClubPruneReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!clubId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_club_prune_report",
        { p_club_id: clubId },
      );
      if (rpcError) throw rpcError;
      setReport(data as ClubPruneReport);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load purge report";
      setError(msg);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [clubId, supabase]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const triggerDryRun = useCallback(async (): Promise<PurgeSummary | null> => {
    if (!clubId) return null;
    setIsDryRunLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "prune_club_rosters",
        { p_dry_run: true, p_inactivity_threshold_months: 18 },
      );
      if (rpcError) throw rpcError;
      await fetchReport();
      return data as PurgeSummary;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to run dry-run purge";
      setError(msg);
      return null;
    } finally {
      setIsDryRunLoading(false);
    }
  }, [clubId, supabase, fetchReport]);

  return {
    report,
    isLoading,
    error,
    triggerDryRun,
    isDryRunLoading,
    refresh: fetchReport,
  };
}
