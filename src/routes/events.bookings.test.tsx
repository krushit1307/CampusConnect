import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import EventDetailsPage from "./events.$eventId";
import ClubManageRoute from "./clubs.$slug.manage";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
  getSupabaseUrl: () => "https://mock.supabase.co",
}));

vi.mock("@/hooks/useAuthHydration", () => ({
  useAuthHydration: vi.fn().mockReturnValue({
    user: { id: "user-1", email: "user@campus.edu" },
    isInitializing: false,
  }),
}));

const mockEventPending = {
  id: "event-pending-1",
  created_by: "organizer-1",
  title: "Campus AI Hackathon",
  description: "Hack event",
  status: "pending_facility_approval",
  venue_id: "venue-1",
  max_attendees: 100,
  available_spots: 100,
  start_date: new Date(Date.now() + 86400000).toISOString(),
  end_date: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  event_date: new Date(Date.now() + 86400000).toISOString(),
  clubs: { name: "AI Club", slug: "ai-club" },
};

const mockEventPublished = {
  id: "event-published-1",
  created_by: "organizer-1",
  title: "Campus AI Hackathon",
  description: "Hack event",
  status: "published",
  venue_id: "venue-1",
  max_attendees: 100,
  available_spots: 100,
  start_date: new Date(Date.now() + 86400000).toISOString(),
  end_date: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  event_date: new Date(Date.now() + 86400000).toISOString(),
  clubs: { name: "AI Club", slug: "ai-club" },
};

const mockClubWithEvents = {
  id: "club-1",
  name: "AI Club",
  slug: "ai-club",
  status: "approved",
  description: "AI Devs club",
  club_members: [
    {
      id: "membership-1",
      role: "admin",
      status: "approved",
      user_id: "user-1",
    },
  ],
  events: [
    {
      id: "event-pending-1",
      title: "Campus AI Hackathon",
      max_attendees: 100,
      status: "pending_facility_approval",
      event_rsvps: [],
    },
  ],
};

const mockSupabase = {
  from: vi.fn().mockImplementation((table) => {
    if (table === "events") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              // Extract current route eventId from mock setup if possible or return pending by default
              return Promise.resolve({ data: mockEventPending, error: null });
            }),
          }),
        }),
      };
    }
    if (table === "event_rsvps") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }
    if (table === "clubs") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockClubWithEvents, error: null }),
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

describe("Automated Room Booking Approval UI", () => {
  it("renders pending approval warning banner when event has pending_facility_approval status", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/events/event-pending-1"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    // Banner title must be visible
    expect(await screen.findByText("Pending Venue Booking Approval")).toBeInTheDocument();
    expect(
      screen.getByText(/This event is draft-only and hidden from public search until the facilities manager approves/i),
    ).toBeInTheDocument();
  });

  it("does not render warning banner when event status is published", async () => {
    // Override the mock to return published event
    mockSupabase.from = vi.fn().mockImplementation((table) => {
      if (table === "events") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockEventPublished, error: null }),
            }),
          }),
        };
      }
      if (table === "event_rsvps") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/events/event-published-1"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    await screen.findByText("Campus AI Hackathon");
    expect(screen.queryByText("Pending Venue Booking Approval")).not.toBeInTheDocument();
  });

  it("displays Pending Room Approval status tag in Club Management dashboard", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/clubs/ai-club/manage"]}>
              <Routes>
                <Route path="/clubs/:slug/manage" element={<ClubManageRoute />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    // Find tab elements
    expect(await screen.findByText("Club Events")).toBeInTheDocument();

    // The event listed in events tab should display Pending Room Approval status tag badge
    expect(screen.getByText("⏳ Pending Room Approval")).toBeInTheDocument();
  });
});
