// =============================================================================
// Hook: usePoll
// Issue: #2819 - Implement Real - Time Polling Widget Embeddable in Markdown
// Description: Manages the state, voting logic, and Supabase Realtime
// subscription for a specific poll.Fetches initial vote counts and
// animates progress bars as new votes arrive in real - time.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface PollOption {
  text: string;
  votes: number;
  percentage: number;
}

interface UsePollReturn {
  options: PollOption[];
  totalVotes: number;
  userVoteIndex: number | null;
  isLoading: boolean;
  hasVoted: boolean;
  castVote: (optionIndex: number) => Promise<void>;
  changeVote: (newOptionIndex: number) => Promise<void>;
}

export function usePoll(pollId: string | null, optionsText: string[]): UsePollReturn {
  const [options, setOptions] = useState<PollOption[]>(
    optionsText.map((text) => ({ text, votes: 0, percentage: 0 })),
  );
  const [totalVotes, setTotalVotes] = useState(0);
  const [userVoteIndex, setUserVoteIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch initial vote counts and user's vote
  useEffect(() => {
    if (!pollId) return;

    const fetchPollData = async () => {
      setIsLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Fetch all votes for this poll
        const { data: votes, error: votesError } = await supabase
          .from("poll_votes")
          .select("user_id, option_index")
          .eq("poll_id", pollId);

        if (votesError) throw votesError;

        // Calculate vote counts
        const counts = new Array(optionsText.length).fill(0);
        let myVote: number | null = null;

        (votes || []).forEach((vote) => {
          if (vote.option_index < counts.length) {
            counts[vote.option_index]++;
          }
          if (user && vote.user_id === user.id) {
            myVote = vote.option_index;
          }
        });

        const total = (votes || []).length;
        setTotalVotes(total);
        setUserVoteIndex(myVote);

        setOptions(
          optionsText.map((text, idx) => ({
            text,
            votes: counts[idx],
            percentage: total > 0 ? (counts[idx] / total) * 100 : 0,
          })),
        );
      } catch (err) {
        console.error("[usePoll] Fetch failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPollData();

    // Subscribe to Realtime changes
    const channel = supabase
      .channel(`poll-${pollId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` },
        (payload) => {
          // When a new vote is inserted or deleted, refetch the counts
          // In a high-scale app, you'd optimistically update the local state
          // based on payload.new/payload.old, but refetching ensures strict accuracy.
          fetchPollData();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [pollId, optionsText]);

  const castVote = async (optionIndex: number) => {
    if (!pollId || userVoteIndex !== null) return;

    // Optimistic update
    setUserVoteIndex(optionIndex);
    setOptions((prev) => {
      const newOpts = [...prev];
      newOpts[optionIndex].votes++;
      const newTotal = totalVotes + 1;
      setTotalVotes(newTotal);
      return newOpts.map((opt) => ({
        ...opt,
        percentage: (opt.votes / newTotal) * 100,
      }));
    });

    try {
      const { error } = await supabase
        .from("poll_votes")
        .insert({ poll_id: pollId, option_index: optionIndex });

      if (error) throw error;
    } catch (err) {
      console.error("[usePoll] Vote failed:", err);
      // Revert optimistic update on error
      setUserVoteIndex(null);
      // Refetch to ensure sync
      window.location.reload();
    }
  };

  const changeVote = async (newOptionIndex: number) => {
    if (!pollId || userVoteIndex === null || userVoteIndex === newOptionIndex) return;

    const oldIndex = userVoteIndex;

    // Optimistic update
    setUserVoteIndex(newOptionIndex);
    setOptions((prev) => {
      const newOpts = [...prev];
      newOpts[oldIndex].votes--;
      newOpts[newOptionIndex].votes++;
      return newOpts.map((opt) => ({
        ...opt,
        percentage: totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0,
      }));
    });

    try {
      // Delete old vote (RLS ensures we can only delete our own)
      await supabase.from("poll_votes").delete().eq("poll_id", pollId);
      // Insert new vote
      await supabase.from("poll_votes").insert({ poll_id: pollId, option_index: newOptionIndex });
    } catch (err) {
      console.error("[usePoll] Change vote failed:", err);
      setUserVoteIndex(oldIndex);
      window.location.reload();
    }
  };

  return {
    options,
    totalVotes,
    userVoteIndex,
    isLoading,
    hasVoted: userVoteIndex !== null,
    castVote,
    changeVote,
  };
}
