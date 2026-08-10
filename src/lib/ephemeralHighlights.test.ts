import { describe, it, expect } from "vitest";
import {
  filterActiveHighlights,
  calculateRemainingTtlMs,
  getNextStoryIndex,
  STORY_DURATION_MS,
  HighlightStoryItem,
} from "./ephemeralHighlights";

describe("Ephemeral Event Highlights Suite (#2682)", () => {
  const baseTime = 1000000000000;

  const sampleStories: HighlightStoryItem[] = [
    {
      id: "story_1",
      eventId: "e1",
      mediaUrl: "https://example.com/photo1.jpg",
      mediaType: "image",
      createdAt: baseTime,
      expiresAt: baseTime + STORY_DURATION_MS,
    },
    {
      id: "story_expired",
      eventId: "e1",
      mediaUrl: "https://example.com/photo2.jpg",
      mediaType: "image",
      createdAt: baseTime - STORY_DURATION_MS - 1000,
      expiresAt: baseTime - 1000, // Expired 1 second ago
    },
  ];

  it("filters out expired stories based on 24-hour TTL", () => {
    const active = filterActiveHighlights(sampleStories, baseTime);

    expect(active.length).toBe(1);
    expect(active[0].id).toBe("story_1");
  });

  it("calculates remaining story TTL milliseconds correctly", () => {
    const remaining = calculateRemainingTtlMs(sampleStories[0], baseTime + 1000);
    expect(remaining).toBe(STORY_DURATION_MS - 1000);
  });

  it("handles story viewer navigation bounds and auto-completion", () => {
    // Advance next
    const step1 = getNextStoryIndex(0, 3, "NEXT");
    expect(step1.nextIndex).toBe(1);
    expect(step1.isCompleted).toBe(false);

    // End of stories
    const stepEnd = getNextStoryIndex(2, 3, "NEXT");
    expect(stepEnd.nextIndex).toBe(2);
    expect(stepEnd.isCompleted).toBe(true);

    // Previous navigation clamped at 0
    const stepPrev = getNextStoryIndex(0, 3, "PREV");
    expect(stepPrev.nextIndex).toBe(0);
    expect(stepPrev.isCompleted).toBe(false);
  });
});
