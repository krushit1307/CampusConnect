// src/hooks/useVolunteerReliability.ts
// -----------------------------------------------------------------------------
// Issue #3751 — Dynamic Volunteer Shift Reliability Score & No-Show Risk Forecast
//
// Loads an event's shift board together with the reliability profiles of every
// volunteer assigned to it, and exposes the risk-sorted forecast the
// coordinator dashboard renders.
//
// The forecast maths runs client-side (src/lib/volunteerReliability.ts) from
// the profiles returned by the RPC. That split is deliberate: the server owns
// the scoring — because reliability history must never reach the browser of a
// non-coordinator — while the cheap aggregation over already-authorised
// profiles happens locally, so tweaking a shift's capacity in the UI
// re-forecasts instantly without another round trip.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_RELIABILITY_CONFIG,
  bandForScore,
  forecastShiftBoard,
  type ReliabilityBand,
  type ReliabilityProfile,
  type ShiftAssignmentSummary,
  type ShiftForecast,
} from "@/lib/volunteerReliability";

/** Row shape returned by the `get_volunteer_reliability` RPC. */
interface ReliabilityRow {
  user_id: string;
  score: number | string;
  band: string;
  weighted_total: number | string;
  weighted_credit: number | string;
  counted_outcomes: number;
  attended_count: number;
  late_count: number;
  no_show_count: number;
  excused_count: number;
  cancelled_count: number;
  current_no_show_streak: number;
  is_provisional: boolean;
  last_outcome_at: string | null;
}

interface ShiftRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  capacity: number;
  shift_assignments: Array<{ user_id: string }> | null;
}

export interface VolunteerSummary {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  profile: ReliabilityProfile;
}

export interface UseVolunteerReliabilityResult {
  forecasts: ShiftForecast[];
  profiles: Map<string, ReliabilityProfile>;
  volunteers: VolunteerSummary[];
  /** Volunteers in the two weakest bands, worst first. */
  atRiskVolunteers: VolunteerSummary[];
  /** Shifts forecast to come up short, worst first. */
  understaffedShifts: ShiftForecast[];
  totalForecastGap: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Postgres NUMERIC arrives over PostgREST as a string to preserve precision.
 * Everything downstream does arithmetic, so coerce once at the boundary.
 */
function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function rowToProfile(row: ReliabilityRow): ReliabilityProfile {
  const score = toNumber(row.score);
  return {
    userId: row.user_id,
    score,
    // Trust our own band mapping rather than the string from the RPC, so the
    // client and server can never disagree about where a threshold sits.
    band: bandForScore(score),
    weightedTotal: toNumber(row.weighted_total),
    weightedCredit: toNumber(row.weighted_credit),
    counts: {
      attended: row.attended_count ?? 0,
      late: row.late_count ?? 0,
      no_show: row.no_show_count ?? 0,
      excused: row.excused_count ?? 0,
      cancelled_in_time: row.cancelled_count ?? 0,
    },
    countedOutcomes: row.counted_outcomes ?? 0,
    currentNoShowStreak: row.current_no_show_streak ?? 0,
    // The RPC does not compute attendance streaks — the dashboard only needs
    // the no-show run to decide who to chase.
    currentAttendedStreak: 0,
    isProvisional: Boolean(row.is_provisional),
    lastOutcomeAt: row.last_outcome_at,
  };
}

const BAND_SEVERITY: Record<ReliabilityBand, number> = {
  at_risk: 0,
  watch: 1,
  reliable: 2,
  exemplary: 3,
};

export function useVolunteerReliability(
  eventId: string | null | undefined,
  clubId: string | null | undefined,
): UseVolunteerReliabilityResult {
  const [shifts, setShifts] = useState<ShiftAssignmentSummary[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ReliabilityProfile>>(() => new Map());
  const [names, setNames] = useState<
    Map<string, { displayName: string; avatarUrl: string | null }>
  >(() => new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!eventId || !clubId) return;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: shiftData, error: shiftError } = await supabase
        .from("event_shifts")
        .select("id, title, start_time, end_time, capacity, shift_assignments(user_id)")
        .eq("event_id", eventId)
        .order("start_time", { ascending: true });

      if (shiftError) throw shiftError;

      const rows = (shiftData ?? []) as unknown as ShiftRow[];
      const summaries: ShiftAssignmentSummary[] = rows.map((row) => ({
        shiftId: row.id,
        shiftTitle: row.title,
        startTime: row.start_time,
        endTime: row.end_time,
        capacity: row.capacity,
        assigneeIds: (row.shift_assignments ?? []).map((a) => a.user_id),
      }));
      setShifts(summaries);

      const assigneeIds = Array.from(new Set(summaries.flatMap((s) => s.assigneeIds)));

      if (assigneeIds.length === 0) {
        setProfiles(new Map());
        setNames(new Map());
        return;
      }

      // Reliability profiles and display names are independent reads; there is
      // no reason to make the coordinator wait for them serially.
      const [reliabilityResult, profileResult] = await Promise.all([
        supabase.rpc("get_volunteer_reliability", {
          p_club_id: clubId,
          p_user_ids: assigneeIds,
        }),
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", assigneeIds),
      ]);

      if (reliabilityResult.error) throw reliabilityResult.error;
      if (profileResult.error) throw profileResult.error;

      const nextProfiles = new Map<string, ReliabilityProfile>();
      for (const row of (reliabilityResult.data ?? []) as ReliabilityRow[]) {
        nextProfiles.set(row.user_id, rowToProfile(row));
      }
      setProfiles(nextProfiles);

      const nextNames = new Map<string, { displayName: string; avatarUrl: string | null }>();
      for (const row of (profileResult.data ?? []) as Array<{
        id: string;
        full_name: string | null;
        avatar_url: string | null;
      }>) {
        nextNames.set(row.id, {
          displayName: row.full_name ?? "Unnamed volunteer",
          avatarUrl: row.avatar_url,
        });
      }
      setNames(nextNames);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load volunteer reliability data";
      setError(message);
      setShifts([]);
      setProfiles(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [eventId, clubId]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  const forecasts = useMemo(
    () => forecastShiftBoard(shifts, profiles, DEFAULT_RELIABILITY_CONFIG),
    [shifts, profiles],
  );

  const volunteers = useMemo<VolunteerSummary[]>(() => {
    return Array.from(profiles.values()).map((profile) => {
      const name = names.get(profile.userId);
      return {
        userId: profile.userId,
        displayName: name?.displayName ?? "Unnamed volunteer",
        avatarUrl: name?.avatarUrl ?? null,
        profile,
      };
    });
  }, [profiles, names]);

  const atRiskVolunteers = useMemo(
    () =>
      volunteers
        .filter((v) => v.profile.band === "at_risk" || v.profile.band === "watch")
        .sort((a, b) => {
          const bySeverity = BAND_SEVERITY[a.profile.band] - BAND_SEVERITY[b.profile.band];
          if (bySeverity !== 0) return bySeverity;
          return a.profile.score - b.profile.score;
        }),
    [volunteers],
  );

  const understaffedShifts = useMemo(
    () => forecasts.filter((f) => f.risk !== "healthy"),
    [forecasts],
  );

  const totalForecastGap = useMemo(
    () => Math.round(forecasts.reduce((sum, f) => sum + f.forecastGap, 0) * 100) / 100,
    [forecasts],
  );

  return {
    forecasts,
    profiles,
    volunteers,
    atRiskVolunteers,
    understaffedShifts,
    totalForecastGap,
    isLoading,
    error,
    refresh: fetchBoard,
  };
}
