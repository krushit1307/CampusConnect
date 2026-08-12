import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// =============================================================================
// Hook: useLiveQA
// Issue: #2898 - Develop a Real-Time 'Live Q&A' Module for Events
// Description: Manages the state, Realtime subscriptions, and voting logic
// for the Live Q&A module. Subscribes to database changes to instantly
// reorder the question list as upvotes arrive.
// =============================================================================

export interface LiveQuestion {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  upvotes: number;
  is_answered: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
  has_upvoted?: boolean; // Client-side computed state
}

interface UseLiveQAReturn {
  questions: LiveQuestion[];
  isLoading: boolean;
  error: string | null;
  submitQuestion: (content: string) => Promise<boolean>;
  toggleUpvote: (questionId: string) => Promise<void>;
  markAnswered: (questionId: string) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
}

export function useLiveQA(
  eventId: string,
  isModerator: boolean = false,
): UseLiveQAReturn {
  const supabase = createClient();
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!eventId) return;

    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let query = supabase
        .from("live_questions")
        .select(
          `
          *,
          profiles:user_id (full_name, avatar_url)
        `,
        )
        .eq("event_id", eventId)
        .eq("is_answered", false)
        .order("upvotes", { ascending: false })
        .order("created_at", { ascending: true }); // Secondary sort for ties

      if (!isModerator) {
        query = query.eq("is_hidden", false);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Fetch user's upvotes to compute `has_upvoted` state
      let upvotedIds = new Set<string>();
      if (user && data && data.length > 0) {
        const questionIds = data.map((q) => q.id);
        const { data: upvotes } = await supabase
          .from("live_question_upvotes")
          .select("question_id")
          .eq("user_id", user.id)
          .in("question_id", questionIds);

        upvotedIds = new Set((upvotes || []).map((u) => u.question_id));
      }

      const formattedQuestions = (data || []).map((q) => ({
        ...q,
        has_upvoted: upvotedIds.has(q.id),
      })) as LiveQuestion[];

      setQuestions(formattedQuestions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[useLiveQA] Fetch failed:", err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, isModerator, supabase]);

  useEffect(() => {
    fetchQuestions();

    // Subscribe to Realtime changes
    const channel = supabase
      .channel(`live-qa-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_questions",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          // For simplicity and strict accuracy, we refetch the list on any change.
          // In a highly scaled app, you'd apply optimistic updates based on payload.new/old.
          fetchQuestions();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, [eventId, fetchQuestions, supabase]);

  const submitQuestion = async (content: string): Promise<boolean> => {
    if (!content.trim()) return false;
    try {
      const { error: insertError } = await supabase
        .from("live_questions")
        .insert({ event_id: eventId, content: content.trim() });

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
      // Call the atomic RPC to prevent race conditions
      const { data, error: rpcError } = await supabase.rpc(
        "toggle_question_upvote",
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
                upvotes: data as number, // The RPC returns the new count
                has_upvoted: !q.has_upvoted,
              };
            }
            return q;
          })
          .sort(
            (a, b) =>
              b.upvotes - a.upvotes ||
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          ),
      );
    } catch (err: unknown) {
      console.error("[useLiveQA] Upvote failed:", err);
    }
  };

  const markAnswered = async (questionId: string) => {
    try {
      await supabase
        .from("live_questions")
        .update({ is_answered: true })
        .eq("id", questionId);
    } catch (err: unknown) {
      console.error("[useLiveQA] Mark answered failed:", err);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    try {
      await supabase.from("live_questions").delete().eq("id", questionId);
    } catch (err: unknown) {
      console.error("[useLiveQA] Delete failed:", err);
    }
  };

  return {
    questions,
    isLoading,
    error,
    submitQuestion,
    toggleUpvote,
    markAnswered,
    deleteQuestion,
  };
}
