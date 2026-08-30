import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TutoringBoard from "./tutoring";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { useAuthStore } from "@/store/useAuthStore";

const mockQueryClient = queryClient;

const mockUser = { id: "user-123", email: "test@example.com", name: "Test User", role: "user" };

vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: vi.fn(() => ({ user: mockUser })),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === "tutoring_balances") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { balance: 5 }, error: null }),
        };
      }
      if (table === "tutoring_listings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "listing-1",
                user_id: "user-456",
                listing_type: "offer",
                subject: "Calculus",
                description: "I can teach Calculus.",
                status: "open",
                created_at: new Date().toISOString(),
                profiles: { full_name: "Alice" },
              },
            ],
            error: null,
          }),
        };
      }
      if (table === "tutoring_sessions") {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }
      return {};
    }),
    rpc: vi.fn().mockResolvedValue({ data: "fake-id", error: null }),
  },
}));

function renderWithProviders(ui: React.ReactNode) {
  return render(<QueryClientProvider client={mockQueryClient}>{ui}</QueryClientProvider>);
}

describe("TutoringBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryClient.clear();
  });

  it("renders the tutoring board and balance", async () => {
    renderWithProviders(<TutoringBoard />);
    expect(screen.getByText("Tutoring & Time-Banking")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("5 Credits")).toBeInTheDocument();
    });
  });

  it("renders open listings", async () => {
    renderWithProviders(<TutoringBoard />);

    await waitFor(() => {
      expect(screen.getByText("Calculus")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("I can teach Calculus.")).toBeInTheDocument();
    });
  });
});
