import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAudioDescriptionSync } from "./useAudioDescriptionSync";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      rpc: vi.fn().mockResolvedValue({ data: new Date().toISOString(), error: null }),
    }),
  };
});

describe("useAudioDescriptionSync", () => {
  it("initializes synchronization hook with correct defaults", () => {
    const { result } = renderHook(() =>
      useAudioDescriptionSync({
        eventId: "evt-123",
        enabled: false,
        videoElement: null,
        audioDescriptionUrl: null,
      }),
    );

    expect(result.current.isSynced).toBe(false);
    expect(result.current.ntpOffset).toBe(0);
    expect(typeof result.current.getAudioDescriptionTrack).toBe("function");
    expect(result.current.getAudioDescriptionTrack()).toBeNull();
  });
});
