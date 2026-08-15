import { createClient } from "./supabase/client";

export type SuggestionStatus = "pending" | "planned" | "completed" | "rejected";

export interface ClubSuggestion {
  id: string;
  club_id: string;
  user_id?: string;
  is_anonymous: boolean;
  title: string;
  content: string;
  upvotes_count: number;
  status: SuggestionStatus;
  exec_comment?: string;
  requires_approval: boolean;
  approved: boolean;
  created_at: string;
}

export interface StatusLabelInfo {
  label: string;
  colorClass: string;
}

/**
 * Toggles an upvote on a club suggestion atomically via Supabase RPC.
 */
export async function upvoteSuggestion(
  suggestionId: string,
  userId: string,
): Promise<{ success: boolean; upvoted: boolean; newCount: number; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("upvote_club_suggestion", {
    p_suggestion_id: suggestionId,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, upvoted: false, newCount: 0, error: error.message };
  }

  const res = data?.[0];
  return {
    success: true,
    upvoted: res?.upvoted ?? false,
    newCount: res?.new_upvote_count ?? 0,
  };
}

/**
 * Executive lifecycle management: Updates suggestion status and posts executive comments.
 */
export async function updateSuggestionStatus(
  suggestionId: string,
  status: SuggestionStatus,
  execComment?: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_suggestion_status", {
    p_suggestion_id: suggestionId,
    p_status: status,
    p_exec_comment: execComment ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? false,
    message: res?.message ?? "Status updated.",
  };
}

/**
 * Formats badge label and color styles for suggestion statuses.
 */
export function formatSuggestionStatusLabel(status: SuggestionStatus): StatusLabelInfo {
  switch (status) {
    case "planned":
      return { label: "Planned", colorClass: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
    case "completed":
      return {
        label: "Completed",
        colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      };
    case "rejected":
      return {
        label: "Declined",
        colorClass: "bg-destructive/10 text-destructive border-destructive/20",
      };
    case "pending":
    default:
      return {
        label: "Under Review",
        colorClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      };
  }
}
