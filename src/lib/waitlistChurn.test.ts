import { describe, expect, it } from "vitest";
import {
  formatChurnBucket,
  getRecommendedOverbookCapacity,
  type WaitlistChurnPrediction,
} from "./waitlistChurn";

describe("waitlist churn recommendations", () => {
  const prediction: Pick<
    WaitlistChurnPrediction,
    "capacity" | "expected_no_shows" | "recommended_overbook_capacity"
  > = {
    capacity: 500,
    expected_no_shows: 45,
    recommended_overbook_capacity: 545,
  };

  it("scales the recommendation by the selected risk posture", () => {
    expect(getRecommendedOverbookCapacity(prediction, "conservative")).toBe(523);
    expect(getRecommendedOverbookCapacity(prediction, "balanced")).toBe(534);
    expect(getRecommendedOverbookCapacity(prediction, "aggressive")).toBe(545);
  });

  it("never exceeds the model ceiling", () => {
    expect(
      getRecommendedOverbookCapacity(
        { ...prediction, expected_no_shows: 100, recommended_overbook_capacity: 550 },
        "aggressive",
      ),
    ).toBe(550);
  });

  it("formats prediction checkpoints for chart labels", () => {
    expect(formatChurnBucket(168)).toBe("7d before");
    expect(formatChurnBucket(48)).toBe("2d before");
    expect(formatChurnBucket(2)).toBe("2h before");
    expect(formatChurnBucket(0)).toBe("Event start");
  });
});
