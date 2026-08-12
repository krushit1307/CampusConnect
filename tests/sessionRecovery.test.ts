import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueueFailedRequest,
  processQueue,
  clearFailedQueue,
  getFailedQueueLength,
  triggerSessionRecovery,
} from "@/lib/sessionRecovery";
import { useSessionRecoveryStore } from "@/store/useSessionRecoveryStore";

describe("Session Recovery Interceptor & Queue Manager", () => {
  beforeEach(() => {
    clearFailedQueue();
    useSessionRecoveryStore.getState().reset();
  });

  it("should queue failed 401 requests and pause promise execution", async () => {
    const promise1 = enqueueFailedRequest();
    const promise2 = enqueueFailedRequest();

    expect(getFailedQueueLength()).toBe(2);

    // Resolve queued requests with fresh token
    processQueue(null, "fresh_jwt_token_999");

    const result1 = await promise1;
    const result2 = await promise2;

    expect(result1).toBe("fresh_jwt_token_999");
    expect(result2).toBe("fresh_jwt_token_999");
    expect(getFailedQueueLength()).toBe(0);
  });

  it("should implement locking mechanism for parallel 401s (triggering modal open only ONCE)", () => {
    const store = useSessionRecoveryStore.getState();

    // 5 parallel 401 requests fire simultaneously
    triggerSessionRecovery("user@example.com");
    triggerSessionRecovery("user@example.com");
    triggerSessionRecovery("user@example.com");
    triggerSessionRecovery("user@example.com");
    triggerSessionRecovery("user@example.com");

    const state = useSessionRecoveryStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.isRecoveryInProgress).toBe(true);
    expect(state.userEmail).toBe("user@example.com");
  });

  it("should reject all queued requests when recovery is cancelled or fails", async () => {
    const promise1 = enqueueFailedRequest();
    const promise2 = enqueueFailedRequest();

    processQueue(new Error("Session recovery cancelled by user"));

    await expect(promise1).rejects.toThrow("Session recovery cancelled by user");
    await expect(promise2).rejects.toThrow("Session recovery cancelled by user");
    expect(getFailedQueueLength()).toBe(0);
  });
});
