import { render, unmountComponentAtNode } from "react-dom";
import { act } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Feed from "./feed";
import * as supabaseClient from "@/lib/supabase/client";
import * as queryHooks from "@/hooks/useReactQueryReplacement";

// Mock the modules
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: vi.fn(() => ({ data: null })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useInfiniteQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    refetch: vi.fn(),
  })),
}));

vi.mock("@/components/site/SiteShell", () => ({
  SiteShell: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/PullToRefresh", () => ({
  PullToRefresh: ({ children }: any) => <div>{children}</div>,
}));

describe("Feed Component - Realtime Subscription", () => {
  let container: any = null;
  
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    unmountComponentAtNode(container);
    container.remove();
    container = null;
    vi.clearAllMocks();
  });

  it("should prevent duplicate listeners and cleanup on unmount", async () => {
    const mockUnsubscribe = vi.fn();
    const mockSubscribe = vi.fn();
    const mockOn = vi.fn().mockReturnThis();
    
    const mockChannel = {
      on: mockOn,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      topic: "realtime:realtime_feed",
    };

    const mockRemoveChannel = vi.fn();
    const mockGetChannels = vi.fn(() => [mockChannel]); // mock an existing channel

    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "1" } } }) },
      channel: vi.fn(() => mockChannel),
      removeChannel: mockRemoveChannel,
      getChannels: mockGetChannels,
    };

    (supabaseClient.createClient as any).mockReturnValue(mockSupabase);

    await act(async () => {
      // @ts-ignore
      const { createRoot } = await import("react-dom/client");
      const root = createRoot(container);
      root.render(<Feed />);
    });

    // Verify duplicate channel prevention
    expect(mockGetChannels).toHaveBeenCalled();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    expect(mockSupabase.channel).toHaveBeenCalledWith("realtime_feed");
    expect(mockSubscribe).toHaveBeenCalled();

    // Verify unmount cleanup
    await act(async () => {
      // @ts-ignore
      const { createRoot } = await import("react-dom/client");
      const root = createRoot(container);
      root.unmount();
    });

    expect(mockUnsubscribe).toHaveBeenCalled();
    // removeChannel was called twice (once for duplicate prevention, once for unmount cleanup)
    expect(mockRemoveChannel).toHaveBeenCalledTimes(2);
  });
});
