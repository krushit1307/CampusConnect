// =============================================================================
// Utility: Cheer Batcher (WebSocket Throttling)
// Issue: #3553 - Build a 'Live Event "Cheer/Applause" Button'
// Description: Aggregates rapid - fire cheer clicks from the user into batched
// WebSocket payloads.Prevents network flooding if 1,000 people click rapidly
// by sending a single batched event every 500ms containing the count and emojis.
// =============================================================================

export interface CheerBatch {
    event_id: string;
    emojis: { emoji: string; x_position: number }[];
    total_count: number;
    timestamp: number;
}

type BatchCallback = (batch: CheerBatch) => void;

/**
 * Creates a batcher instance that aggregates cheer clicks and flushes them
 * to the WebSocket at a controlled interval.
 * 
 * @param eventId - The ID of the live event
 * @param onFlush - Callback executed when the batch is ready to send
 * @param intervalMs - How often to flush the batch (default 500ms)
 */
export function createCheerBatcher(
    eventId: string,
    onFlush: BatchCallback,
    intervalMs: number = 500
) {
    let queue: { emoji: string; x_position: number }[] = [];
    let timer: NodeJS.Timeout | null = null;

    const flush = () => {
        if (queue.length === 0) {
            timer = null;
            return;
        }

        const batch: CheerBatch = {
            event_id: eventId,
            emojis: [...queue],
            total_count: queue.length,
            timestamp: Date.now()
        };

        onFlush(batch);
        queue = [];
        timer = null;
    };

    const addCheer = (emoji: string, xPosition: number) => {
        queue.push({ emoji, x_position: xPosition });

        // Start the timer if it's not already running
        if (!timer) {
            timer = setTimeout(flush, intervalMs);
        }
    };

    const destroy = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        queue = [];
    };

    return { addCheer, destroy };
}
