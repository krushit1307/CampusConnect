import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

let mockProfile: Record<string, unknown> = {
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
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  },
  channel: vi.fn().mockImplementation(() => {
    const channel: Record<string, unknown> = {};
    channel.on = vi.fn().mockReturnValue(channel);
    channel.subscribe = vi.fn().mockReturnValue(channel);
    return channel;
  }),
  removeChannel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: "user-1", email: "streak_student@campus.edu" };
  mockProfile = { current_streak: 5 } as Record<string, unknown>;
  queryClient.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Navbar avatar completion ring UI (#2389)", () => {
  const renderNavbar = () =>
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

  it("wraps the user menu trigger in an animated completion ring", async () => {
    renderNavbar();

    // Navbar currently renders its action cluster twice (pre-existing duplication),
    // so query for all instances and verify each trigger.
    const triggers = await screen.findAllByRole("button", { name: /user menu/i });
    expect(triggers.length).toBeGreaterThan(0);

    for (const trigger of triggers) {
      const svg = trigger.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(trigger.querySelectorAll("svg circle")).toHaveLength(2);
    }
  });

  it("reflects profile completion from the profiles table", async () => {
    mockProfile = {
      avatar_url: "https://example.com/a.png",
      bio: "hello",
      college: "Engineering",
      skills: ["react"],
    };

    renderNavbar();

    const triggers = await screen.findAllByRole("button", { name: /user menu/i });
    await waitFor(
      () => {
        for (const trigger of triggers) {
          expect(trigger).toHaveAttribute("title", "Profile 100% complete");
        }
      },
      { timeout: 2000 },
    );
  });

  it("does not render the user menu when user is logged out", async () => {
    mockUser = null;

    renderNavbar();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryAllByRole("button", { name: /user menu/i })).toHaveLength(0);
    expect(screen.getAllByText("Sign in").length).toBeGreaterThan(0);
  });
});
