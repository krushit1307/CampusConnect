// src/hooks/useConstitutionTimeline.ts
// -----------------------------------------------------------------------------
// Issue #3690 — Interactive "Club Constitution" Version Timeline
//
// React hook that loads the constitution timeline for a club and
// exposes:
//   - the raw archived versions (oldest first)
//   - normalized TimelineStop[] for the slider
//   - the currently-selected version (the one the slider is on)
//   - the "current" (latest) version, for the "Compare to Current" button
//   - a setSelectedVersionNumber() setter for programmatic navigation
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildTimelineStops,
  type ArchivedConstitution,
  type TimelineStop,
} from "@/lib/constitutionTimeline";

export interface UseConstitutionTimelineResult {
  versions: ArchivedConstitution[];
  stops: TimelineStop[];
  selectedVersion: ArchivedConstitution | null;
  currentVersion: ArchivedConstitution | null;
  selectVersion: (versionNumber: number) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useConstitutionTimeline(
  clubId: string | null | undefined,
): UseConstitutionTimelineResult {
  const [versions, setVersions] = useState<ArchivedConstitution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<
    number | null
  >(null);

  const fetchTimeline = useCallback(async () => {
    if (!clubId) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc(
        "get_constitution_timeline",
        { p_club_id: clubId },
      );
      if (rpcError) throw rpcError;
      const rows = (data ?? []) as ArchivedConstitution[];
      setVersions(rows);
      const current =
        rows.find((v) => v.is_current) ?? rows[rows.length - 1] ?? null;
      setSelectedVersionNumber(current?.version_number ?? null);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load constitution timeline";
      setError(msg);
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  const stops = useMemo(() => buildTimelineStops(versions), [versions]);

  const selectedVersion = useMemo(() => {
    if (selectedVersionNumber == null) return null;
    return (
      versions.find((v) => v.version_number === selectedVersionNumber) ?? null
    );
  }, [versions, selectedVersionNumber]);

  const currentVersion = useMemo(() => {
    return versions.find((v) => v.is_current) ?? null;
  }, [versions]);

  const selectVersion = useCallback((versionNumber: number) => {
    setSelectedVersionNumber(versionNumber);
  }, []);

  return {
    versions,
    stops,
    selectedVersion,
    currentVersion,
    selectVersion,
    isLoading,
    error,
    refresh: fetchTimeline,
  };
}
