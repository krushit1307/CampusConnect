/**
 * Roommate Compatibility Index & Lifestyle Matching Calculator Utilities
 */

export interface RoommateCompatibilityMetrics {
  compatibilityScorePercent: number;
  compatibilityRating: 'HIGHLY_COMPATIBLE' | 'MODERATE_MATCH' | 'INCOMPATIBLE_LIFESTYLE';
}

/**
 * Calculates roommate compatibility matching index based on sleep schedule, cleanliness, and study habits.
 */
export function calculateRoommateCompatibility(
  sleepScheduleDiffHours: number,
  cleanlinessScaleDiff: number,
  guestPreferenceDiff: number
): RoommateCompatibilityMetrics {
  const penalty = sleepScheduleDiffHours * 15 + cleanlinessScaleDiff * 20 + guestPreferenceDiff * 10;
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  let rating: RoommateCompatibilityMetrics['compatibilityRating'] = 'HIGHLY_COMPATIBLE';
  if (score < 50) rating = 'INCOMPATIBLE_LIFESTYLE';
  else if (score < 75) rating = 'MODERATE_MATCH';

  return {
    compatibilityScorePercent: score,
    compatibilityRating: rating,
  };
}
