import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

const mockEventVirtual = {
  id: "event-virtual-1",
  created_by: "organizer-1",
  title: "Virtual AI Workshop",
  description: "Learn the fundamentals of LLMs online",
  is_virtual: true,
  virtual_platform: "zoom",
  max_attendees: 100,
  available_spots: 100,
  start_date: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  end_date: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  event_date: new Date(Date.now() + 86400000).toISOString(),
  clubs: { name: "AI Club", slug: "ai-club" },
};

const mockMeeting = {
  platform: "zoom",
  meeting_url: "https://zoom.us/j/999888777?pwd=abc",
  meeting_password: "abc",
};

const mockClub = {
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
  events: [],
};

const mockRpc = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });

const mockSupabase = {
  from: vi.fn().mockImplementation((table) => {
    if (table === "events") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockEventVirtual, error: null }),
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
    if (table === "virtual_meetings") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // By default, locked/not loaded due to RLS/Time
          }),
        }),
      };
    }
    if (table === "clubs") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockClub, error: null }),
          }),
        }),
      };
    }
    if (table === "club_zoom_integrations") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: mockUpsert,
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

describe("Automated Zoom/Google Meet Link Generation UI", () => {
  it("renders locked warning message when student does not have an approved RSVP", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/events/event-virtual-1"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    // Wait for virtual meeting header to render
    expect(await screen.findByText("Virtual Meeting Link")).toBeInTheDocument();

    // Check that warning appears
    expect(
      screen.getByText("🔒 You must have an approved RSVP to access the meeting link.")
    ).toBeInTheDocument();
  });

  it("reveals Zoom meeting link when virtualMeeting details are successfully loaded", async () => {
    // Override the mock to return active meeting
    mockSupabase.from = vi.fn().mockImplementation((table) => {
      if (table === "events") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockEventVirtual, error: null }),
            }),
          }),
        };
      }
      if (table === "event_rsvps") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { status: "approved" }, error: null }),
            }),
          }),
        };
      }
      if (table === "virtual_meetings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockMeeting, error: null }),
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
            <MemoryRouter initialEntries={["/events/event-virtual-1"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    expect(await screen.findByText("Virtual Meeting Link")).toBeInTheDocument();

    // The platform details and Password should be displayed
    expect(screen.getByText(/Platform:/i)).toBeInTheDocument();
    expect(screen.getByText("abc")).toBeInTheDocument();

    // Join Meeting button pointing to Zoom join_url should exist
    const joinBtn = screen.getByRole("link", { name: /Join Meeting/i });
    expect(joinBtn).toBeInTheDocument();
    expect(joinBtn).toHaveAttribute("href", "https://zoom.us/j/999888777?pwd=abc");
  });

  it("allows setting up Zoom integrations in Club Management settings", async () => {
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

    // Wait for the manage page settings to render
    expect(await screen.findByText("Club Settings")).toBeInTheDocument();

    // Click on Integrations tab
    const integrationsTab = screen.getByRole("button", { name: /Integrations/i });
    fireEvent.click(integrationsTab);

    // Fill Zoom API credentials
    const accountInput = screen.getByLabelText(/Account ID/i);
    const clientInput = screen.getByLabelText(/Client ID/i);
    const secretInput = screen.getByLabelText(/Client Secret/i);

    fireEvent.change(accountInput, { target: { value: "test-account" } });
    fireEvent.change(clientInput, { target: { value: "test-client" } });
    fireEvent.change(secretInput, { target: { value: "test-secret" } });

    // Submit credentials
    const saveBtn = screen.getByRole("button", { name: /Save Zoom Integration/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });
  });
});
