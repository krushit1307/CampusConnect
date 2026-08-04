import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import NotificationsRoute from "./notifications";

// Mock Supabase client
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } });
const mockSelect = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn().mockImplementation((table) => {
      if (table === "notifications") {
        return {
          select: mockSelect,
        };
      }
      return {};
    }),
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
        <MemoryRouter>
          <NotificationsRoute />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Verify page header elements render
    await waitFor(() => {
      expect(screen.getByText("My Notifications")).toBeInTheDocument();
    });

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Unread")).toBeInTheDocument();
  });
});
