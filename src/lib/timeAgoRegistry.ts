import { formatTimeAgo } from "./formatTimeAgo";

interface RegisteredItem {
  el: HTMLSpanElement;
  date: string | Date | number;
}

const registry = new Set<RegisteredItem>();
let intervalId: ReturnType<typeof setInterval> | null = null;
const UPDATE_INTERVAL_MS = 10000; // Update DOM refs every 10 seconds

/**
 * Global tick that updates innerText of all registered DOM span elements directly
 * bypassing React Virtual DOM and component re-renders completely.
 */
export function tickGlobalTimeAgo(): void {
  const toDelete: RegisteredItem[] = [];

  registry.forEach((item) => {
    // Check if element is still connected to the DOM document
    if (!item.el || !document.body.contains(item.el)) {
      toDelete.push(item);
      return;
    }

    const newText = formatTimeAgo(item.date);
    if (item.el.textContent !== newText) {
      item.el.textContent = newText;
    }
  });

  toDelete.forEach((item) => registry.delete(item));

  if (registry.size === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Start global timer interval if not already running
 */
function ensureIntervalRunning(): void {
  if (intervalId === null && typeof window !== "undefined") {
    intervalId = setInterval(tickGlobalTimeAgo, UPDATE_INTERVAL_MS);
  }
}

/**
 * Register a DOM span ref to be updated by the central time-ago interval.
 * Returns an unregister cleanup function.
 */
export function registerTimeAgo(el: HTMLSpanElement, date: string | Date | number): () => void {
  if (!el || !date) return () => {};

  const item: RegisteredItem = { el, date };
  registry.add(item);

  // Immediately update text once upon registration
  const text = formatTimeAgo(date);
  if (el.textContent !== text) {
    el.textContent = text;
  }

  ensureIntervalRunning();

  return () => {
    registry.delete(item);
    if (registry.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

/**
 * Returns current size of global registry (useful for testing/debugging)
 */
export function getRegisteredTimeAgoCount(): number {
  return registry.size;
}

/**
 * Reset registry and clear timer (used for test teardowns)
 */
export function resetTimeAgoRegistry(): void {
  registry.clear();
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
