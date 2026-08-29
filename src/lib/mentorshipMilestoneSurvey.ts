export interface MentorshipRelationship {
  id: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeEmail: string;
  completedMeetingsCount: number;
}

export interface MentorRatingStats {
  mentorId: string;
  averageRating: number;
  totalReviews: number;
  isMatchmakingActive: boolean;
}

export const MILESTONE_MEETING_THRESHOLD = 5;
export const MIN_RATING_MATCHMAKING_THRESHOLD = 3.0;

/**
 * Checks if a mentorship relationship has reached the 5-meeting survey trigger milestone.
 */
export function isMilestoneSurveyTriggerable(relationship: MentorshipRelationship): boolean {
  return relationship.completedMeetingsCount >= MILESTONE_MEETING_THRESHOLD;
}

/**
 * Constructs notification payload sent to mentee when 5-meeting milestone is hit.
 */
export function buildMilestoneSurveyNotification(relationship: MentorshipRelationship) {
  if (!isMilestoneSurveyTriggerable(relationship)) {
    return null;
  }

  return {
    recipientEmail: relationship.menteeEmail,
    title: `Mentorship Milestone Reached!`,
    body: `You've completed 5 sessions with ${relationship.mentorName}! Please rate your mentorship experience (1-5 stars).`,
    actionUrl: `/dashboard/mentorship/${relationship.id}/survey`,
  };
}

/**
 * Recalculates aggregated mentor stats and suppresses low-rated mentors (< 3.0 stars) from matchmaking.
 */
export function aggregateMentorRating(
  mentorId: string,
  existingRatings: number[],
  newRating: number,
): MentorRatingStats {
  const allRatings = [...existingRatings, newRating];
  const totalReviews = allRatings.length;
  const sum = allRatings.reduce((acc, r) => acc + r, 0);
  const averageRating = Number((sum / totalReviews).toFixed(2));

  // Require at least 2 reviews before enforcing pool exclusion
  const isMatchmakingActive = !(
    totalReviews >= 2 && averageRating < MIN_RATING_MATCHMAKING_THRESHOLD
  );

  return {
    mentorId,
    averageRating,
    totalReviews,
    isMatchmakingActive,
  };
}

/**
 * Formats profile badge display text for Alumni profiles.
 */
export function formatMentorshipRatingDisplay(stats: MentorRatingStats): string {
  if (stats.totalReviews === 0) {
    return "New Mentor";
  }
  return `⭐ ${stats.averageRating.toFixed(1)}/5 Average Mentorship Rating (${stats.totalReviews} ${stats.totalReviews === 1 ? "review" : "reviews"})`;
}
