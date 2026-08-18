import { describe, it, expect } from "vitest";
import { evaluateImageSafety, MODERATION_THRESHOLDS } from "./contentModeration";

describe("Content Moderation AI Suite (#2673)", () => {
  it("approves clean images with low risk scores", () => {
    const cleanScores = { adult: 0.1, violence: 0.05, racy: 0.2 };
    const result = evaluateImageSafety(cleanScores);

    expect(result.isFlagged).toBe(false);
    expect(result.moderatedStatus).toBe("APPROVED");
    expect(result.reason).toBeUndefined();
  });

  it("flags inappropriate adult images exceeding threshold", () => {
    const adultScores = { adult: 0.95, violence: 0.1, racy: 0.4 };
    const result = evaluateImageSafety(adultScores);

    expect(result.isFlagged).toBe(true);
    expect(result.moderatedStatus).toBe("FLAGGED");
    expect(result.reason).toContain("Adult content threshold exceeded");
  });

  it("flags violent images exceeding threshold", () => {
    const violentScores = { adult: 0.2, violence: 0.85, racy: 0.1 };
    const result = evaluateImageSafety(violentScores);

    expect(result.isFlagged).toBe(true);
    expect(result.moderatedStatus).toBe("FLAGGED");
    expect(result.reason).toContain("Violence threshold exceeded");
  });
});
