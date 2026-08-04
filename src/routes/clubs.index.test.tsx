import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import ClubsIndex from "./clubs.index";

vi.mock("@/components/site/SiteShell", () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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

const mockClubs = [
  {
    id: "1",
    name: "Robotics Club",
    slug: "robotics-club",
    description: "Build cool robots and compete.",
    category: "Tech",
    club_stats: [{ total_members: 42, total_events: 5, total_posts: 10 }],
    club_tags: [
      { tag_id: "t1", club_tag_labels: { name: "Tech" } },
      { tag_id: "t2", club_tag_labels: { name: "Robotics" } },
    ],
  },
  {
    id: "2",
    name: "Drama Society",
    slug: "drama-society",
    description: "Theater and acting performance.",
    category: "Cultural",
    club_stats: [{ total_members: 28, total_events: 3, total_posts: 7 }],
    club_tags: [{ tag_id: "t3", club_tag_labels: { name: "Art" } }],
  },
];

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
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
    rpc: vi.fn().mockRejectedValue(new Error("rpc disabled in tests")),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "club_tag_labels") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ name: "Tech" }, { name: "Music" }, { name: "Art" }],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockResolvedValue({
          data: mockClubs,
          error: null,
        }),
      };
    }),
  }),
}));

const renderClubsIndex = (initialEntries = ["/clubs"]) =>
  render(
    <ThemeProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            <ClubsIndex />
          </MemoryRouter>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>,
  );

describe("ClubsIndex Component", () => {
  it("renders search input and category filter buttons", async () => {
    renderClubsIndex();

    expect(screen.getByPlaceholderText("Search clubs by name or interest...")).toBeInTheDocument();
    expect(screen.getByText("Category Filter:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tech" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cultural" })).toBeInTheDocument();
  });

  it("renders the tag filter sidebar with checkboxes", async () => {
    renderClubsIndex();

    expect(screen.getByLabelText("Filter clubs by tags")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by tag Tech")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by tag Music")).toBeInTheDocument();
  });

  it("checks tag checkboxes from the URL on initial render", async () => {
    renderClubsIndex(["/clubs?tags=Tech"]);

    expect(screen.getByLabelText("Filter by tag Tech")).toBeChecked();
    expect(screen.getByLabelText("Filter by tag Music")).not.toBeChecked();
  });

  it("filters clubs by the tags in the URL (AND semantics)", async () => {
    renderClubsIndex(["/clubs?tags=Tech"]);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Robotics Club/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /Drama Society/i })).not.toBeInTheDocument();
  });

  it("updates the URL and re-filters when a tag checkbox is toggled", async () => {
    renderClubsIndex(["/clubs"]);

    fireEvent.click(await screen.findByLabelText("Filter by tag Art"));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Drama Society/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /Robotics Club/i })).not.toBeInTheDocument();
  });

  it("shows an empty state when no club matches all selected tags", async () => {
    renderClubsIndex(["/clubs?tags=Tech,Art"]);

    await waitFor(() => {
      expect(screen.getByText("No clubs match the selected tags")).toBeInTheDocument();
    });
  });

  it("filters clubs when searching and shows EmptyState when no results match", async () => {
    renderClubsIndex();

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

    renderClubsIndex();

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
