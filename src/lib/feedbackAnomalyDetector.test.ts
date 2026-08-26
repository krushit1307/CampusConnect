import { describe, it, expect } from "vitest";
import {
  filterReviewsInRollingWindow,
  detectFeedbackAnomaly,
  SurveyReviewItem,
} from "./feedbackAnomalyDetector";

describe("Build Real-Time Event Feedback Anomaly Detector Suite (#4405)", () => {
  const now = new Date("2026-08-25T12:00:00Z");

  const generateReviews = (
    count: number,
    rating: number,
    minutesAgo: number,
  ): SurveyReviewItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `rev_${i}`,
      eventId: "evt_keynote_2026",
      rating,
      createdAtIso: new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString(),
    }));
  };

  it("filters reviews correctly to 15-minute rolling window", () => {
    const recent = generateReviews(5, 5, 5); // 5 mins ago
    const old = generateReviews(5, 5, 20); // 20 mins ago

    const windowed = filterReviewsInRollingWindow([...recent, ...old], 15, now);
    expect(windowed.length).toBe(5);
  });

  it("triggers critical anomaly alert when >10 reviews in 15m average <2.0 stars", () => {
    const negativeSpike = generateReviews(12, 1, 5); // 12 1-star reviews 5 mins ago
    const alert = detectFeedbackAnomaly(
      "evt_keynote_2026",
      negativeSpike,
      ["+15550199", "+15550198"],
      {},
      now,
    );

    expect(alert.isAnomalyDetected).toBe(true);
    expect(alert.batchReviewCount).toBe(12);
    expect(alert.batchAverageRating).toBe(1.0);
    expect(alert.urgentSmsPayload?.message).toContain(
      "CRITICAL: The current event is receiving a massive spike",
    );
    expect(alert.urgentSmsPayload?.recipients).toContain("+15550199");
  });

  it("does not trigger anomaly if review count is <= 10 or average rating is >= 2.0", () => {
    // 8 1-star reviews (below count threshold of 10)
    const smallCount = generateReviews(8, 1, 5);
    const smallAlert = detectFeedbackAnomaly("evt_keynote_2026", smallCount, [], {}, now);
    expect(smallAlert.isAnomalyDetected).toBe(false);

    // 15 4-star reviews (above rating threshold of 2.0)
    const positiveSpike = generateReviews(15, 4, 5);
    const positiveAlert = detectFeedbackAnomaly("evt_keynote_2026", positiveSpike, [], {}, now);
    expect(positiveAlert.isAnomalyDetected).toBe(false);
  });
});
