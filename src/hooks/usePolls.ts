import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { usePollStore } from "@/store/usePollStore";
import type { Poll, PollOption, CreatePollPayload, PollFilters, PollStats } from "@/types/polls";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const pollKeys = {
  all: ["polls"] as const,
  lists: () => [...pollKeys.all, "list"] as const,
  list: (filters: PollFilters) => [...pollKeys.lists(), filters] as const,
  details: () => [...pollKeys.all, "detail"] as const,
  detail: (id: string) => [...pollKeys.details(), id] as const,
  stats: () => [...pollKeys.all, "stats"] as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPollQuery(supabase: ReturnType<typeof createClient>, filters: PollFilters) {
  let query = supabase
    .from("polls")
    .select("*, options:poll_options(*)")
    .order("created_at", { ascending: false });

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.target !== "all") {
    query = query.eq("target", filters.target);
  }
  if (filters.search.trim()) {
    query = query.ilike("question", `%${filters.search.trim()}%`);
  }

  return query;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Fetch polls with filters */
export function usePolls(filters: PollFilters) {
  const store = usePollStore();

  return useQuery({
    queryKey: pollKeys.list(filters),
    queryFn: async () => {
      store.setStatus("loading");
      const supabase = createClient();
      const { data, error } = await buildPollQuery(supabase, filters).limit(30);

      if (error) {
        store.setError(error.message);
        throw new Error(error.message);
      }

      const polls = (data ?? []) as Poll[];
      store.setPolls(polls);
      return polls;
    },
    staleTime: 20_000,
    retry: 2,
  });
}

/** Fetch a single poll by ID */
export function usePollDetail(id: string | null) {
  return useQuery({
    queryKey: pollKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("polls")
        .select("*, options:poll_options(*)")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data as Poll;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

/** Fetch aggregated poll stats */
export function usePollStats() {
  return useQuery({
    queryKey: pollKeys.stats(),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("polls").select("id, status, total_votes");
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as { id: string; status: string; total_votes: number }[];
      const stats: PollStats = {
        total_polls: rows.length,
        active_polls: rows.filter((r) => r.status === "active").length,
        total_votes_cast: rows.reduce((sum, r) => sum + r.total_votes, 0),
        avg_participation: rows.length
          ? Math.round(rows.reduce((sum, r) => sum + r.total_votes, 0) / rows.length)
          : 0,
      };
      return stats;
    },
    staleTime: 60_000,
  });
}

/** Cast vote mutation */
export function useCastVote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pollId,
      optionIds,
      userId,
    }: {
      pollId: string;
      optionIds: string[];
      userId: string;
    }) => {
      const supabase = createClient();

      // Remove previous votes for this poll
      await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", userId);

      // Insert new votes
      const votes = optionIds.map((option_id) => ({
        poll_id: pollId,
        option_id,
        user_id: userId,
      }));

      const { error } = await supabase.from("poll_votes").insert(votes);
      if (error) throw error;

      return { pollId, optionIds };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pollKeys.all });
      toast.success("Vote recorded!");
    },
    onError: (err) => {
      toast.error("Failed to cast vote.");
      console.error("Vote error:", err);
    },
  });
}

/** Create poll mutation */
export function useCreatePoll() {
  const qc = useQueryClient();
  const store = usePollStore();

  return useMutation({
    mutationFn: async ({
      payload,
      userId,
      userName,
      userAvatar,
    }: {
      payload: CreatePollPayload;
      userId: string;
      userName: string;
      userAvatar: string | null;
    }) => {
      const supabase = createClient();

      // Handle yes/no type: auto-generate options
      const optionTexts =
        payload.poll_type === "yes_no" ? ["Yes", "No"] : payload.options.map((o) => o.text);

      const { data: pollData, error: pollError } = await supabase
        .from("polls")
        .insert({
          question: payload.question,
          poll_type: payload.poll_type,
          status: "active",
          target: payload.target,
          club_id: payload.club_id,
          event_id: payload.event_id,
          created_by: userId,
          created_by_name: userName,
          created_by_avatar: userAvatar,
          is_anonymous: payload.is_anonymous,
          allow_write_in: payload.allow_write_in,
          expires_at: payload.expires_at,
          total_votes: 0,
          user_has_voted: false,
          user_vote_option_ids: [],
        })
        .select()
        .single();

      if (pollError) throw new Error(pollError.message);

      // Insert options
      const options = optionTexts.map((text, i) => ({
        poll_id: pollData.id,
        text,
        vote_count: 0,
        position: i,
      }));

      const { data: optionRows, error: optError } = await supabase
        .from("poll_options")
        .insert(options)
        .select();

      if (optError) throw new Error(optError.message);

      return { ...pollData, options: optionRows ?? [] } as Poll;
    },
    onSuccess: (newPoll) => {
      store.addPoll(newPoll);
      store.setFormOpen(false);
      qc.invalidateQueries({ queryKey: pollKeys.all });
      toast.success("Poll created!");
    },
    onError: (err) => {
      toast.error("Failed to create poll.");
      console.error("Create poll error:", err);
    },
  });
}

/** Close poll mutation (admin) */
export function useClosePoll() {
  const qc = useQueryClient();
  const store = usePollStore();

  return useMutation({
    mutationFn: async (pollId: string) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("polls")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", pollId)
        .select()
        .single();
      if (error) throw error;
      return data as Poll;
    },
    onSuccess: (closed) => {
      store.updatePoll(closed.id, closed);
      qc.invalidateQueries({ queryKey: pollKeys.all });
      toast.success("Poll closed.");
    },
    onError: () => toast.error("Failed to close poll."),
  });
}

/** Delete poll mutation */
export function useDeletePoll() {
  const qc = useQueryClient();
  const store = usePollStore();

  return useMutation({
    mutationFn: async (pollId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("polls").delete().eq("id", pollId);
      if (error) throw error;
      return pollId;
    },
    onSuccess: (pollId) => {
      store.removePoll(pollId);
      qc.invalidateQueries({ queryKey: pollKeys.all });
      toast.success("Poll deleted.");
    },
    onError: () => toast.error("Failed to delete poll."),
  });
}
