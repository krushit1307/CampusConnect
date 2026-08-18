import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BreadcrumbProvider } from "@/components/BreadcrumbsContext";
import NotificationsRoute from "./notifications";

const { mockGetUser, mockSelect, mockProfiles } = vi.hoisted(() => ({
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
  mockSelect: vi.fn(),
  mockProfiles: { data: [] as any[] },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-123", email_confirmed_at: "2026-01-01" } } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockImplementation((table) => {
      if (table === "notifications") {
        return {
          select: mockSelect,
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockImplementation(() => Promise.resolve({ data: mockProfiles.data, error: null })),
          }),
        };
      }
      return {};
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("@/hooks/useGraphQLSubscription", () => ({
  useGraphQLSubscription: () => ({ data: null, connected: false }),
}));

describe("NotificationsRoute Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders notifications list and toolbar", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <BreadcrumbProvider>
              <MemoryRouter>
                <NotificationsRoute />
              </MemoryRouter>
            </BreadcrumbProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    // Verify page header elements render
    await waitFor(() => {
      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Unread")).toBeInTheDocument();
  });

  it("renders dynamic grouped message for post likes", async () => {
    // 1. Setup mock notifications & profiles
    const mockNotifications = [
      {
        id: "notif-123",
        user_id: "user-123",
        type: "post_like",
        title: "New Like",
        message: "Original message",
        is_read: false,
        created_at: new Date().toISOString(),
        recent_actors: ["actor-1", "actor-2"],
        group_count: 5,
        reference_id: "post-123",
      },
    ];

    mockProfiles.data = [
      { id: "actor-1", first_name: "Alice", last_name: "Smith", handle: "alice" },
      { id: "actor-2", first_name: "Bob", last_name: "Jones", handle: "bob" },
    ];

    // Mock query chain for select() from notifications
    const mockQueryBuilder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
    };
    mockSelect.mockReturnValue(mockQueryBuilder);

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <BreadcrumbProvider>
              <MemoryRouter>
                <NotificationsRoute />
              </MemoryRouter>
            </BreadcrumbProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    // Verify it renders the dynamic "and X others" text
    // group_count = 5, names are Alice Smith and Bob Jones. So dynamic message should be:
    // "Alice Smith, Bob Jones, and 3 others liked your post."
    await waitFor(() => {
      expect(screen.getByText("Alice Smith, Bob Jones, and 3 others liked your post.")).toBeInTheDocument();
    });
  });
});
