export interface IdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

export type IdleCallback = (deadline: IdleDeadline) => void;

/**
 * Executes a callback during the browser's idle periods.
 * Safely polyfills Safari and other environments lacking native requestIdleCallback.
 */
export function runIdle(callback: IdleCallback, options?: { timeout?: number }): number {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    return (window as any).requestIdleCallback(callback, options);
  }
  const start = Date.now();
  return window.setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, 1);
}

/**
 * Cancels a callback previously scheduled with runIdle.
 */
export function cancelIdle(id: number): void {
  if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
    (window as any).cancelIdleCallback(id);
    return;
  }
  window.clearTimeout(id);
}

/**
 * Runs a list of tasks cooperatively in chunked idle periods.
 * Yields control back to the main thread when deadline.timeRemaining() drops to 0.
 */
export function runIdleChunks(tasks: Array<() => void>): void {
  let taskIndex = 0;

  function run(deadline: IdleDeadline) {
    while (taskIndex < tasks.length && (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
      try {
        tasks[taskIndex]();
      } catch (err) {
        console.error("[Idle Scheduler] Error executing task:", err);
      }
      taskIndex++;
    }

    if (taskIndex < tasks.length) {
      runIdle(run);
    }
  }

  if (tasks.length > 0) {
    runIdle(run);
  }
}
