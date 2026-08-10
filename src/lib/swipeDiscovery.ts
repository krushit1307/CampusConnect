export interface SwipeEventCard {
  id: string;
  title: string;
  category: string;
  imageUrl?: string;
  dateText: string;
}

export type SwipeDirection = "LIKE" | "DISMISS";

export interface SwipeActionPayload {
  eventId: string;
  action: SwipeDirection;
}

export const SWIPE_THRESHOLD_PX = 100;
export const PREFETCH_STACK_THRESHOLD = 3;

/**
 * Calculates swipe action based on horizontal displacement offset.
 */
export function determineSwipeAction(xOffset: number): SwipeDirection | null {
  if (xOffset >= SWIPE_THRESHOLD_PX) return "LIKE";
  if (xOffset <= -SWIPE_THRESHOLD_PX) return "DISMISS";
  return null;
}

/**
 * Manages event stack queue state and flags when prefetching is needed.
 */
export function processCardSwipe(
  currentStack: SwipeEventCard[],
  swipedCardId: string,
  direction: SwipeDirection,
): {
  updatedStack: SwipeEventCard[];
  swipedEvent: SwipeEventCard | undefined;
  actionPayload: SwipeActionPayload;
  shouldPrefetch: boolean;
} {
  const swipedEvent = currentStack.find((card) => card.id === swipedCardId);
  const updatedStack = currentStack.filter((card) => card.id !== swipedCardId);
  const shouldPrefetch = updatedStack.length <= PREFETCH_STACK_THRESHOLD;

  return {
    updatedStack,
    swipedEvent,
    actionPayload: {
      eventId: swipedCardId,
      action: direction,
    },
    shouldPrefetch,
  };
}
