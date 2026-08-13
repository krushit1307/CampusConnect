import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { CreateEventDialog } from "./CreateEventDialog";

// Mock Supabase
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "clubs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "club-1", name: "Tech Club", created_by: "user-1" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "event_categories") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ id: "cat-1", name: "Tech" }],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  }),
}));

// Mock useOnlineStatus hook
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

const mockUser = { id: "user-1", email: "president@club.edu" } as User;

describe("CreateEventDialog - Venue Capacity Field", () => {
  it("renders the Venue Capacity input field when dialog is open", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CreateEventDialog user={mockUser} />
      </QueryClientProvider>
    );

    // Open the dialog
    const createBtn = screen.getByRole("button", { name: /create event/i });
    fireEvent.click(createBtn);

    // Look for the Venue Capacity label or input
    const venueCapacityLabel = await screen.findByText(/venue capacity/i);
    expect(venueCapacityLabel).toBeInTheDocument();

    const venueCapacityInput = screen.getByPlaceholderText("e.g. 50");
    expect(venueCapacityInput).toBeInTheDocument();
  });
});
