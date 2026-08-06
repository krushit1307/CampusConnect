import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTypingIndicator } from "./useTypingIndicator";

const mockTrack = vi.fn().mockResolvedValue("ok");
const mockSubscribe = vi.fn((cb) => {
  cb("SUBSCRIBED");
  return { unsubscribe: vi.fn() };
});
const mockUnsubscribe = vi.fn();
const mockPresenceState = vi.fn().mockReturnValue({});
const mockOn = vi.fn().mockImplementation((event, filter, callback) => {
  if (filter?.event === "sync") {
    // Save callback so we can simulate presence sync
    mockOn.syncCallback = callback;
  }
  return mockChannel;
});

const mockChannel = {
  on: mockOn,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  presenceState: mockPresenceState,
  track: mockTrack,
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => mockChannel,
  }),
}));

describe("useTypingIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to presence channel and tracks initial non-typing state", () => {
    renderHook(() => useTypingIndicator("chat_typing:1_2", "user-1", "Alice"));

    expect(mockSubscribe).toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith({ typing: false, username: "Alice" });
  });

  it("filters out self and parses other typing users from presence state", () => {
    mockPresenceState.mockReturnValue({
      "user-1": [{ typing: true, username: "Alice" }],
      "user-2": [{ typing: true, username: "Bob" }],
    });

    const { result } = renderHook(() => useTypingIndicator("chat_typing:1_2", "user-1", "Alice"));

    act(() => {
      if (mockOn.syncCallback) mockOn.syncCallback();
    });

    expect(result.current.typingUsers).toEqual(["Bob"]);
  });

  it("broadcasts typing state and debounces reset to false after 3s", async () => {
    const { result } = renderHook(() => useTypingIndicator("chat_typing:1_2", "user-1", "Alice"));

    act(() => {
      result.current.broadcastTyping();
    });

    expect(mockTrack).toHaveBeenCalledWith({ typing: true, username: "Alice" });

    // Advance timers by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockTrack).toHaveBeenCalledWith({ typing: false, username: "Alice" });
  });

  it("immediately clears typing state when clearTyping is called", () => {
    const { result } = renderHook(() => useTypingIndicator("chat_typing:1_2", "user-1", "Alice"));

    act(() => {
      result.current.broadcastTyping();
      result.current.clearTyping();
    });

    expect(mockTrack).toHaveBeenLastCalledWith({ typing: false, username: "Alice" });
  });
});
