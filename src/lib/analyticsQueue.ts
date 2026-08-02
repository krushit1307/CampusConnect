type AnalyticsTask = () => void;

const queue: AnalyticsTask[] = [];
let isScheduled = false;

function drainQueue(): void {
  while (queue.length > 0) {
    const task = queue.shift();
    task?.();
  }

  isScheduled = false;

  // If new tasks were queued while draining, schedule again.
  if (queue.length > 0) {
    scheduleDrain();
  }
}

function scheduleDrain(): void {
  if (isScheduled) return;

  isScheduled = true;

  if (typeof window === "undefined") {
    drainQueue();
    return;
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      drainQueue();
    });
  } else {
    setTimeout(() => {
      drainQueue();
    }, 0);
  }
}

export function enqueueAnalytics(task: AnalyticsTask): void {
  queue.push(task);
  scheduleDrain();
}
