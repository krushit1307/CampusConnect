// src/hooks/useBroadcastState.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBroadcastState, isBroadcastSupported } from "./useBroadcastState";

// ── Mock BroadcastChannel ────────────────────────────────────────
// jsdom doesn't implement BroadcastChannel, so we provide a minimal
// in-memory mock that simulates cross-tab message delivery.

type MessageHandler = (event: MessageEvent) => void;

class MockBroadcastChannel {
  static instances: Record<string, MockBroadcastChannel[]> = {};
  name: string;
  handlers: MessageHandler[] = [];

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.instances[name]) {
      MockBroadcastChannel.instances[name] = [];
    }
    MockBroadcastChannel.instances[name].push(this);
  }

  postMessage(data: unknown) {
    // Simulate delivery to all OTHER instances on the same channel.
    const others = (MockBroadcastChannel.instances[this.name] ?? []).filter((ch) => ch !== this);
    for (const other of others) {
      for (const handler of other.handlers) {
        handler(new MessageEvent("message", { data }));
      }
    }
  }

  addEventListener(_type: string, handler: MessageHandler) {
    this.handlers.push(handler);
  }

  removeEventListener(_type: string, handler: MessageHandler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  close() {
    MockBroadcastChannel.instances[this.name] = (
      MockBroadcastChannel.instances[this.name] ?? []
    ).filter((ch) => ch !== this);
    this.handlers = [];
  }
}

describe("useBroadcastState", () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = {};
    // Install the mock globally.
    (globalThis as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel =
      MockBroadcastChannel;
  });

  afterEach(() => {
    MockBroadcastChannel.instances = {};
    vi.restoreAllMocks();
  });

  it("returns the initial state", () => {
    const { result } = renderHook(() => useBroadcastState("test", "hello"));
    expect(result.current[0]).toBe("hello");
  });

  it("supports a lazy initializer", () => {
    const { result } = renderHook(() => useBroadcastState("lazy", () => 42));
    expect(result.current[0]).toBe(42);
  });

  it("updates local state when setState is called", () => {
    const { result } = renderHook(() => useBroadcastState("local", "a"));
    act(() => result.current[1]("b"));
    expect(result.current[0]).toBe("b");
  });

  it("supports functional updates", () => {
    const { result } = renderHook(() => useBroadcastState("func", 0));
    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(1);
    act(() => result.current[1]((prev) => prev + 10));
    expect(result.current[0]).toBe(11);
  });

  it("broadcasts state changes to other tabs on the same channel", () => {
    const { result: tabA } = renderHook(() => useBroadcastState("sync", "init"));
    const { result: tabB } = renderHook(() => useBroadcastState("sync", "init"));

    // Tab A updates → Tab B should receive the broadcast.
    act(() => tabA.current[1]("updated-by-A"));

    expect(tabA.current[0]).toBe("updated-by-A");
    expect(tabB.current[0]).toBe("updated-by-A");
  });

  it("does NOT create an infinite loop when both tabs update", () => {
    const { result: tabA } = renderHook(() => useBroadcastState("loop", 0));
    const { result: tabB } = renderHook(() => useBroadcastState("loop", 0));

    // Tab A updates → Tab B receives → Tab B should NOT re-broadcast.
    act(() => tabA.current[1](1));

    expect(tabA.current[0]).toBe(1);
    expect(tabB.current[0]).toBe(1);

    // Tab B updates → Tab A receives → Tab A should NOT re-broadcast.
    act(() => tabB.current[1](2));

    expect(tabA.current[0]).toBe(2);
    expect(tabB.current[0]).toBe(2);
  });

  it("does not broadcast when the value doesn't change", () => {
    const postMessageSpy = vi.spyOn(MockBroadcastChannel.prototype, "postMessage");
    const { result } = renderHook(() => useBroadcastState("noop", "same"));
    act(() => result.current[1]("same")); // same value
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it("isolates different channels", () => {
    const { result: chanA } = renderHook(() => useBroadcastState("chanA", "a"));
    const { result: chanB } = renderHook(() => useBroadcastState("chanB", "b"));

    act(() => chanA.current[1]("updated-A"));

    expect(chanA.current[0]).toBe("updated-A");
    expect(chanB.current[0]).toBe("b"); // unchanged
  });

  it("cleans up the channel on unmount", () => {
    const { unmount } = renderHook(() => useBroadcastState("cleanup", "x"));
    expect(MockBroadcastChannel.instances["cleanup"]).toHaveLength(1);
    unmount();
    expect(MockBroadcastChannel.instances["cleanup"]).toHaveLength(0);
  });

  it("degrades gracefully when BroadcastChannel is unavailable", () => {
    // Remove the mock to simulate an unsupported environment.
    const original = (globalThis as { BroadcastChannel?: typeof MockBroadcastChannel })
      .BroadcastChannel;
    delete (globalThis as { BroadcastChannel?: typeof MockBroadcastChannel }).BroadcastChannel;

    const { result } = renderHook(() => useBroadcastState("unsupported", "fallback"));
    act(() => result.current[1]("still-works"));
    expect(result.current[0]).toBe("still-works");

    // Restore for subsequent tests.
    (globalThis as { BroadcastChannel?: typeof MockBroadcastChannel }).BroadcastChannel = original;
  });

  it("handles object state", () => {
    const { result } = renderHook(() =>
      useBroadcastState<{ name: string; count: number }>("obj", { name: "init", count: 0 }),
    );
    act(() => result.current[1]({ name: "updated", count: 5 }));
    expect(result.current[0]).toEqual({ name: "updated", count: 5 });
  });

  it("handles array state", () => {
    const { result } = renderHook(() => useBroadcastState<number[]>("arr", []));
    act(() => result.current[1]([1, 2, 3]));
    expect(result.current[0]).toEqual([1, 2, 3]);
  });
});

describe("isBroadcastSupported", () => {
  it("returns true when BroadcastChannel is defined", () => {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = MockBroadcastChannel;
    expect(isBroadcastSupported()).toBe(true);
  });

  it("returns false when BroadcastChannel is undefined", () => {
    const original = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    expect(isBroadcastSupported()).toBe(false);
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = original;
  });
});
