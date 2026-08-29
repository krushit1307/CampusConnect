/**
 * Campus Polls & Quick Surveys
 *
 * Create real-time polls for campus decisions, club votes, or quick feedback.
 * Supports single-choice, multi-choice, and yes/no poll types with
 * optional anonymous voting and expiration.
 */

export type PollType = "single" | "multiple" | "yes_no";
export type PollStatus = "active" | "closed" | "draft";
export type PollTarget = "campus" | "club" | "event";

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  vote_count: number;
  position: number;
}

export interface Poll {
  id: string;
  question: string;
  poll_type: PollType;
  status: PollStatus;
  target: PollTarget;
  club_id: string | null;
  club_name: string | null;
  event_id: string | null;
  created_by: string;
  created_by_name: string;
  created_by_avatar: string | null;
  is_anonymous: boolean;
  allow_write_in: boolean;
  expires_at: string | null;
  total_votes: number;
  user_has_voted: boolean;
  user_vote_option_ids: string[];
  options: PollOption[];
  created_at: string;
  updated_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface CreatePollPayload {
  question: string;
  poll_type: PollType;
  target: PollTarget;
  club_id: string | null;
  event_id: string | null;
  is_anonymous: boolean;
  allow_write_in: boolean;
  expires_at: string | null;
  options: { text: string }[];
}

export interface PollFilters {
  status: PollStatus | "all";
  target: PollTarget | "all";
  search: string;
  sort: "newest" | "most_voted" | "closing_soon";
}

export interface PollStats {
  total_polls: number;
  active_polls: number;
  total_votes_cast: number;
  avg_participation: number;
}

export const POLL_TYPE_META: Record<
  PollType,
  { label: string; description: string; icon: string }
> = {
  single: { label: "Single Choice", description: "Pick one option", icon: "◉" },
  multiple: { label: "Multiple Choice", description: "Pick many options", icon: "☑" },
  yes_no: { label: "Yes / No", description: "Binary choice", icon: "⚖" },
};

export const POLL_STATUS_META: Record<
  PollStatus,
  { label: string; bgClass: string; dotClass: string }
> = {
  active: { label: "Active", bgClass: "bg-green-50 text-green-700", dotClass: "bg-green-500" },
  closed: { label: "Closed", bgClass: "bg-gray-100 text-gray-600", dotClass: "bg-gray-400" },
  draft: { label: "Draft", bgClass: "bg-amber-50 text-amber-700", dotClass: "bg-amber-500" },
};

export const POLL_TARGET_META: Record<PollTarget, { label: string; bgClass: string }> = {
  campus: { label: "Campus-wide", bgClass: "bg-indigo-100 text-indigo-700" },
  club: { label: "Club", bgClass: "bg-violet-100 text-violet-700" },
  event: { label: "Event", bgClass: "bg-cyan-100 text-cyan-700" },
};
