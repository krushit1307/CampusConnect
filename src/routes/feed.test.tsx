import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Feed from "./feed";
import * as supabaseClient from "@/lib/supabase/client";

// Mock the modules
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: vi.fn(() => ({ data: [] })),
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
  SiteShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/PullToRefresh", () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/MarkdownEditorWithMentions", () => ({
  MarkdownEditorWithMentions: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (val: string) => void;
  }) => <textarea value={value} onChange={(e) => onChange?.(e.target.value)} />,
}));

describe("Feed Component - Realtime Subscription", () => {
  let unmount: (() => void) | null = null;

  afterEach(() => {
    if (unmount) {
      unmount();
      unmount = null;
    }
    vi.clearAllMocks();
  });

  it("should prevent duplicate listeners and cleanup on unmount", async () => {
    const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
    const mockSubscribe = vi.fn().mockReturnThis();
    const mockOn = vi.fn().mockReturnThis();

    const mockChannel = {
      on: mockOn,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      presenceState: vi.fn().mockReturnValue({}),
      track: vi.fn().mockResolvedValue("ok"),
      topic: "realtime:realtime_feed",
    };

    const mockRemoveChannel = vi.fn().mockResolvedValue(undefined);
    const mockGetChannels = vi.fn(() => [mockChannel]);

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "1" } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      channel: vi.fn(() => mockChannel),
      removeChannel: mockRemoveChannel,
      getChannels: mockGetChannels,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    vi.mocked(supabaseClient.createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof supabaseClient.createClient>,
    );

    const result = render(<Feed />);
    unmount = result.unmount;

    // Verify duplicate channel prevention
    await waitFor(() => {
      expect(mockGetChannels).toHaveBeenCalled();
      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
      expect(mockSupabase.channel).toHaveBeenCalledWith("realtime_feed");
      expect(mockSubscribe).toHaveBeenCalled();
    });

    // Trigger unmount to test cleanup
    result.unmount();
    unmount = null;

    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
