import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import EventDetailsPage from "./events.$eventId";
import SettingsPage from "./settings";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
  getSupabaseUrl: () => "https://mock.supabase.co",
}));

vi.mock("@/hooks/useAuthHydration", () => ({
  useAuthHydration: vi.fn().mockReturnValue({
    user: { id: "user-1", email: "user@campus.edu", user_metadata: { full_name: "Test Student" } },
    isInitializing: false,
  }),
}));

const mockEventPriority = {
  id: "event-priority-1",
  created_by: "organizer-1",
  title: "Alumni Networking Gala",
  description: "Exclusive gala event",
  status: "published",
  max_attendees: 100,
  available_spots: 0,
  start_date: new Date(Date.now() + 86400000).toISOString(),
  end_date: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  event_date: new Date(Date.now() + 86400000).toISOString(),
  clubs: { name: "Business Club", slug: "business-club" },
  priority_rules: { prioritize_seniors: true },
};

const mockEventStandard = {
  id: "event-standard-1",
  created_by: "organizer-1",
  title: "AI Workshop",
  description: "Standard workshop",
  status: "published",
  max_attendees: 100,
  available_spots: 0,
  start_date: new Date(Date.now() + 86400000).toISOString(),
  end_date: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  event_date: new Date(Date.now() + 86400000).toISOString(),
  clubs: { name: "AI Club", slug: "ai-club" },
  priority_rules: null,
};

const mockWaitlistActive = [
  { id: "wait-1", user_id: "user-1", created_at: new Date(Date.now() - 3600000).toISOString() },
];

const mockWaitlistScore = {
  waitlist_hours: 1.0,
  time_score: -1.0,
  membership_score: 0.0,
  streak_score: 0.0,
  senior_score: 500.0,
  total_score: 599.0,
};

const mockProfile = {
  id: "user-1",
  first_name: "Test",
  last_name: "Student",
  handle: "teststudent",
  college: "Science",
  bio: "AI Developer",
  role: "student",
  graduation_year: 2026,
};

const mockSupabase = {
  from: vi.fn().mockImplementation((table) => {
    if (table === "events") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockEventPriority, error: null }),
          }),
        }),
      };
    }
    if (table === "event_waitlist") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockWaitlistActive, error: null }),
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
  rpc: vi.fn().mockImplementation((fn) => {
    if (fn === "get_waitlist_score") {
      return Promise.resolve({ data: mockWaitlistScore, error: null });
    }
    return Promise.resolve({ data: null, error: null });
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

describe("Multi-Tier Waitlist Priority UI", () => {
  it("renders vague waitlist status and warning banner for priority rules", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/events/event-priority-1"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    // Warning banner should be rendered
    expect(await screen.findByText(/This event utilizes a priority waitlist prioritizing Upperclassmen/i)).toBeInTheDocument();

    // Numerical position should NOT be visible
    expect(screen.queryByText(/Waitlist position: #/i)).not.toBeInTheDocument();

    // Vague priority status should be visible
    expect(screen.getByText("Waitlisted - Priority Pending")).toBeInTheDocument();
  });

  it("renders standard position when priority rules are not set on event", async () => {
    // Override main event fetch mock to return standard event
    mockSupabase.from = vi.fn().mockImplementation((table) => {
      if (table === "events") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockEventStandard, error: null }),
            }),
          }),
        };
      }
      if (table === "event_waitlist") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockWaitlistActive, error: null }),
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
            <MemoryRouter initialEntries={["/events/event-standard-1"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    // Standard position should be visible
    expect(await screen.findByText("Waitlist position: #1")).toBeInTheDocument();
    expect(screen.queryByText("Waitlisted - Priority Pending")).not.toBeInTheDocument();
  });

  it("renders Graduation Year field in Settings page profile form", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/settings"]}>
              <Routes>
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>,
    );

    // Expect Graduation Year form label
    expect(await screen.findByText("Graduation Year")).toBeInTheDocument();
    
    // Expect input value to be pre-filled with profile graduation_year (2026)
    const input = screen.getByPlaceholderText("e.g. 2026") as HTMLInputElement;
    expect(input.value).toBe("2026");
  });
});
