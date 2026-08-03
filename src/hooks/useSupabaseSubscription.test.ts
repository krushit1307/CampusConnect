import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSupabaseSubscription } from "./useSupabaseSubscription";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((callback) => {
      if (callback) callback("SUBSCRIBED");
      return mockChannel;
    }),
  };

  const mockSupabase = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn().mockResolvedValue("ok"),
  };

  return {
    createClient: vi.fn().mockReturnValue(mockSupabase),
  };
});

describe("useSupabaseSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to table with default options on mount", () => {
    const { result } = renderHook(() =>
      useSupabaseSubscription({
        table: "events",
      }),
    );

    const supabase = createClient();
    expect(supabase.channel).toHaveBeenCalledWith("realtime_public_events_*");
    expect(result.current.status).toBe("SUBSCRIBED");
    expect(result.current.error).toBeNull();
  });

  it("subscribes using positional arguments signature", () => {
    const onDataMock = vi.fn();
    const { result } = renderHook(() =>
      useSupabaseSubscription("notifications", "user_id=eq.123", onDataMock),
    );

    const supabase = createClient();
    expect(supabase.channel).toHaveBeenCalledWith("realtime_public_notifications_*_user_id=eq.123");
    expect(result.current.status).toBe("SUBSCRIBED");
  });

  it("unsubscribes and calls removeChannel on unmount", () => {
    const { unmount } = renderHook(() =>
      useSupabaseSubscription({
        table: "posts",
        event: "INSERT",
      }),
    );

    const supabase = createClient();
    expect(supabase.channel).toHaveBeenCalledWith("realtime_public_posts_insert");

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it("does not subscribe when enabled is false", () => {
    const { result } = renderHook(() =>
      useSupabaseSubscription({
        table: "comments",
        enabled: false,
      }),
    );

    const supabase = createClient();
    expect(supabase.channel).not.toHaveBeenCalled();
    expect(result.current.status).toBe("IDLE");
  });
});
