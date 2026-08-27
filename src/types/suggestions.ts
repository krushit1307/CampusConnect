/**
 * Event Suggestion & Voting Board Types
 *
 * Students propose campus events, vote on others' ideas, and club admins
 * review the highest-voted suggestions for approval.
 */

export type SuggestionStatus = "open" | "under_review" | "approved" | "rejected" | "implemented";

export type SuggestionCategory =
  "social" | "academic" | "sports" | "cultural" | "workshop" | "hackathon" | "volunteer" | "other";

export type SortOption = "newest" | "most_voted" | "most_discussed" | "closing_soon";

export interface EventSuggestion {
  id: string;
  title: string;
  description: string;
  proposed_date: string | null;
  proposed_location: string | null;
  category: SuggestionCategory;
  status: SuggestionStatus;
  suggested_by: string;
  suggested_by_name: string;
  suggested_by_avatar: string | null;
  club_id: string | null;
  club_name: string | null;
  vote_count: number;
  comment_count: number;
  has_user_voted: boolean;
  estimated_budget: number | null;
  expected_attendees: number | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuggestionComment {
  id: string;
  suggestion_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface SuggestionVote {
  id: string;
  suggestion_id: string;
  user_id: string;
  created_at: string;
}

export interface SuggestionFilters {
  category: SuggestionCategory | "all";
  status: SuggestionStatus | "all";
  search: string;
  sort: SortOption;
  club_id: string | null;
}

export interface SuggestionStats {
  total_suggestions: number;
  open_suggestions: number;
  approved_count: number;
  rejected_count: number;
  total_votes_cast: number;
  top_categories: { category: SuggestionCategory; count: number }[];
}

export interface CreateSuggestionPayload {
  title: string;
  description: string;
  proposed_date: string | null;
  proposed_location: string | null;
  category: SuggestionCategory;
  club_id: string | null;
  estimated_budget: number | null;
  expected_attendees: number | null;
}

export interface UpdateSuggestionPayload {
  status?: SuggestionStatus;
  admin_notes?: string;
}

/** Category display metadata for UI rendering */
export const CATEGORY_META: Record<
  SuggestionCategory,
  { label: string; icon: string; color: string; bgClass: string }
> = {
  social: { label: "Social", icon: "🎉", color: "#f59e0b", bgClass: "bg-amber-100 text-amber-800" },
  academic: {
    label: "Academic",
    icon: "📚",
    color: "#3b82f6",
    bgClass: "bg-blue-100 text-blue-800",
  },
  sports: { label: "Sports", icon: "⚽", color: "#22c55e", bgClass: "bg-green-100 text-green-800" },
  cultural: {
    label: "Cultural",
    icon: "🎭",
    color: "#a855f7",
    bgClass: "bg-purple-100 text-purple-800",
  },
  workshop: { label: "Workshop", icon: "🔧", color: "#ef4444", bgClass: "bg-red-100 text-red-800" },
  hackathon: {
    label: "Hackathon",
    icon: "💻",
    color: "#06b6d4",
    bgClass: "bg-cyan-100 text-cyan-800",
  },
  volunteer: {
    label: "Volunteer",
    icon: "🤝",
    color: "#10b981",
    bgClass: "bg-emerald-100 text-emerald-800",
  },
  other: { label: "Other", icon: "💡", color: "#6b7280", bgClass: "bg-gray-100 text-gray-800" },
};

/** Status display metadata */
export const STATUS_META: Record<
  SuggestionStatus,
  { label: string; color: string; bgClass: string; dotClass: string }
> = {
  open: {
    label: "Open",
    color: "#3b82f6",
    bgClass: "bg-blue-50 text-blue-700",
    dotClass: "bg-blue-500",
  },
  under_review: {
    label: "Under Review",
    color: "#f59e0b",
    bgClass: "bg-amber-50 text-amber-700",
    dotClass: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    color: "#22c55e",
    bgClass: "bg-green-50 text-green-700",
    dotClass: "bg-green-500",
  },
  rejected: {
    label: "Rejected",
    color: "#ef4444",
    bgClass: "bg-red-50 text-red-700",
    dotClass: "bg-red-500",
  },
  implemented: {
    label: "Implemented",
    color: "#8b5cf6",
    bgClass: "bg-violet-50 text-violet-700",
    dotClass: "bg-violet-500",
  },
};
