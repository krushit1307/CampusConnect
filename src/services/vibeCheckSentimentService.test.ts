import { describe, it, expect } from "vitest";
import {
  aggregateSentiments,
  classifyExpression,
  type EmotionCategory,
} from "./vibeCheckSentimentService";

describe("vibeCheckSentimentService", () => {
  it("aggregates sentiments accurately", () => {
    const stream: EmotionCategory[] = ["Confused", "Confused", "Confused", "Happy", "Neutral"];

    const stats = aggregateSentiments(stream);
    expect(stats.total).toBe(5);
    expect(stats.confused).toBe(3);
    expect(stats.confusedPercentage).toBe(60);
    expect(stats.dominantEmotion).toBe("Confused");
    expect(stats.summaryText).toContain("60% of your audience looks confused");
  });

  it("classifies expressions based on feature landmarks", () => {
    expect(classifyExpression({ eyebrowFrownConfidence: 0.8 })).toBe("Confused");
    expect(classifyExpression({ smileConfidence: 0.9 })).toBe("Happy");
    expect(classifyExpression({ eyeWideConfidence: 0.7 })).toBe("Surprised");
    expect(classifyExpression({ neutralConfidence: 0.9 })).toBe("Neutral");
  });

  it("handles empty signals gracefully", () => {
    const stats = aggregateSentiments([]);
    expect(stats.total).toBe(0);
    expect(stats.dominantEmotion).toBe("Neutral");
    expect(stats.summaryText).toContain("Waiting for attendee vibe check signals");
  });
});
