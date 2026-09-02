import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useSuggestionStore } from "@/store/useSuggestionStore";
import type {
  EventSuggestion,
  SuggestionComment,
  CreateSuggestionPayload,
  UpdateSuggestionPayload,
  SuggestionFilters,
  SuggestionCategory,
  SuggestionStats,
} from "@/types/suggestions";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const suggestionKeys = {
  all: ["suggestions"] as const,
  lists: () => [...suggestionKeys.all, "list"] as const,
  list: (filters: SuggestionFilters) => [...suggestionKeys.lists(), filters] as const,
  details: () => [...suggestionKeys.all, "detail"] as const,
  detail: (id: string) => [...suggestionKeys.details(), id] as const,
  comments: (suggestionId: string) => [...suggestionKeys.all, "comments", suggestionId] as const,
  stats: (clubId: string | null) => [...suggestionKeys.all, "stats", clubId] as const,
  trending: () => [...suggestionKeys.all, "trending"] as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSupabaseQuery(supabase: ReturnType<typeof createClient>, filters: SuggestionFilters) {
  let query = supabase
    .from("event_suggestions")
    .select("*")
    .order(getOrderByColumn(filters.sort), {
      ascending: filters.sort === "newest" ? false : false,
    });

  if (filters.category !== "all") {
    query = query.eq("category", filters.category as SuggestionCategory);
  }
  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.club_id) {
    query = query.eq("club_id", filters.club_id);
  }
  if (filters.search.trim()) {
    const term = filters.search.trim();
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  return query;
}

function getOrderByColumn(sort: SuggestionFilters["sort"]): string {
  switch (sort) {
    case "most_voted":
      return "vote_count";
    case "most_discussed":
      return "comment_count";
    case "newest":
    default:
      return "created_at";
  }
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Fetch suggestions with filters */
export function useSuggestions(filters: SuggestionFilters) {
  const store = useSuggestionStore();

  return useQuery({
    queryKey: suggestionKeys.list(filters),
    queryFn: async () => {
      store.setStatus("loading");
      const supabase = createClient();
      const { data, error } = await buildSupabaseQuery(supabase, filters).limit(50);

      if (error) {
        store.setError(error.message);
        throw new Error(error.message);
      }

      const suggestions = (data ?? []) as EventSuggestion[];
      store.setSuggestions(suggestions);
      return suggestions;
    },
    staleTime: 30_000,
    retry: 2,
  });
}

/** Fetch a single suggestion by ID */
export function useSuggestionDetail(id: string | null) {
  return useQuery({
    queryKey: suggestionKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("event_suggestions")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw new Error(error.message);
      return data as EventSuggestion;
    },
    enabled: !!id,
    staleTime: 15_000,
  });
}

/** Fetch comments for a suggestion */
export function useSuggestionComments(suggestionId: string | null) {
  return useQuery({
    queryKey: suggestionKeys.comments(suggestionId ?? ""),
    queryFn: async () => {
      if (!suggestionId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("suggestion_comments")
        .select("*")
        .eq("suggestion_id", suggestionId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SuggestionComment[];
    },
    enabled: !!suggestionId,
    staleTime: 10_000,
  });
}

/** Fetch aggregated stats */
export function useSuggestionStats(clubId: string | null) {
  return useQuery({
    queryKey: suggestionKeys.stats(clubId),
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from("event_suggestions").select("category, status, vote_count");

      if (clubId) {
        query = query.eq("club_id", clubId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as {
        category: SuggestionCategory;
        status: string;
        vote_count: number;
      }[];

      const categoryCounts: Record<string, number> = {};
      for (const row of rows) {
        categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
      }

      const topCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category: category as SuggestionCategory, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      const stats: SuggestionStats = {
        total_suggestions: rows.length,
        open_suggestions: rows.filter((r) => r.status === "open").length,
        approved_count: rows.filter((r) => r.status === "approved").length,
        rejected_count: rows.filter((r) => r.status === "rejected").length,
        total_votes_cast: rows.reduce((sum, r) => sum + r.vote_count, 0),
        top_categories: topCategories,
      };

      return stats;
    },
    staleTime: 60_000,
  });
}

/** Toggle vote mutation */
export function useToggleVote() {
  const queryClient = useQueryClient();
  const store = useSuggestionStore();

  return useMutation({
    mutationFn: async ({
      suggestionId,
      userId,
      hasVoted,
    }: {
      suggestionId: string;
      userId: string;
      hasVoted: boolean;
    }) => {
      const supabase = createClient();

      // Optimistic update
      store.toggleVoteOptimistic(suggestionId, hasVoted);

      try {
        if (hasVoted) {
          // Remove vote
          const { error } = await supabase
            .from("suggestion_votes")
            .delete()
            .eq("suggestion_id", suggestionId)
            .eq("user_id", userId);

          if (error) throw error;
        } else {
          // Add vote
          const { error } = await supabase
            .from("suggestion_votes")
            .insert({ suggestion_id: suggestionId, user_id: userId });

          if (error) throw error;
        }

        return { suggestionId, toggled: !hasVoted };
      } catch (err) {
        // Rollback optimistic update
        store.revertVoteOptimistic(suggestionId, hasVoted);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
    },
    onError: (err) => {
      toast.error("Failed to update vote. Please try again.");
      console.error("Vote toggle error:", err);
    },
  });
}

/** Create suggestion mutation */
export function useCreateSuggestion() {
  const queryClient = useQueryClient();
  const store = useSuggestionStore();

  return useMutation({
    mutationFn: async ({
      payload,
      userId,
      userName,
      userAvatar,
    }: {
      payload: CreateSuggestionPayload;
      userId: string;
      userName: string;
      userAvatar: string | null;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("event_suggestions")
        .insert({
          title: payload.title,
          description: payload.description,
          proposed_date: payload.proposed_date,
          proposed_location: payload.proposed_location,
          category: payload.category,
          club_id: payload.club_id,
          estimated_budget: payload.estimated_budget,
          expected_attendees: payload.expected_attendees,
          suggested_by: userId,
          suggested_by_name: userName,
          suggested_by_avatar: userAvatar,
          status: "open",
          vote_count: 0,
          comment_count: 0,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as EventSuggestion;
    },
    onSuccess: (newSuggestion) => {
      store.addSuggestion(newSuggestion);
      store.setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
      toast.success("Your suggestion has been submitted!");
    },
    onError: (err) => {
      toast.error("Failed to submit suggestion. Please try again.");
      console.error("Create suggestion error:", err);
    },
  });
}

/** Add comment mutation */
export function useAddComment() {
  const queryClient = useQueryClient();
  const store = useSuggestionStore();

  return useMutation({
    mutationFn: async ({
      suggestionId,
      content,
      authorId,
      authorName,
      authorAvatar,
    }: {
      suggestionId: string;
      content: string;
      authorId: string;
      authorName: string;
      authorAvatar: string | null;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("suggestion_comments")
        .insert({
          suggestion_id: suggestionId,
          author_id: authorId,
          author_name: authorName,
          author_avatar: authorAvatar,
          content,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as SuggestionComment;
    },
    onSuccess: (_comment, variables) => {
      store.incrementCommentCount(variables.suggestionId);
      queryClient.invalidateQueries({
        queryKey: suggestionKeys.comments(variables.suggestionId),
      });
      queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
    },
    onError: (err) => {
      toast.error("Failed to post comment.");
      console.error("Add comment error:", err);
    },
  });
}

/** Delete comment mutation */
export function useDeleteComment() {
  const queryClient = useQueryClient();
  const store = useSuggestionStore();

  return useMutation({
    mutationFn: async ({
      commentId,
      suggestionId,
    }: {
      commentId: string;
      suggestionId: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("suggestion_comments").delete().eq("id", commentId);

      if (error) throw new Error(error.message);
      return { commentId, suggestionId };
    },
    onSuccess: (_data, variables) => {
      store.decrementCommentCount(variables.suggestionId);
      queryClient.invalidateQueries({
        queryKey: suggestionKeys.comments(variables.suggestionId),
      });
      queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
    },
    onError: (err) => {
      toast.error("Failed to delete comment.");
      console.error("Delete comment error:", err);
    },
  });
}

/** Admin: update suggestion status */
export function useUpdateSuggestionStatus() {
  const queryClient = useQueryClient();
  const store = useSuggestionStore();

  return useMutation({
    mutationFn: async ({
      suggestionId,
      payload,
    }: {
      suggestionId: string;
      payload: UpdateSuggestionPayload;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("event_suggestions")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", suggestionId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as EventSuggestion;
    },
    onSuccess: (updated) => {
      store.updateSuggestion(updated.id, updated);
      queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
      toast.success("Suggestion status updated.");
    },
    onError: (err) => {
      toast.error("Failed to update status.");
      console.error("Update status error:", err);
    },
  });
}

/** Delete suggestion mutation */
export function useDeleteSuggestion() {
  const queryClient = useQueryClient();
  const store = useSuggestionStore();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("event_suggestions").delete().eq("id", suggestionId);

      if (error) throw new Error(error.message);
      return suggestionId;
    },
    onSuccess: (suggestionId) => {
      store.removeSuggestion(suggestionId);
      queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
      toast.success("Suggestion deleted.");
    },
    onError: (err) => {
      toast.error("Failed to delete suggestion.");
      console.error("Delete suggestion error:", err);
    },
  });
}
