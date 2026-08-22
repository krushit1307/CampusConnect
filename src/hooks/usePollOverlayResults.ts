// =============================================================================
// Hook: usePollOverlayResults
// Issue: #3337 - Live Audience Poll Overlay for Virtual Streams
// Description: Fetches a poll (by id) and its options, then keeps vote
// counts in sync via Supabase Realtime. Used by the OBS/vMix "Browser
// Source" overlay route, so it intentionally has no auth/vote-casting
// logic — it only reads and displays live results.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Poll, PollOption, PollResults } from "@/lib/pollUtils";

interface UsePollOverlayResultsReturn {
  poll: Poll | null;
  results: PollResults[];
  totalVotes: number;
  isLoading: boolean;
  notFound: boolean;
}

export function usePollOverlayResults(pollId: string | undefined): UsePollOverlayResultsReturn {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchVoteCounts = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data: votes, error } = await supabase
      .from("poll_votes")
      .select("option_id")
      .eq("poll_id", id);

    if (error) {
      console.error("[usePollOverlayResults] Failed to fetch votes:", error.message);
      return;
    }

    const counts: Record<string, number> = {};
    (votes || []).forEach((v) => {
      counts[v.option_id] = (counts[v.option_id] || 0) + 1;
    });
    setVoteCounts(counts);
  }, []);

  const fetchPollAndOptions = useCallback(
    async (id: string) => {
      const supabase = createClient();

      const { data: pollData, error: pollError } = await supabase
        .from("polls")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (pollError || !pollData) {
        console.error("[usePollOverlayResults] Poll not found:", pollError?.message);
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setPoll(pollData);

      const { data: pollOptions, error: optionsError } = await supabase
        .from("poll_options")
        .select("*")
        .eq("poll_id", id)
        .order("position", { ascending: true });

      if (optionsError) {
        console.error("[usePollOverlayResults] Failed to fetch options:", optionsError.message);
        setIsLoading(false);
        return;
      }

      setOptions(pollOptions || []);
      await fetchVoteCounts(id);
      setIsLoading(false);
    },
    [fetchVoteCounts],
  );

  useEffect(() => {
    if (!pollId) return;

    const supabase = createClient();
    let mounted = true;

    fetchPollAndOptions(pollId);

    const channel = supabase
      .channel(`poll-overlay-${pollId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` },
        () => {
          if (mounted) fetchVoteCounts(pollId);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "polls", filter: `id=eq.${pollId}` },
        () => {
          if (mounted) fetchPollAndOptions(pollId);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [pollId, fetchPollAndOptions, fetchVoteCounts]);

  const results: PollResults[] = options.map((opt) => ({
    optionId: opt.id,
    text: opt.text,
    votes: voteCounts[opt.id] || 0,
    position: opt.position,
  }));

  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

  return { poll, results, totalVotes, isLoading, notFound };
}