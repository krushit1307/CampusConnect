/**
 * Analytics Web Worker
 * Offloads heavy Array.reduce() and mathematical aggregation from the main UI thread.
 *
 * Bundling Note: Uses `new URL('...', import.meta.url)` in the main thread
 * to ensure Vite/Next.js correctly bundles this into a separate JS file in production.
 */

interface RawEventData {
  id: string;
  category: string;
  revenue: number;
  attendees: number;
  durationMinutes: number;
  date: string;
}

interface AggregatedStats {
  totalEvents: number;
  totalRevenue: number;
  averageAttendees: number;
  maxDuration: number;
  categoryBreakdown: Record<string, { count: number; revenue: number }>;
}

/**
 * Heavy mathematical aggregation function.
 * Simulates processing a 5MB JSON array of raw event data.
 */
function processAnalyticsData(data: RawEventData[]): AggregatedStats {
  console.log(`[Worker] Starting heavy processing on ${data.length} records...`);
  const startTime = performance.now();

  const stats = data.reduce<AggregatedStats>(
    (acc, curr) => {
      acc.totalEvents += 1;
      acc.totalRevenue += curr.revenue;
      acc.maxDuration = Math.max(acc.maxDuration, curr.durationMinutes);

      if (!acc.categoryBreakdown[curr.category]) {
        acc.categoryBreakdown[curr.category] = { count: 0, revenue: 0 };
      }
      acc.categoryBreakdown[curr.category].count += 1;
      acc.categoryBreakdown[curr.category].revenue += curr.revenue;

      return acc;
    },
    {
      totalEvents: 0,
      totalRevenue: 0,
      averageAttendees: 0,
      maxDuration: 0,
      categoryBreakdown: {},
    },
  );

  // Calculate averages post-reduction
  stats.averageAttendees =
    stats.totalEvents > 0
      ? data.reduce((sum, item) => sum + item.attendees, 0) / stats.totalEvents
      : 0;

  const endTime = performance.now();
  console.log(`[Worker] Processing completed in ${(endTime - startTime).toFixed(2)}ms`);

  return stats;
}

// Listen for messages from the main thread
self.addEventListener("message", (event: MessageEvent) => {
  try {
    const rawData: RawEventData[] = event.data;

    if (!Array.isArray(rawData)) {
      throw new Error("Invalid data format: expected an array");
    }

    const result = processAnalyticsData(rawData);

    // Send the result back to the main thread
    self.postMessage({ type: "SUCCESS", payload: result });
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      payload: error instanceof Error ? error.message : "Unknown worker error",
    });
  }
});

// Export for testing purposes (Vite handles this gracefully in worker context)
export { processAnalyticsData };
export type { RawEventData, AggregatedStats };
