/* eslint-disable local-rules/no-cross-page-imports */
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import ClubsIndex from "./clubs.index";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
      track: vi.fn().mockResolvedValue("ok"),
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [
            {
              id: "1",
              name: "Robotics Club",
              slug: "robotics-club",
              description: "Build cool robots and compete.",
              club_stats: [{ total_members: 42, total_events: 5, total_posts: 10 }],
            },
            {
              id: "2",
              name: "Drama Society",
              slug: "drama-society",
              description: "Theater and acting performance.",
              club_stats: [{ total_members: 28, total_events: 3, total_posts: 7 }],
            },
          ],
          count: 2,
        }),
      }),
    }),
  }),
}));

describe("ClubsIndex Component", () => {
  it("renders search input and category filter buttons", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <ClubsIndex />
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    expect(screen.getByPlaceholderText("Search clubs by name or interest...")).toBeInTheDocument();
    expect(screen.getByText("Category Filter:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tech" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cultural" })).toBeInTheDocument();
  });

  it("filters clubs when searching and shows EmptyState when no results match", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <ClubsIndex />
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    const searchInput = screen.getByPlaceholderText("Search clubs by name or interest...");

    // Type a non-matching query into search input
    fireEvent.change(searchInput, { target: { value: "NonExistentClubXYZ" } });

    await waitFor(() => {
      expect(screen.getByText('No clubs match "NonExistentClubXYZ"')).toBeInTheDocument();
    });

    // Verify clear search button resets the filter
    const clearBtn = screen.getByRole("button", { name: "Clear Search Filter" });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(searchInput).toHaveValue("");
    });
  });

  it("prefetches club details on hover", async () => {
    const prefetchSpy = vi.spyOn(queryClient, "prefetchQuery").mockResolvedValue(undefined);

    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <ClubsIndex />
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    const clubLink = await screen.findByRole("link", { name: /Robotics Club/i });
    fireEvent.mouseEnter(clubLink);

    await waitFor(() => {
      expect(prefetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["club", "robotics-club"] }),
      );
    });

    prefetchSpy.mockRestore();
  });
});
