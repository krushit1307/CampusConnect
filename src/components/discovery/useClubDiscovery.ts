import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";

/** A single club card in the discovery deck. */
export interface DiscoveryClub {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  banner_url?: string | null;
  logo_url?: string | null;
  member_count?: number | null;
}

export interface UseClubDiscoveryOptions {
  /** Current user id; used to exclude clubs they've already joined. */
  userId: string | null;
  /** Number of clubs to fetch per page. Defaults to 10 per issue #1903 spec. */
  pageSize?: number;
  /**
   * When the deck drops to this many remaining cards, fire a background
   * refetch. Defaults to 3 per issue #1903 spec.
   */
  prefetchThreshold?: number;
  /** Optional callback fired when the user dismisses a card to the right. */
  onJoin?: (club: DiscoveryClub) => void;
  /** Optional callback fired when the user dismisses a card to the left. */
  onSkip?: (club: DiscoveryClub) => void;
}

export interface UseClubDiscoveryResult {
  /** The deck of clubs currently being shown. */
  cards: DiscoveryClub[];
  isLoading: boolean;
  /** True when no cards are left to show. */
  isEmpty: boolean;
  /** Manually trigger a fetch (e.g. \"Refresh\" button). */
  refresh: () => void;
  /** Remove a card from the deck and (optionally) call the join mutation. */
  dismiss: (clubId: string, direction: "left" | "right") => void;
  /** Whether the user is currently joined to the given club. */
  joinedIds: ReadonlySet<string>;
}

/**
 * useClubDiscovery — data + state management for the swipe deck
 * (issue #1903).
 *
 * - Pulls a random page of clubs the user has not joined from Supabase.
 * - Tracks which clubs the user has already seen (joined OR skipped) in
 *   local state so the deck keeps moving forward.
 * - Auto-prefetches the next page when the deck drops to the
 *   {@link prefetchThreshold}.
 * - Right-dismiss calls the club_members join mutation; left-dismiss
 *   just marks the card seen.
 *
 * Kept separate from <DiscoveryCardStack /> so it can be reused (or
 * tested) without React rendering, and so the component itself stays
 * focused on layout + interaction.
 */
export function useClubDiscovery({
  userId,
  pageSize = 10,
  prefetchThreshold = 3,
  onJoin,
  onSkip,
}: UseClubDiscoveryOptions): UseClubDiscoveryResult {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Local ids the user has already acted on this session.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  // Refresh-counter bumped by `refresh()` to force a new fetch.
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    data: page,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["discovery-clubs", userId, pageSize, refreshKey, Array.from(dismissedIds).join(",")],
    queryFn: async (): Promise<DiscoveryClub[]> => {
      if (!userId) return [];
      // Fetch candidate clubs and filter out ones the user has joined.
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, description, category, banner_url, logo_url, member_count")
        .limit(pageSize * 2);
      if (error) throw error;
      const filtered = (data ?? []).filter((c) => !dismissedIds.has(c.id));
      // Shuffle to a random page so the user sees a different selection
      // each visit.
      return filtered.sort(() => Math.random() - 0.5).slice(0, pageSize);
    },
    enabled: !!userId,
  });

  const cards = page ?? [];

  // Edge case: prefetch more when the deck runs low.
  useEffect(() => {
    if (cards.length > 0 && cards.length <= prefetchThreshold) {
      refetch();
    }
  }, [cards.length, prefetchThreshold, refetch]);

  const joinMutation = useMutation({
    mutationFn: async (clubId: string) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("club_members")
        .insert({ club_id: clubId, user_id: userId, status: "active" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discovery-clubs", userId] });
    },
  });

  const dismiss = useCallback(
    (clubId: string, direction: "left" | "right") => {
      setDismissedIds((prev) => new Set(prev).add(clubId));
      const club = cards.find((c) => c.id === clubId);
      if (!club) return;
      if (direction === "right") {
        joinMutation.mutate(clubId);
        onJoin?.(club);
      } else {
        onSkip?.(club);
      }
    },
    [cards, joinMutation, onJoin, onSkip],
  );

  const refresh = useCallback(() => {
    setDismissedIds(new Set());
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    cards,
    isLoading,
    isEmpty: !isLoading && cards.length === 0,
    refresh,
    dismiss,
    joinedIds: dismissedIds,
  };
}
