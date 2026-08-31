import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useEventFeedbackStore } from "@/store/useEventFeedbackStore";
import type {
  EventFeedback,
  EventFeedbackStats,
  CreateFeedbackPayload,
  FeedbackFilters,
  RatingValue,
} from "@/types/eventFeedback";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const feedbackKeys = {
  all: ["eventFeedback"] as const,
  lists: () => [...feedbackKeys.all, "list"] as const,
  list: (eventId: string, filters: FeedbackFilters) =>
    [...feedbackKeys.lists(), eventId, filters] as const,
  stats: (eventId: string) => [...feedbackKeys.all, "stats", eventId] as const,
  myFeedback: (userId: string, eventId: string) =>
    [...feedbackKeys.all, "my", userId, eventId] as const,
  globalStats: () => [...feedbackKeys.all, "globalStats"] as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFeedbackQuery(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  filters: FeedbackFilters,
) {
  let query = supabase
    .from("event_feedback")
    .select("*")
    .eq("event_id", eventId)
    .order(
      filters.sort === "highest_rating"
        ? "rating"
        : filters.sort === "lowest_rating"
          ? "rating"
          : filters.sort === "most_helpful"
            ? "helpful_count"
            : "created_at",
      { ascending: filters.sort === "lowest_rating" },
    );

  if (filters.rating !== "all") {
    query = query.eq("rating", filters.rating);
  }
  if (filters.sentiment !== "all") {
    query = query.eq("sentiment", filters.sentiment);
  }
  if (filters.search.trim()) {
    const term = filters.search.trim();
    query = query.or(`review.ilike.%${term}%,title.ilike.%${term}%`);
  }

  return query;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Fetch feedback for an event */
export function useEventFeedbackList(eventId: string, filters: FeedbackFilters) {
  const store = useEventFeedbackStore();

  return useQuery({
    queryKey: feedbackKeys.list(eventId, filters),
    queryFn: async () => {
      store.setStatus("loading");
      const supabase = createClient();
      const { data, error } = await buildFeedbackQuery(supabase, eventId, filters).limit(50);
      if (error) {
        store.setError(error.message);
        throw new Error(error.message);
      }
      const feedback = (data ?? []) as EventFeedback[];
      store.setStatus("success");
      return feedback;
    },
    staleTime: 20_000,
    enabled: !!eventId,
  });
}

/** Fetch aggregate stats for an event */
export function useEventFeedbackStats(eventId: string) {
  return useQuery({
    queryKey: feedbackKeys.stats(eventId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("event_feedback")
        .select("rating, sentiment, would_recommend")
        .eq("event_id", eventId);
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as {
        rating: number;
        sentiment: string;
        would_recommend: boolean;
      }[];

      const total = rows.length;
      const avg = total > 0 ? rows.reduce((s, r) => s + r.rating, 0) / total : 0;

      const distribution: Record<RatingValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of rows) {
        distribution[r.rating as RatingValue]++;
      }

      const positive = rows.filter((r) => r.sentiment === "positive").length;
      const neutral = rows.filter((r) => r.sentiment === "neutral").length;
      const negative = rows.filter((r) => r.sentiment === "negative").length;
      const recommendCount = rows.filter((r) => r.would_recommend).length;

      const stats: EventFeedbackStats = {
        event_id: eventId,
        total_reviews: total,
        average_rating: Math.round(avg * 10) / 10,
        rating_distribution: distribution,
        recommend_pct: total > 0 ? Math.round((recommendCount / total) * 100) : 0,
        sentiment_breakdown: { positive, neutral, negative },
      };
      return stats;
    },
    staleTime: 30_000,
    enabled: !!eventId,
  });
}

/** Fetch user's own feedback for an event */
export function useMyFeedback(userId: string | null, eventId: string) {
  return useQuery({
    queryKey: feedbackKeys.myFeedback(userId ?? "", eventId),
    queryFn: async () => {
      if (!userId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("event_feedback")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as EventFeedback | null;
    },
    enabled: !!userId && !!eventId,
  });
}

/** Submit feedback */
export function useSubmitFeedback() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      payload,
      userId,
      userName,
      userAvatar,
    }: {
      payload: CreateFeedbackPayload;
      userId: string;
      userName: string;
      userAvatar: string | null;
    }) => {
      const supabase = createClient();

      // Determine sentiment from rating
      const sentiment =
        payload.rating >= 4 ? "positive" : payload.rating === 3 ? "neutral" : "negative";

      const { data, error } = await supabase
        .from("event_feedback")
        .upsert(
          {
            event_id: payload.event_id,
            user_id: userId,
            user_name: userName,
            user_avatar: userAvatar,
            rating: payload.rating,
            title: payload.title,
            review: payload.review,
            sentiment,
            tags: payload.tags,
            would_recommend: payload.would_recommend,
            helpful_count: 0,
            user_has_marked_helpful: false,
            is_verified_attendee: true,
          },
          { onConflict: "event_id,user_id" },
        )
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as EventFeedback;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: feedbackKeys.all });
      toast.success("Feedback submitted! Thank you.");
    },
    onError: (err) => {
      toast.error("Failed to submit feedback.");
      console.error(err);
    },
  });
}

/** Mark feedback as helpful */
export function useMarkHelpful() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      feedbackId,
      eventId,
      isCurrentlyHelpful,
    }: {
      feedbackId: string;
      eventId: string;
      isCurrentlyHelpful: boolean;
    }) => {
      const supabase = createClient();
      const delta = isCurrentlyHelpful ? -1 : 1;

      const { error } = await supabase
        .from("event_feedback")
        .update({ helpful_count: Math.max(0, delta) })
        .eq("id", feedbackId);

      if (error) throw error;
      return { feedbackId, eventId };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: feedbackKeys.lists() });
    },
    onError: () => toast.error("Failed to update."),
  });
}

/** Delete feedback */
export function useDeleteFeedback() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (feedbackId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("event_feedback").delete().eq("id", feedbackId);
      if (error) throw error;
      return feedbackId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedbackKeys.all });
      toast.success("Review deleted.");
    },
    onError: () => toast.error("Failed to delete review."),
  });
}

/** Global feedback analytics */
export function useGlobalFeedbackStats() {
  return useQuery({
    queryKey: feedbackKeys.globalStats(),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("event_feedback")
        .select("rating, event_id, sentiment");
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as { rating: number; event_id: string; sentiment: string }[];
      const eventsReviewed = new Set(rows.map((r) => r.event_id));

      return {
        total_reviews: rows.length,
        events_reviewed: eventsReviewed.size,
        avg_rating:
          rows.length > 0
            ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10
            : 0,
        positive_pct:
          rows.length > 0
            ? Math.round(
                (rows.filter((r) => r.sentiment === "positive").length / rows.length) * 100,
              )
            : 0,
      };
    },
    staleTime: 60_000,
  });
}
