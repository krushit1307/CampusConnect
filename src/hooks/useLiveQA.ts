import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type Question = {
  id: string;
  event_id: string;
  user_id: string;
  question: string;
  status: "queued" | "answering_now" | "answered";
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function useLiveQA(eventId: string, userId: string | undefined) {
  const supabase = createClient();
  const [questions, setQuestions] = useState<Question[]>([]);

  const fetchQuestions = useCallback(async () => {
    if (!eventId) return;
    const { data, error } = await supabase
      .from("event_questions")
      .select(
        `
        id, event_id, user_id, question, status, created_at,
        profiles (full_name, avatar_url)
      `,
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setQuestions(data as unknown as Question[]);
    }
  }, [eventId, supabase]);

  useEffect(() => {
    fetchQuestions();

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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, fetchQuestions, supabase]);

  const spotlightedQuestion = questions.find((q) => q.status === "answering_now");

  const submitQuestion = async (text: string) => {
    if (!userId) return;
    const { error } = await supabase.from("event_questions").insert({
      event_id: eventId,
      user_id: userId,
      question: text,
      status: "queued",
    });
    if (error) {
      throw error;
    }
  };

  const markAnswering = async (id: string, newStatus: "queued" | "answering_now" | "answered") => {
    const { error } = await supabase
      .from("event_questions")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) {
      throw error;
    }
  };

  return {
    questions,
    spotlightedQuestion,
    submitQuestion,
    markAnswering,
  };
}
