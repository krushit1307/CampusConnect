import { describe, it, expect, vi, beforeEach } from "vitest";
import { runIdle, cancelIdle, runIdleChunks } from "./idle";

describe("runIdle / cancelIdle Utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers callback during idle fallback", async () => {
    const callback = vi.fn();
    const id = runIdle(callback);
    expect(id).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(callback).toHaveBeenCalled();
  });

  it("can cancel scheduled idle task", async () => {
    const callback = vi.fn();
    const id = runIdle(callback);
    cancelIdle(id);

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(callback).not.toHaveBeenCalled();
  });

  it("cooperatively executes runIdleChunks task array", async () => {
    const task1 = vi.fn();
    const task2 = vi.fn();
    runIdleChunks([task1, task2]);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(task1).toHaveBeenCalled();
    expect(task2).toHaveBeenCalled();
  });
});
