import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import LostFoundPage, { CATEGORIES, type LostFoundItem } from "./lost-found";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

vi.mock("@/hooks/useAuthHydration", () => ({
  useAuthHydration: () => ({
    user: { id: "user-1", email: "test@campus.edu" },
    isInitializing: false,
  }),
}));

const mockItems: LostFoundItem[] = [
  {
    id: "item-1",
    user_id: "user-1",
    type: "lost",
    title: "Blue AirPods Case",
    description: "Lost my AirPods case near the library entrance.",
    category: "Electronics",
    location: "Main Library",
    image_url: null,
    contact_info: "test@campus.edu",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { full_name: "Test User", handle: "testuser" },
  },
  {
    id: "item-2",
    user_id: "user-2",
    type: "found",
    title: "Student ID Card",
    description: "Found a student ID card near the cafeteria entrance.",
    category: "Documents",
    location: "Cafeteria",
    image_url: null,
    contact_info: null,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { full_name: "Other User", handle: "otheruser" },
  },
];

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  track: vi.fn().mockResolvedValue("ok"),
  presenceState: vi.fn().mockReturnValue({}),
};

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [mockItems[0]], error: null }),
        }),
      }),
      order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
    }),
    insert: mockInsert,
    update: mockUpdate,
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }),
  channel: vi.fn(() => mockChannel),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <ThemeProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LostFoundPage />
          </MemoryRouter>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the mock to return all items
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
      }),
      order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
    }),
    insert: mockInsert,
    update: mockUpdate,
    upsert: vi.fn().mockResolvedValue({ error: null }),
  });
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LostFoundPage", () => {
  it("renders the page header and post button", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /lost & found/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post item/i })).toBeInTheDocument();
  });

  it("renders the search input", () => {
    renderPage();
    expect(screen.getByPlaceholderText(/search items/i)).toBeInTheDocument();
  });

  it("shows type filter buttons (All, Lost, Found)", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^lost$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^found$/i })).toBeInTheDocument();
  });

  it("loads and displays items from supabase", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Blue AirPods Case")).toBeInTheDocument();
      expect(screen.getByText("Student ID Card")).toBeInTheDocument();
    });
  });

  it("displays Lost and Found badges on items", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/^lost$/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/^found$/i).length).toBeGreaterThan(0);
    });
  });

  it("shows the item location when provided", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Main Library")).toBeInTheDocument();
      expect(screen.getByText("Cafeteria")).toBeInTheDocument();
    });
  });

  it("shows contact info for items that have it", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/test@campus\.edu/)).toBeInTheDocument();
    });
  });

  it("shows 'Mark Resolved' button only for own items", async () => {
    renderPage();
    await waitFor(() => {
      // item-1 belongs to user-1 (our mocked current user), item-2 does not
      const resolveButtons = screen.queryAllByRole("button", { name: /mark resolved/i });
      expect(resolveButtons).toHaveLength(1);
    });
  });

  it("opens the post dialog when clicking Post Item", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /post item/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Post an Item/i)).toBeInTheDocument();
    });
  });

  it("dialog has I Lost and I Found toggle buttons", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /post item/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /I Lost Something/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /I Found Something/i })).toBeInTheDocument();
    });
  });

  it("shows validation errors when submitting an empty form", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /post item/i }));
    await waitFor(() => screen.getByRole("dialog"));

    // Submit the form without filling anything in
    const submitBtn = document.getElementById("lf-submit-btn");
    expect(submitBtn).not.toBeNull();
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it("filters items by search query", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Blue AirPods Case")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search items/i);
    fireEvent.change(searchInput, { target: { value: "AirPods" } });
    await waitFor(() => {
      expect(screen.getByText("Blue AirPods Case")).toBeInTheDocument();
    });
  });

  it("shows empty state when search has no results", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Blue AirPods Case"));
    const searchInput = screen.getByPlaceholderText(/search items/i);
    fireEvent.change(searchInput, { target: { value: "xyznonexistent123" } });
    await waitFor(() => {
      expect(screen.getByText(/no results for/i)).toBeInTheDocument();
    });
  });

  it("CATEGORIES export contains expected values", () => {
    expect(CATEGORIES).toContain("Electronics");
    expect(CATEGORIES).toContain("Documents");
    expect(CATEGORIES).toContain("Keys");
    expect(CATEGORIES).toContain("Other");
  });

  it("subscribes to realtime channel on mount", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith("lost_found_realtime");
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });

  it("active type filter buttons highlight correctly", async () => {
    renderPage();
    const allBtn = screen.getByRole("button", { name: /^all$/i });
    const lostBtn = screen.getByRole("button", { name: /^lost$/i });

    // 'All' is active by default
    expect(allBtn.className).toContain("bg-black");

    // Click 'Lost' to activate it
    fireEvent.click(lostBtn);
    await waitFor(() => {
      expect(lostBtn.className).toContain("bg-black");
    });
  });
});
