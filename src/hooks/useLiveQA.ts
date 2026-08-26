import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// =============================================================================
// Hook: useLiveQA
// Issue: #3272 - Develop a 'Live Interactive Q&A Upvoting' System
// Description: Manages the state, Realtime subscriptions, and voting logic
// for the Q&A module based on the event_questions and question_votes tables.
// Subscribes to database changes to instantly reorder the question list
// as upvotes arrive.
// =============================================================================

export interface LiveQuestion {
  id: string;
  event_id: string;
  user_id: string;
  question: string;
  status: "queued" | "answering_now" | "answered";
  upvotes_count: number;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
  has_upvoted?: boolean; // Client-side computed state
}

interface UseLiveQAReturn {
  questions: LiveQuestion[];
  spotlightedQuestion: LiveQuestion | undefined;
  isLoading: boolean;
  error: string | null;
  submitQuestion: (content: string) => Promise<boolean>;
  toggleUpvote: (questionId: string) => Promise<void>;
  markAnswering: (questionId: string, status: "queued" | "answering_now" | "answered") => Promise<void>;
  markAnswered: (questionId: string) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
}

export function useLiveQA(
  eventId: string,
  userIdOrModerator?: string | boolean,
): UseLiveQAReturn {
  const supabase = createClient();
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!eventId) return;

    setIsLoading(true);
    try {
      // Determine the active user ID for has_upvoted calculation
      let activeUserId = typeof userIdOrModerator === "string" ? userIdOrModerator : null;
      if (!activeUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        activeUserId = user?.id || null;
      }

      // Fetch all event questions
      const { data, error: fetchError } = await supabase
        .from("event_questions")
        .select(`
          *,
          profiles:user_id (full_name, avatar_url)
        `)
        .eq("event_id", eventId)
        .order("upvotes_count", { ascending: false })
        .order("created_at", { ascending: true }); // Tie-breaker

      if (fetchError) throw fetchError;

      // Fetch the active user's upvotes on these questions
      let upvotedIds = new Set<string>();
      if (activeUserId && data && data.length > 0) {
        const questionIds = data.map((q) => q.id);
        const { data: votes } = await supabase
          .from("question_votes")
          .select("question_id")
          .eq("user_id", activeUserId)
          .in("question_id", questionIds);

        upvotedIds = new Set((votes || []).map((v) => v.question_id));
      }

      const formattedQuestions = (data || []).map((q) => ({
        ...q,
        has_upvoted: upvotedIds.has(q.id),
      })) as LiveQuestion[];

      // Sort: answering_now first, then queued sorted by upvotes, then answered last
      const sortedQuestions = formattedQuestions.sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === "answering_now") return -1;
          if (b.status === "answering_now") return 1;
          if (a.status === "answered") return 1;
          if (b.status === "answered") return -1;
        }
        return b.upvotes_count - a.upvotes_count ||
               new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setQuestions(sortedQuestions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[useLiveQA] Fetch failed:", err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, userIdOrModerator, supabase]);

  useEffect(() => {
    fetchQuestions();

    // Subscribe to Realtime changes on both event_questions and question_votes
    const channel = supabase
      .channel(`live-qa-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_questions",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchQuestions();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "question_votes",
        },
        () => {
          fetchQuestions();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, fetchQuestions, supabase]);

  const submitQuestion = async (content: string): Promise<boolean> => {
    if (!content.trim()) return false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: insertError } = await supabase
        .from("event_questions")
        .insert({
          event_id: eventId,
          user_id: user.id,
          question: content.trim(),
          status: "queued"
        });

      if (insertError) throw insertError;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[useLiveQA] Submit failed:", err);
      setError(message);
      return false;
    }
  };

  const toggleUpvote = async (questionId: string) => {
    try {
      // Call the atomic toggle question vote RPC function
      const { data, error: rpcError } = await supabase.rpc(
        "toggle_question_vote",
        {
          p_question_id: questionId,
        },
      );

      if (rpcError) throw rpcError;

      // Optimistically update the local state for instant UI feedback
      setQuestions((prev) =>
        prev
          .map((q) => {
            if (q.id === questionId) {
              return {
                ...q,
                upvotes_count: data as number,
                has_upvoted: !q.has_upvoted,
              };
            }
            return q;
          })
          .sort((a, b) => {
            if (a.status !== b.status) {
              if (a.status === "answering_now") return -1;
              if (b.status === "answering_now") return 1;
              if (a.status === "answered") return 1;
              if (b.status === "answered") return -1;
            }
            return b.upvotes_count - a.upvotes_count ||
                   new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }),
      );
    } catch (err: unknown) {
      console.error("[useLiveQA] Upvote failed:", err);
    }
  };

  const markAnswering = async (
    questionId: string,
    status: "queued" | "answering_now" | "answered",
  ) => {
    try {
      const { error: updateError } = await supabase
        .from("event_questions")
        .update({ status })
        .eq("id", questionId);

      if (updateError) throw updateError;
    } catch (err: unknown) {
      console.error("[useLiveQA] Mark answering status failed:", err);
    }
  };

  const markAnswered = async (questionId: string) => {
    await markAnswering(questionId, "answered");
  };

  const deleteQuestion = async (questionId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("event_questions")
        .delete()
        .eq("id", questionId);

      if (deleteError) throw deleteError;
    } catch (err: unknown) {
      console.error("[useLiveQA] Delete failed:", err);
    }
  };

  const spotlightedQuestion = questions.find((q) => q.status === "answering_now");

  return {
    questions,
    spotlightedQuestion,
    isLoading,
    error,
    submitQuestion,
    toggleUpvote,
    markAnswering,
    markAnswered,
    deleteQuestion,
  };
}
