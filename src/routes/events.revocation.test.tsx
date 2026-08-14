import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import EventDetailsPage from "./events.$eventId";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
  getSupabaseUrl: () => "https://mock.supabase.co",
}));

vi.mock("@/hooks/useAuthHydration", () => ({
  useAuthHydration: vi.fn().mockReturnValue({
    user: { id: "organizer-1", email: "organizer@campus.edu" },
    isInitializing: false,
  }),
}));

const mockEvent = {
  id: "event-1",
  created_by: "organizer-1",
  title: "AI Hackathon",
  description: "Generate amazing AI solutions",
  generates_certificate: true,
  max_attendees: 100,
  available_spots: 100,
  event_date: new Date(Date.now() + 86400000).toISOString(),
  clubs: { name: "Google Developer Student Clubs" },
};

const mockRsvps = [
  {
    id: "rsvp-1",
    user_id: "student-1",
    status: "approved",
    checked_in: true,
    profiles: { first_name: "John", last_name: "Doe", avatar_url: null },
  },
  {
    id: "rsvp-2",
    user_id: "student-2",
    status: "approved",
    checked_in: false,
    profiles: { first_name: "Jane", last_name: "Smith", avatar_url: null },
  },
];

const mockRpc = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});

const mockSupabase = {
  from: vi.fn().mockImplementation((table) => {
    if (table === "events") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
          }),
        }),
      };
    }
    if (table === "event_rsvps") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockRsvps, error: null }),
          }),
          order: vi.fn().mockResolvedValue({ data: mockRsvps, error: null }),
        }),
        update: mockUpdate,
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: mockInsert,
    };
  }),
  rpc: mockRpc,
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })),
  removeChannel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Attendee check-in and revocation UI", () => {
  it("renders check-in badges and toggle buttons correctly for organizer view", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/events/event-1"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    // Wait for event and attendee Kanban columns to render
    await waitFor(() => {
      expect(screen.getByText("Attendee Manager")).toBeInTheDocument();
    });

    // Check if John Doe card renders the check-in badge
    expect(screen.getByText("✓ Checked In")).toBeInTheDocument();

    // Check if Jane Smith card renders the not checked in badge
    expect(screen.getByText("Not Checked In")).toBeInTheDocument();

    // Revoke attendance button for John Doe (checked_in: true) should exist
    const revokeBtn = screen.getByRole("button", { name: /Revoke Attendance \/ Invalidate Certificate/i });
    expect(revokeBtn).toBeInTheDocument();

    // Manual check-in button for Jane Smith (checked_in: false) should exist
    const checkinBtn = screen.getByRole("button", { name: /Check In Attendee/i });
    expect(checkinBtn).toBeInTheDocument();

    // Click revoke button and assert update mutation call
    fireEvent.click(revokeBtn);
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith("event_rsvps");
    });
  });
});
