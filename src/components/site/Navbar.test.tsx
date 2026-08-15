import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "./Navbar";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
  getSupabaseUrl: () => "https://mock.supabase.co",
}));

let mockUser: { id: string; email: string } | null = {
  id: "user-1",
  email: "streak_student@campus.edu",
};

vi.mock("@/hooks/useAuthHydration", () => ({
  useAuthHydration: () => ({
    user: mockUser,
    isInitializing: false,
  }),
}));

let mockProfile = {
  current_streak: 5,
};

const mockSupabase = {
  from: vi.fn().mockImplementation((table) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
  }),
  auth: {
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: "user-1", email: "streak_student@campus.edu" };
  mockProfile = { current_streak: 5 };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Navbar Streak Indicator UI", () => {
  it("renders fiery streak badge when user has active streak", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <Navbar />
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    // Expect the fiery streak text to be displayed
    const streakElement = await screen.findByText("5 Week Streak!");
    expect(streakElement).toBeInTheDocument();
    expect(screen.getByText("🔥")).toBeInTheDocument();
  });

  it("does not render streak badge when user streak is 0", async () => {
    mockProfile.current_streak = 0;

    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <Navbar />
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    // Give react-query time to resolve the cache/data
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByText("0 Week Streak!")).not.toBeInTheDocument();
    expect(screen.queryByText("🔥")).not.toBeInTheDocument();
  });

  it("does not render streak badge when user is logged out", async () => {
    mockUser = null;

    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <Navbar />
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByText("🔥")).not.toBeInTheDocument();
  });
});
