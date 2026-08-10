import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRealtimeComments } from "./useRealtimeComments";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => {
  const mockRemoveChannel = vi.fn();
  const mockSubscribe = vi.fn();
  const mockOn = vi.fn().mockImplementation(() => ({ subscribe: mockSubscribe }));
  const mockChannel = vi.fn().mockImplementation(() => ({ on: mockOn }));

  return {
    createClient: vi.fn().mockImplementation(() => ({
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "user-1", full_name: "Test User", handle: "testuser" },
            }),
          }),
        }),
      }),
    })),
  };
});

describe("useRealtimeComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to filtered realtime channel comments:post_id=eq.<postId>", () => {
    const onNewComment = vi.fn();
    const supabase = createClient();

    renderHook(() =>
      useRealtimeComments({
        postId: "post-123",
        enabled: true,
        onNewComment,
      }),
    );

    expect(supabase.channel).toHaveBeenCalledWith("comments:post_id=eq.post-123");
  });

  it("does not subscribe when disabled or postId is null", () => {
    const onNewComment = vi.fn();
    const supabase = createClient();

    renderHook(() =>
      useRealtimeComments({
        postId: null,
        enabled: true,
        onNewComment,
      }),
    );

    expect(supabase.channel).not.toHaveBeenCalled();
  });
});
