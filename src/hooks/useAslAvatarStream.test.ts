import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAslAvatarStream } from "./useAslAvatarStream";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      channel: () => ({
        on: () => ({
          subscribe: vi.fn(),
        }),
      }),
      removeChannel: vi.fn(),
    }),
  };
});

describe("useAslAvatarStream", () => {
  it("initializes stream states with correct defaults", () => {
    const { result } = renderHook(() => useAslAvatarStream({ eventId: "evt-123", enabled: false }));

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentText).toBe("");
    expect(result.current.status).toBe("idle");
    expect(result.current.queueLength).toBe(0);
    expect(typeof result.current.getAslVideoTrack).toBe("function");
  });
});
