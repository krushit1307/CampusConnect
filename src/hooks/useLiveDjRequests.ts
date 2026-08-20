// =============================================================================
// Hook: useLiveDjRequests
// Issue: #3462 - Build an 'Interactive Live DJ Request System'
// Description: Fetches song requests ordered by upvotes (order by upvotes desc)
// and connects to Supabase Realtime for instant DJ booth synchronization.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../lib/supabase/client";
import type { EventSongRequest } from "../types/database";
import {
  submitSongRequest,
  upvoteSongRequest,
  dismissSongRequest,
} from "../services/djRequestService";

interface UseLiveDjRequestsReturn {
  requests: EventSongRequest[];
  isLoading: boolean;
  userUpvotedIds: Set<string>;
  submitRequest: (songTitle: string, artist: string, albumArtUrl?: string) => Promise<boolean>;
  toggleUpvote: (requestId: string) => Promise<void>;
  dismissRequest: (requestId: string) => Promise<void>;
  refetch: () => Promise<void>;
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
      // Fetch unplayed song requests sorted by upvotes DESC, created_at ASC
      const { data, error } = await supabase
        .from("event_song_requests")
        .select("*")
        .eq("event_id", eventId)
        .eq("played", false)
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
    // Optimistic UI update
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
        .sort((a, b) => b.upvotes - a.upvotes),
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

  return {
    requests,
    isLoading,
    userUpvotedIds,
    submitRequest,
    toggleUpvote,
    dismissRequest,
    refetch: fetchRequests,
  };
}
