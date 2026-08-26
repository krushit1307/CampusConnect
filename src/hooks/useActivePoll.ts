import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Poll, PollOption, PollResults } from "@/lib/pollUtils";

export function useActivePoll(eventId: string, userId: string | undefined) {
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [userVote, setUserVote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollIdRef = useRef<string | null>(null);

  const results: PollResults[] = options.map((opt) => ({
    optionId: opt.id,
    text: opt.text,
    votes: voteCounts[opt.id] || 0,
    position: opt.position,
  }));

  const fetchVoteCounts = useCallback(async (pollId: string) => {
    const supabase = createClient();

    const { data: votes, error } = await supabase
      .from("poll_votes")
      .select("option_id")
      .eq("poll_id", pollId);

    if (error) {
      console.error("Failed to fetch vote counts:", error.message);
      return;
    }

    const counts: Record<string, number> = {};
    (votes || []).forEach((v) => {
      counts[v.option_id] = (counts[v.option_id] || 0) + 1;
    });
    setVoteCounts(counts);
  }, []);

  const fetchPollAndResults = useCallback(async () => {
    if (!eventId) return;

    const supabase = createClient();

    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pollError) {
      console.error("Failed to fetch active poll:", pollError.message);
      setIsLoading(false);
      return;
    }

    if (!poll) {
      setActivePoll(null);
      setOptions([]);
      setVoteCounts({});
      setUserVote(null);
      setIsLoading(false);
      return;
    }

    setActivePoll(poll);
    pollIdRef.current = poll.id;

    const { data: pollOptions, error: optionsError } = await supabase
      .from("poll_options")
      .select("*")
      .eq("poll_id", poll.id)
      .order("position", { ascending: true });

    if (optionsError) {
      console.error("Failed to fetch poll options:", optionsError.message);
      setOptions([]);
      setIsLoading(false);
      return;
    }

    setOptions(pollOptions || []);

    if (userId) {
      const { data: vote, error: voteError } = await supabase
        .from("poll_votes")
        .select("option_id")
        .eq("poll_id", poll.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (voteError) {
        console.error("Failed to fetch user vote:", voteError.message);
      }

      setUserVote(vote?.option_id || null);
    }

    await fetchVoteCounts(poll.id);
    setIsLoading(false);
  }, [eventId, userId, fetchVoteCounts]);

  useEffect(() => {
    if (!eventId) return;

    const supabase = createClient();
    let mounted = true;

    async function init() {
      await fetchPollAndResults();
      if (!mounted) return;

      const currentPollId = pollIdRef.current;

      const channel = supabase
        .channel(`poll_launch_${eventId}`)
        .on("broadcast", { event: "poll_launch" }, () => {
          if (!mounted) return;
          fetchPollAndResults();
        });

      if (currentPollId) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "poll_votes",
            filter: `poll_id=eq.${currentPollId}`,
          },
          () => {
            if (!mounted) return;
            const pid = pollIdRef.current;
            if (pid) {
              fetchVoteCounts(pid);
            }
          },
        );
      }

      await channel.subscribe();
      channelRef.current = channel;
    }

    init();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [eventId, fetchPollAndResults, fetchVoteCounts]);

  useEffect(() => {
    if (!channelRef.current || !pollIdRef.current) return;
    if (channelRef.current.state !== "joined") return;

    const supabase = createClient();
    let mounted = true;

    const currentPollId = pollIdRef.current;

    supabase.removeChannel(channelRef.current).then(() => {
      if (!mounted) return;

      const channel = supabase
        .channel(`poll_launch_${eventId}`)
        .on("broadcast", { event: "poll_launch" }, () => {
          if (!mounted) return;
          fetchPollAndResults();
        })
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "poll_votes",
            filter: `poll_id=eq.${currentPollId}`,
          },
          () => {
            if (!mounted) return;
            const pid = pollIdRef.current;
            if (pid) {
              fetchVoteCounts(pid);
            }
          },
        )
        .subscribe();

      channelRef.current = channel;
    });

    return () => {
      mounted = false;
    };
  }, [activePoll?.id, eventId, fetchPollAndResults, fetchVoteCounts]);

  const vote = useCallback(
    async (optionId: string) => {
      if (!userId || !activePoll || userVote || isVoting) return;

      setIsVoting(true);
      const supabase = createClient();

      const { error } = await supabase.from("poll_votes").insert({
        poll_id: activePoll.id,
        option_id: optionId,
        user_id: userId,
      });

      setIsVoting(false);

      if (error) {
        if (error.code === "23505") {
          return;
        }
        throw error;
      }

      setUserVote(optionId);
      await fetchVoteCounts(activePoll.id);
    },
    [userId, activePoll, userVote, isVoting, fetchVoteCounts],
  );

  return {
    activePoll,
    options,
    results,
    userVote,
    isLoading,
    isVoting,
    vote,
    refetch: fetchPollAndResults,
  };
}
