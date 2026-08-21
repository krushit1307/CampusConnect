import { refreshAnalyticsCache } from "./analytics";

export type AnalyticsTask = () => void | Promise<void>;

const queue: AnalyticsTask[] = [];
let isScheduled = false;

async function drainQueue(): Promise<void> {
  while (queue.length > 0) {
    const task = queue.shift();
    if (task) {
      try {
        await task();
      } catch (error) {
        console.error("[AnalyticsQueue] Error executing task:", error);
      }
    }
  }

  isScheduled = false;

  if (queue.length > 0) {
    scheduleDrain();
  }
}

function scheduleDrain(): void {
  if (isScheduled) return;

  isScheduled = true;

  if (typeof window === "undefined") {
    void drainQueue();
    return;
  }

  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
      () => {
        void drainQueue();
      },
    );
  } else {
    window.setTimeout(() => {
      void drainQueue();
    }, 0);
  }
}

export function enqueueAnalytics(task: AnalyticsTask): void {
  queue.push(task);
  scheduleDrain();
}

export function enqueueCacheRefresh(): void {
  enqueueAnalytics(async () => {
    await refreshAnalyticsCache();
  });
}
