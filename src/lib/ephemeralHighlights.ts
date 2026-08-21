export interface HighlightStoryItem {
  id: string;
  eventId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  createdAt: number; // Unix timestamp ms
  expiresAt: number; // Unix timestamp ms
}

export const STORY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours
export const STORY_AUTO_ADVANCE_SEC = 5;

/**
 * Filters out stories whose 24-hour TTL expiration window has passed.
 */
export function filterActiveHighlights(
  stories: HighlightStoryItem[],
  nowMs: number = Date.now(),
): HighlightStoryItem[] {
  return stories.filter((story) => story.expiresAt > nowMs);
}

/**
 * Calculates remaining TTL duration in milliseconds before a story expires.
 */
export function calculateRemainingTtlMs(
  story: HighlightStoryItem,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, story.expiresAt - nowMs);
}

/**
 * Handles story viewer navigation index increments and decrements.
 */
export function getNextStoryIndex(
  currentIndex: number,
  totalStories: number,
  direction: "NEXT" | "PREV",
): { nextIndex: number; isCompleted: boolean } {
  if (totalStories === 0) return { nextIndex: 0, isCompleted: true };

  if (direction === "NEXT") {
    const targetIndex = currentIndex + 1;
    if (targetIndex >= totalStories) {
      return { nextIndex: totalStories - 1, isCompleted: true };
    }
    return { nextIndex: targetIndex, isCompleted: false };
  } else {
    const targetIndex = Math.max(0, currentIndex - 1);
    return { nextIndex: targetIndex, isCompleted: false };
  }
}
