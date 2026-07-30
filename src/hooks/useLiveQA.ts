import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useLiveQA(eventId: string, userId: string | undefined) {
  // fetches event_questions for eventId, subscribes to postgres_changes
  // (INSERT/UPDATE) filtered by event_id, exposes:
  //   questions, spotlightedQuestion, submitQuestion(text), markAnswering(id)
}
