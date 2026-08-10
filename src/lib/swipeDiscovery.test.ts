import { describe, it, expect } from "vitest";
import {
  determineSwipeAction,
  processCardSwipe,
  SWIPE_THRESHOLD_PX,
  PREFETCH_STACK_THRESHOLD,
  SwipeEventCard,
} from "./swipeDiscovery";

describe("Tinder-Style Swipe Discovery UI Suite (#2678)", () => {
  const sampleStack: SwipeEventCard[] = Array.from({ length: 5 }, (_, i) => ({
    id: `event_${i + 1}`,
    title: `Campus Event ${i + 1}`,
    category: "Social",
    dateText: "Tomorrow at 5 PM",
  }));

  it("determines swipe intent based on horizontal drag offset", () => {
    expect(determineSwipeAction(SWIPE_THRESHOLD_PX + 10)).toBe("LIKE");
    expect(determineSwipeAction(-SWIPE_THRESHOLD_PX - 10)).toBe("DISMISS");
    expect(determineSwipeAction(50)).toBeNull();
  });

  it("removes swiped card from active stack and returns action payload", () => {
    const result = processCardSwipe(sampleStack, "event_1", "LIKE");

    expect(result.updatedStack.length).toBe(4);
    expect(result.swipedEvent?.title).toBe("Campus Event 1");
    expect(result.actionPayload).toEqual({
      eventId: "event_1",
      action: "LIKE",
    });
    expect(result.shouldPrefetch).toBe(false);
  });

  it("triggers prefetch flag when stack count falls to threshold", () => {
    // Reduce stack to 4 items and swipe 1 item -> remaining 3 (<= threshold)
    const smallStack = sampleStack.slice(0, 4);
    const result = processCardSwipe(smallStack, "event_1", "DISMISS");

    expect(result.updatedStack.length).toBe(3);
    expect(result.shouldPrefetch).toBe(true);
  });
});
