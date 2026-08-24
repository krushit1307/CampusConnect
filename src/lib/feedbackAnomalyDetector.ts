export interface SurveyReviewItem {
  id: string;
  eventId: string;
  rating: number; // 1 to 5 stars
  createdAtIso: string;
}

export interface AnomalyEvaluationOptions {
  windowMinutes?: number;
  minReviewsThreshold?: number;
  maxAverageRatingThreshold?: number;
}

export interface FeedbackAnomalyAlert {
  isAnomalyDetected: boolean;
  eventId: string;
  batchReviewCount: number;
  batchAverageRating: number;
  windowMinutes: number;
  urgentSmsPayload: {
    recipients: string[];
    message: string;
  } | null;
}

export const DEFAULT_ANOMALY_CONFIG = {
  windowMinutes: 15,
  minReviewsThreshold: 10,
  maxAverageRatingThreshold: 2.0,
};

/**
 * Filters incoming survey reviews down to the rolling time window.
 */
export function filterReviewsInRollingWindow(
  reviews: SurveyReviewItem[],
  windowMinutes = DEFAULT_ANOMALY_CONFIG.windowMinutes,
  currentTime: Date = new Date(),
): SurveyReviewItem[] {
  const windowStartMs = currentTime.getTime() - windowMinutes * 60 * 1000;
  return reviews.filter((r) => new Date(r.createdAtIso).getTime() >= windowStartMs);
}

/**
 * Evaluates streaming survey data against statistical anomaly threshold rules.
 */
export function detectFeedbackAnomaly(
  eventId: string,
  reviews: SurveyReviewItem[],
  organizerPhoneNumbers: string[] = [],
  options: AnomalyEvaluationOptions = {},
  currentTime: Date = new Date(),
): FeedbackAnomalyAlert {
  const config = { ...DEFAULT_ANOMALY_CONFIG, ...options };
  const windowReviews = filterReviewsInRollingWindow(reviews, config.windowMinutes, currentTime);

  const batchCount = windowReviews.length;
  if (batchCount === 0) {
    return {
      isAnomalyDetected: false,
      eventId,
      batchReviewCount: 0,
      batchAverageRating: 0,
      windowMinutes: config.windowMinutes,
      urgentSmsPayload: null,
    };
  }

  const sumRatings = windowReviews.reduce((acc, r) => acc + r.rating, 0);
  const avgRating = Number((sumRatings / batchCount).toFixed(2));

  const isAnomalyDetected =
    batchCount > config.minReviewsThreshold && avgRating < config.maxAverageRatingThreshold;

  let urgentSmsPayload: FeedbackAnomalyAlert["urgentSmsPayload"] = null;
  if (isAnomalyDetected) {
    urgentSmsPayload = {
      recipients: organizerPhoneNumbers,
      message: `CRITICAL: The current event is receiving a massive spike in negative feedback (${batchCount} reviews in 15m, ${avgRating} avg stars). Please review the dashboard immediately.`,
    };
  }

  return {
    isAnomalyDetected,
    eventId,
    batchReviewCount: batchCount,
    batchAverageRating: avgRating,
    windowMinutes: config.windowMinutes,
    urgentSmsPayload,
  };
}
