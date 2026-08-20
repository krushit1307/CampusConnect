// src/hooks/useNoticeBoardPermits.ts
// -----------------------------------------------------------------------------
// Issue #3755 — Interactive Campus Notice Board Poster Permit & Takedown System
//
// Loads a board with its permits and derives occupancy, the pending queue, and
// the overdue-takedown list.
//
// The capacity decision is mirrored client-side (src/lib/noticeBoardPermits.ts)
// so a club sees "the board is full on the 8th — the earliest this fits is the
// 13th" while they are still filling the form, rather than getting a database
// error after submitting. The trigger in the migration remains the authority:
// this is a courtesy, not a substitute.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PERMIT_POLICY,
  buildOccupancy,
  clubTakedownRecords,
  evaluatePermitRequest,
  overdueTakedowns,
  peakOccupancyWindow,
  toDayString,
  utilisationRate,
  type ClubTakedownRecord,
  type NoticeBoard,
  type OccupancyDay,
  type PermitDecision,
  type PermitPolicy,
  type PosterPermit,
  type PermitStatus,
  type TakedownStatus,
} from "@/lib/noticeBoardPermits";

interface BoardRow {
  id: string;
  name: string;
  building: string;
  location_detail: string | null;
  slot_capacity: number;
  is_active: boolean;
  requires_approval: boolean;
  max_duration_days: number;
  max_concurrent_per_club: number;
  takedown_reminder_days: number;
}

interface PermitRow {
  id: string;
  board_id: string;
  club_id: string;
  title: string;
  starts_on: string;
  ends_on: string;
  slots_requested: number;
  status: PermitStatus;
  taken_down_at: string | null;
  clubs: { name: string } | null;
  takedown_owner_profile: { full_name: string | null } | null;
}

export interface UseNoticeBoardPermitsResult {
  board: NoticeBoard | null;
  policy: PermitPolicy;
  permits: PosterPermit[];
  occupancy: OccupancyDay[];
  /** Requests awaiting a manager's decision, oldest first. */
  pendingQueue: PosterPermit[];
  overdue: TakedownStatus[];
  clubRecords: ClubTakedownRecord[];
  peakWindow: ReturnType<typeof peakOccupancyWindow>;
  utilisation: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Dry-runs a request so the requester sees the verdict before submitting. */
  checkRequest: (request: {
    clubId: string;
    startsOn: string;
    endsOn: string;
    slotsRequested: number;
  }) => PermitDecision | null;
  recordTakedown: (permitId: string) => Promise<void>;
}

function toPermit(row: PermitRow): PosterPermit {
  return {
    id: row.id,
    boardId: row.board_id,
    clubId: row.club_id,
    clubName: row.clubs?.name ?? "Unknown club",
    title: row.title,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    slotsRequested: row.slots_requested,
    status: row.status,
    takedownOwnerName: row.takedown_owner_profile?.full_name ?? null,
    takenDownAt: row.taken_down_at,
  };
}

export function useNoticeBoardPermits(
  boardId: string | null | undefined,
  rangeStart: string,
  rangeEnd: string,
): UseNoticeBoardPermitsResult {
  const [board, setBoard] = useState<NoticeBoard | null>(null);
  const [policy, setPolicy] = useState<PermitPolicy>(DEFAULT_PERMIT_POLICY);
  const [permits, setPermits] = useState<PosterPermit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!boardId) return;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const [boardResult, permitResult] = await Promise.all([
        supabase
          .from("notice_boards")
          .select(
            "id, name, building, location_detail, slot_capacity, is_active, requires_approval, max_duration_days, max_concurrent_per_club, takedown_reminder_days",
          )
          .eq("id", boardId)
          .maybeSingle(),
        supabase
          .from("poster_permits")
          .select(
            "id, board_id, club_id, title, starts_on, ends_on, slots_requested, status, taken_down_at, clubs(name), takedown_owner_profile:profiles!poster_permits_takedown_owner_fkey(full_name)",
          )
          .eq("board_id", boardId)
          .order("starts_on", { ascending: true }),
      ]);

      if (boardResult.error) throw boardResult.error;
      if (permitResult.error) throw permitResult.error;

      if (!boardResult.data) {
        setBoard(null);
        setPermits([]);
        return;
      }

      const row = boardResult.data as BoardRow;
      setBoard({
        id: row.id,
        name: row.name,
        building: row.building,
        locationDetail: row.location_detail,
        slotCapacity: row.slot_capacity,
        isActive: row.is_active,
        requiresApproval: row.requires_approval,
      });
      // Policy is per board, so a busy canteen board can run tighter limits
      // than a quiet departmental corridor.
      setPolicy({
        maxDurationDays: row.max_duration_days,
        maxConcurrentPerClub: row.max_concurrent_per_club,
        takedownReminderDays: row.takedown_reminder_days,
      });

      setPermits(((permitResult.data ?? []) as unknown as PermitRow[]).map(toPermit));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load the notice board permits";
      setError(message);
      setBoard(null);
      setPermits([]);
    } finally {
      setIsLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  const occupancy = useMemo(
    () => (board ? buildOccupancy(board, permits, rangeStart, rangeEnd) : []),
    [board, permits, rangeStart, rangeEnd],
  );

  const pendingQueue = useMemo(
    () =>
      permits
        .filter((p) => p.status === "pending")
        .sort((a, b) => new Date(a.startsOn).getTime() - new Date(b.startsOn).getTime()),
    [permits],
  );

  const overdue = useMemo(() => overdueTakedowns(permits, new Date(), policy), [permits, policy]);

  const clubRecords = useMemo(
    () => clubTakedownRecords(permits, new Date(), policy),
    [permits, policy],
  );

  const peakWindow = useMemo(() => peakOccupancyWindow(occupancy), [occupancy]);

  const utilisation = useMemo(() => utilisationRate(occupancy), [occupancy]);

  const checkRequest = useCallback(
    (request: {
      clubId: string;
      startsOn: string;
      endsOn: string;
      slotsRequested: number;
    }): PermitDecision | null => {
      if (!board) return null;
      return evaluatePermitRequest(board, permits, request, policy);
    },
    [board, permits, policy],
  );

  const recordTakedown = useCallback(
    async (permitId: string) => {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("poster_permits")
        .update({ taken_down_at: new Date().toISOString() })
        .eq("id", permitId);

      if (updateError) {
        setError(updateError.message);
      }
      // Re-fetch either way: on success to pick up the trigger-set status, on
      // failure to make sure the board is not showing a stale takedown.
      await fetchBoard();
    },
    [fetchBoard],
  );

  return {
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
    refresh: fetchBoard,
    checkRequest,
    recordTakedown,
  };
}

/** Convenience: today's date as a YYYY-MM-DD string. */
export function todayString(): string {
  return toDayString(Date.now());
}
