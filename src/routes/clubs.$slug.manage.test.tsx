import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import ClubManagePage from "./clubs.$slug.manage";

// Mock Supabase client
const mockUpdate = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-123" } } }),
    },
    from: vi.fn().mockImplementation((table) => {
      if (table === "clubs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "club_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ user_id: "admin-123", role: "admin" }],
              error: null,
            }),
          }),
        };
      }
      return {};
    }),
  }),
}));

describe("ClubManagePage Concurrency OCC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page and successfully triggers conflict modal on version conflict", async () => {
    // Initial mock fetch returning version 1
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "club-1",
        name: "Coding Club",
        description: "Original description",
        version: 1,
        slug: "coding-club",
      },
      error: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/clubs/coding-club/manage"]}>
          <Routes>
            <Route path="/clubs/:slug/manage" element={<ClubManagePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Verify it loads settings
    await waitFor(() => {
      expect(screen.getByText("Club Settings")).toBeInTheDocument();
    });

    // Simulate version conflict during save (update returns 0 rows updated)
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [], // 0 rows updated signals conflict
            error: null,
          }),
        }),
      }),
    });

    // Mock fetch for the conflict modal (which returns server state, version 2)
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "club-1",
        name: "Coding Club",
        description: "Server edited description",
        version: 2,
        slug: "coding-club",
      },
      error: null,
    });

    // Save changes
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    // Verify conflict dialog pops up showing side-by-side comparisons
    await waitFor(() => {
      expect(screen.getByText("Editing Conflict Detected")).toBeInTheDocument();
    });

    expect(screen.getByText("Server edited description")).toBeInTheDocument();
  });
});
