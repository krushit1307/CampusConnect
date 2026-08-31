/**
 * Event Feedback & Ratings
 *
 * Students rate and review events they attended. Includes star ratings,
 * written reviews, and aggregate analytics for event organizers.
 */

export type RatingValue = 1 | 2 | 3 | 4 | 5;
export type FeedbackSentiment = "positive" | "neutral" | "negative";
export type FeedbackSort = "newest" | "highest_rated" | "lowest_rated" | "most_helpful";

export interface EventFeedback {
  id: string;
  event_id: string;
  event_title: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  rating: RatingValue;
  title: string | null;
  review: string;
  sentiment: FeedbackSentiment;
  /** Tags like "great_speakers", "poor_organization", etc. */
  tags: string[];
  would_recommend: boolean;
  helpful_count: number;
  user_has_marked_helpful: boolean;
  is_verified_attendee: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventFeedbackStats {
  event_id: string;
  total_reviews: number;
  average_rating: number;
  rating_distribution: Record<RatingValue, number>;
  recommend_pct: number;
  sentiment_breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface CreateFeedbackPayload {
  event_id: string;
  rating: RatingValue;
  title: string | null;
  review: string;
  tags: string[];
  would_recommend: boolean;
}

export interface FeedbackFilters {
  rating: RatingValue | "all";
  sort: FeedbackSort;
  sentiment: FeedbackSentiment | "all";
  search: string;
}

export const RATING_LABELS: Record<RatingValue, { label: string; emoji: string; color: string }> = {
  1: { label: "Poor", emoji: "😞", color: "#ef4444" },
  2: { label: "Below Average", emoji: "😕", color: "#f97316" },
  3: { label: "Average", emoji: "😐", color: "#eab308" },
  4: { label: "Good", emoji: "😊", color: "#22c55e" },
  5: { label: "Excellent", emoji: "🤩", color: "#16a34a" },
};

export const FEEDBACK_TAGS = [
  "great_speakers",
  "well_organized",
  "informative",
  "fun",
  "good_venue",
  "bad_venue",
  "poor_organization",
  "too_long",
  "too_short",
  "great_food",
  "networking_opportunity",
  "inspiring",
  "waste_of_time",
  "would_attend_again",
  "needs_improvement",
];
