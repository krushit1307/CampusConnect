import { useSessionRecoveryStore } from "@/store/useSessionRecoveryStore";

export interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (reason?: any) => void;
}

let failedQueue: QueuedRequest[] = [];

/**
 * Adds a failed 401 request promise handler to the session recovery queue.
 */
export function enqueueFailedRequest(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  });
}

/**
 * Resolves or rejects all paused requests waiting in the session recovery queue.
 *
 * @param error Error if recovery failed or was cancelled
 * @param token Fresh access token if recovery succeeded
 */
export function processQueue(error: any | null = null, token: string | null = null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    } else {
      prom.reject(new Error("Session recovery failed without error or token"));
    }
  });

  failedQueue = [];
}

/**
 * Returns the current queue length (for testing & state assertions).
 */
export function getFailedQueueLength(): number {
  return failedQueue.length;
}

/**
 * Clears the failed queue (for state reset).
 */
export function clearFailedQueue(): void {
  failedQueue = [];
}

/**
 * Triggers session recovery process: opens modal once and locks recovery state.
 */
export function triggerSessionRecovery(userEmail?: string | null): void {
  const store = useSessionRecoveryStore.getState();
  if (!store.isRecoveryInProgress) {
    store.openModal(userEmail);
  }
}
