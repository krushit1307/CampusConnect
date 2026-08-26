/**
 * Dynamic "Carpool" Driver Rating and Reputation Engine (#4536)
 * Implements 1-5 star driver reputation aggregation, safety tracking,
 * and automated driver blocking when average ratings drop below 3.0 stars (min 3 trips).
 */

export const MIN_TRIPS_FOR_BLOCK = 3;
export const BLOCKING_RATING_THRESHOLD = 3.0;

export interface DriverRatingSubmission {
  vehicleId: string;
  driverUserId: string;
  riderUserId: string;
  rating: number; // 1 - 5 stars
  feedback?: string | null;
  safetyTags?: string[];
}

export interface DriverReputation {
  driverUserId: string;
  averageRating: number | null;
  totalRatings: number;
  isBlocked: boolean;
  blockedReason?: string | null;
}

export interface DriverBlockingStatus {
  isBlocked: boolean;
  reason: string | null;
  tripsCount: number;
  averageRating: number | null;
}

export const COMMON_SAFETY_TAGS = [
  { id: "safe_driving", label: "Safe Driving 🚗", isPositive: true },
  { id: "punctual", label: "Punctual ⏰", isPositive: true },
  { id: "clean_car", label: "Clean Vehicle ✨", isPositive: true },
  { id: "great_music", label: "Great Music 🎵", isPositive: true },
  { id: "speeding", label: "Speeding / Aggressive ⚠️", isPositive: false },
  { id: "reckless", label: "Reckless Driving 🚨", isPositive: false },
  { id: "distracted", label: "Phone / Distracted 📱", isPositive: false },
  { id: "late", label: "Severe Delay ⏳", isPositive: false },
];

/**
 * Calculates average rating and reputation metrics from an array of ratings.
 */
export function calculateDriverReputation(
  driverUserId: string,
  ratings: Array<{ rating: number }>,
): DriverReputation {
  if (!ratings || ratings.length === 0) {
    return {
      driverUserId,
      averageRating: null,
      totalRatings: 0,
      isBlocked: false,
      blockedReason: null,
    };
  }

  const total = ratings.length;
  const sum = ratings.reduce((acc, curr) => acc + curr.rating, 0);
  const avg = Math.round((sum / total) * 100) / 100;

  const blockingStatus = evaluateDriverBlockingStatus({
    driverUserId,
    averageRating: avg,
    totalRatings: total,
    isBlocked: false,
  });

  return {
    driverUserId,
    averageRating: avg,
    totalRatings: total,
    isBlocked: blockingStatus.isBlocked,
    blockedReason: blockingStatus.reason,
  };
}

/**
 * Evaluates whether a driver meets the automated safety block conditions:
 * Average rating < 3.0 with a minimum of 3 completed ratings/trips.
 */
export function evaluateDriverBlockingStatus(reputation: {
  averageRating: number | null;
  totalRatings: number;
  isBlocked?: boolean;
}): DriverBlockingStatus {
  const { averageRating, totalRatings } = reputation;

  if (
    averageRating !== null &&
    totalRatings >= MIN_TRIPS_FOR_BLOCK &&
    averageRating < BLOCKING_RATING_THRESHOLD
  ) {
    return {
      isBlocked: true,
      reason: `Automated safety block: Driver average rating (${averageRating.toFixed(1)}/5.0) fell below ${BLOCKING_RATING_THRESHOLD} stars across ${totalRatings} trips.`,
      tripsCount: totalRatings,
      averageRating,
    };
  }

  return {
    isBlocked: false,
    reason: null,
    tripsCount: totalRatings,
    averageRating,
  };
}

/**
 * Formats driver reputation badge details for UI rendering.
 */
export function formatDriverRatingBadge(
  rating: number | null,
  ratingCount: number,
  isBlocked = false,
): {
  displayText: string;
  badgeVariant: "success" | "warning" | "danger" | "neutral";
  tooltip: string;
} {
  if (isBlocked) {
    return {
      displayText: "🚫 Blocked Driver",
      badgeVariant: "danger",
      tooltip: "This driver has been suspended due to low passenger safety ratings.",
    };
  }

  if (rating === null || ratingCount === 0) {
    return {
      displayText: "⭐ New Driver",
      badgeVariant: "neutral",
      tooltip: "No rides rated yet.",
    };
  }

  if (rating >= 4.5) {
    return {
      displayText: `⭐ ${rating.toFixed(1)} (${ratingCount})`,
      badgeVariant: "success",
      tooltip: `Top Rated Driver · ${ratingCount} ride reviews`,
    };
  }

  if (rating >= 3.0) {
    return {
      displayText: `⭐ ${rating.toFixed(1)} (${ratingCount})`,
      badgeVariant: "warning",
      tooltip: `Fair Rating · ${ratingCount} ride reviews`,
    };
  }

  return {
    displayText: `⚠️ ${rating.toFixed(1)} (${ratingCount})`,
    badgeVariant: "danger",
    tooltip: `Low Rating Warning · ${ratingCount} ride reviews`,
  };
}

/**
 * Validates rating submission values before dispatching.
 */
export function validateDriverRatingSubmission(submission: DriverRatingSubmission): {
  isValid: boolean;
  error?: string;
} {
  if (!submission.vehicleId) {
    return { isValid: false, error: "Vehicle ID is required." };
  }
  if (!submission.driverUserId) {
    return { isValid: false, error: "Driver user ID is required." };
  }
  if (!submission.riderUserId) {
    return { isValid: false, error: "Rider user ID is required." };
  }
  if (submission.driverUserId === submission.riderUserId) {
    return { isValid: false, error: "Drivers cannot rate themselves." };
  }
  if (!Number.isInteger(submission.rating) || submission.rating < 1 || submission.rating > 5) {
    return { isValid: false, error: "Rating must be an integer between 1 and 5 stars." };
  }

  return { isValid: true };
}
