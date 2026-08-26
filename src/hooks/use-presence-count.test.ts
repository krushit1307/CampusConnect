// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthGetUser = vi.fn();
const mockTrack = vi.fn();
const mockUntrack = vi.fn();
const mockRemoveChannel = vi.fn();

// Captures the "sync" callback registered via channel.on(...) so tests can
// invoke it manually to simulate the Realtime server pushing a presence
// update, and captures the subscribe callback so tests can simulate the
// channel reaching SUBSCRIBED status.
let syncCallback: (() => void) | null = null;
let subscribeCallback: ((status: string) => void) | null = null;
let currentPresenceState: Record<string, unknown[]> = {};

const mockChannel = {
  on: vi.fn((_type: string, _filter: { event: string }, cb: () => void) => {
    syncCallback = cb;
    return mockChannel;
  }),
  subscribe: vi.fn((cb: (status: string) => void) => {
    subscribeCallback = cb;
    return mockChannel;
  }),
  track: mockTrack,
  untrack: mockUntrack,
  presenceState: vi.fn(() => currentPresenceState),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mockAuthGetUser },
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  }),
}));

import { usePresenceCount } from "./use-presence-count";

describe("usePresenceCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncCallback = null;
    subscribeCallback = null;
    currentPresenceState = {};
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("starts at count 0 and not ready before the channel subscribes", () => {
    const { result } = renderHook(() => usePresenceCount("club-abc"));
    expect(result.current.count).toBe(0);
    expect(result.current.ready).toBe(false);
  });

  it("does nothing when clubId is undefined", () => {
    renderHook(() => usePresenceCount(undefined));
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("tracks presence with the logged-in user's id once subscribed", async () => {
    renderHook(() => usePresenceCount("club-abc"));

    await waitFor(() => expect(subscribeCallback).not.toBeNull());
    act(() => subscribeCallback?.("SUBSCRIBED"));

    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1" })),
    );
  });

  it("updates count from presenceState() when a sync event fires", async () => {
    const { result } = renderHook(() => usePresenceCount("club-abc"));

    await waitFor(() => expect(syncCallback).not.toBeNull());

    currentPresenceState = {
      "user-1": [{ online_at: "now" }],
      "user-2": [{ online_at: "now" }],
      "anon-xyz": [{ online_at: "now" }],
    };
    act(() => syncCallback?.());

    await waitFor(() => expect(result.current.count).toBe(3));
    expect(result.current.ready).toBe(true);
  });

  it("untracks and removes the channel on unmount", async () => {
    const { unmount } = renderHook(() => usePresenceCount("club-abc"));
    await waitFor(() => expect(mockChannel.subscribe).toHaveBeenCalled());

    unmount();

    expect(mockUntrack).toHaveBeenCalled();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it("falls back to a random anonymous id when no user is signed in", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });
    renderHook(() => usePresenceCount("club-abc"));

    await waitFor(() => expect(subscribeCallback).not.toBeNull());
    act(() => subscribeCallback?.("SUBSCRIBED"));

    await waitFor(() => expect(mockTrack).toHaveBeenCalled());
    const trackedArg = mockTrack.mock.calls[0][0] as { user_id: string };
    expect(trackedArg.user_id).toEqual(expect.any(String));
    expect(trackedArg.user_id.length).toBeGreaterThan(0);
  });
});
