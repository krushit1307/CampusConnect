// =============================================================================
// Hook: useLiveDjRequests
// Issue: #3462 - Build an 'Interactive Live DJ Request System' & #4490 DJ Mode
// Description: Fetches song requests ordered by upvotes and admin overrides,
// and connects to Supabase Realtime for instant DJ booth synchronization.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../lib/supabase/client";
import type { EventSongRequest } from "../types/database";
import {
  submitSongRequest,
  upvoteSongRequest,
  dismissSongRequest,
  overrideAdminQueue, // Note: We need to create this in the service next
} from "../services/djRequestService";

interface UseLiveDjRequestsReturn {
  requests: EventSongRequest[];
  isLoading: boolean;
  userUpvotedIds: Set<string>;
  submitRequest: (songTitle: string, artist: string, albumArtUrl?: string) => Promise<boolean>;
  toggleUpvote: (requestId: string) => Promise<void>;
  dismissRequest: (requestId: string) => Promise<void>;
  refetch: () => Promise<void>;
  updateAdminQueueOrder: (
    reorderedRequests: EventSongRequest[],
    draggedId: string,
  ) => Promise<void>;
}

export function useLiveDjRequests(
  eventId: string | null,
  currentUserId?: string | null,
): UseLiveDjRequestsReturn {
  const [requests, setRequests] = useState<EventSongRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userUpvotedIds, setUserUpvotedIds] = useState<Set<string>>(new Set());

  const fetchRequests = useCallback(async () => {
    if (!eventId) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      // Fetch unplayed song requests sorted by Admin overrides first, then upvotes
      const { data, error } = await supabase
        .from("event_song_requests")
        .select("*")
        .eq("event_id", eventId)
        .eq("played", false)
        .order("overridden_by_admin", { ascending: false, nullsFirst: false })
        .order("admin_sort_order", { ascending: true })
        .order("upvotes", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      const loadedRequests = (data || []) as EventSongRequest[];

      // Fetch user's upvoted request IDs
      if (currentUserId) {
        const { data: userVotes } = await supabase
          .from("event_song_request_upvotes")
          .select("request_id")
          .eq("user_id", currentUserId);

        if (userVotes) {
          const upvotedSet = new Set(userVotes.map((v) => v.request_id));
          setUserUpvotedIds(upvotedSet);

          loadedRequests.forEach((req) => {
            req.user_has_upvoted = upvotedSet.has(req.id);
          });
        }
      }

      setRequests(loadedRequests);
    } catch (err) {
      console.error("[useLiveDjRequests] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, currentUserId]);

  useEffect(() => {
    void fetchRequests();

    if (!eventId) return;
    const supabase = createClient();

    // Subscribe to Supabase Realtime updates on event_song_requests
    const channel = supabase
      .channel(`dj-requests-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_song_requests",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          // Re-fetch sorted queue on real-time payload change
          void fetchRequests();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchRequests]);

  const submitRequest = async (
    songTitle: string,
    artist: string,
    albumArtUrl?: string,
  ): Promise<boolean> => {
    if (!eventId || !currentUserId) return false;
    const res = await submitSongRequest(eventId, currentUserId, songTitle, artist, albumArtUrl);
    if (res.success) {
      void fetchRequests();
      return true;
    }
    return false;
  };

  const toggleUpvote = async (requestId: string) => {
    if (!currentUserId) return;
    // Optimistic UI update ensuring Admin order isn't scrambled by regular votes
    setRequests((prev) =>
      prev
        .map((r) => {
          if (r.id === requestId) {
            const hasUpvoted = userUpvotedIds.has(requestId);
            const newUpvotes = hasUpvoted ? Math.max(1, r.upvotes - 1) : r.upvotes + 1;
            return { ...r, upvotes: newUpvotes, user_has_upvoted: !hasUpvoted };
          }
          return r;
        })
        .sort((a, b) => {
          if (a.overridden_by_admin && !b.overridden_by_admin) return -1;
          if (!a.overridden_by_admin && b.overridden_by_admin) return 1;
          if (a.overridden_by_admin && b.overridden_by_admin) {
            return (a.admin_sort_order || 0) - (b.admin_sort_order || 0);
          }
          return b.upvotes - a.upvotes;
        }),
    );

    setUserUpvotedIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });

    await upvoteSongRequest(requestId, currentUserId);
    void fetchRequests();
  };

  const dismissRequest = async (requestId: string) => {
    // Optimistic remove
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    await dismissSongRequest(requestId);
    void fetchRequests();
  };

  const updateAdminQueueOrder = async (
    reorderedRequests: EventSongRequest[],
    draggedId: string,
  ) => {
    // 1. Optimistic UI update
    const updatedState = reorderedRequests.map((req, index) => {
      if (req.id === draggedId || req.overridden_by_admin) {
        return { ...req, overridden_by_admin: true, admin_sort_order: index };
      }
      return req;
    });

    setRequests(updatedState);

    // 2. Persist to Backend
    try {
      const itemsToUpdate = updatedState
        .filter((req) => req.overridden_by_admin)
        .map((req) => ({
          id: req.id,
          overridden_by_admin: true,
          admin_sort_order: req.admin_sort_order,
        }));

      await overrideAdminQueue(itemsToUpdate);
    } catch (error) {
      console.error("Failed to sync DJ queue override:", error);
      void fetchRequests();
    }
  };

  return {
    requests,
    isLoading,
    userUpvotedIds,
    submitRequest,
    toggleUpvote,
    dismissRequest,
    refetch: fetchRequests,
    updateAdminQueueOrder,
  };
}
