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

let mockUser: { id: string; email: string } | null = {
  id: "user-1",
  email: "student@campus.edu",
};

vi.mock("@/hooks/useAuthHydration", () => ({
  useAuthHydration: () => ({
    user: mockUser,
    isInitializing: false,
  }),
}));

vi.mock("@/hooks/useEmailVerification", () => ({
  useEmailVerification: () => true,
}));

let mockProfile = {
  role: "freshman",
  major: "Computer Science",
  graduation_year: 2029,
};

let mockEvent = {
  id: "event-1234",
  title: "Mega Career Fair",
  description: "Meet industry recruiters.",
  event_date: "2026-10-15T18:00:00Z",
  start_date: "2026-10-15T18:00:00Z",
  end_date: "2026-10-15T21:00:00Z",
  location: "Campus Hall",
  banner_url: "https://example.com/banner.png",
  created_by: "organizer-1",
  is_high_risk: false,
  status: "published",
  short_id: "career-fair",
  max_attendees: 100,
  requires_approval: false,
  custom_questions: [
    {
      id: "q_major",
      label: "What is your major?",
      type: "text",
      required: true,
      visible_to: ["freshman"],
    },
    {
      id: "q_company",
      label: "What company do you work for?",
      type: "text",
      required: true,
      visible_to: ["alumni"],
    },
  ],
  event_rsvps: [],
  profiles: { full_name: "Organizer Person", email: "org@campus.edu" },
  clubs: { name: "Career Club", slug: "career-club" },
  event_metrics: { views: 42 },
};

const mockMutate = vi.fn();

const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "mock-token" } }, error: null }),
  },
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  },
  from: vi.fn().mockImplementation((table) => {
    if (table === "events") {
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
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
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: "user-1", email: "student@campus.edu" };
  mockProfile = { role: "freshman", major: "Computer Science", graduation_year: 2029 };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Role-Based Conditional RSVP Forms", () => {
  it("renders freshman restricted question and hides alumni restricted question for freshman user", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/events/career-fair"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>
    );

    // Click RSVP button to open dialog
    const rsvpBtn = await screen.findByRole("button", { name: /RSVP NOW/i });
    fireEvent.click(rsvpBtn);

    // Expect the freshman question to render
    const majorInput = await screen.findByLabelText(/What is your major\?/i);
    expect(majorInput).toBeInTheDocument();

    // Expect the alumni question to NOT render
    expect(screen.queryByLabelText(/What company do you work for\?/i)).not.toBeInTheDocument();

    // Submit without inputting major should fail Zod validation
    const confirmBtn = screen.getByRole("button", { name: /Confirm RSVP/i });
    fireEvent.click(confirmBtn);

    const errorMsg = await screen.findByText(/What is your major\? is required./i);
    expect(errorMsg).toBeInTheDocument();
  });

  it("renders alumni restricted question and hides freshman restricted question for alumni user", async () => {
    mockProfile.role = "alumni";

    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/events/career-fair"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>
    );

    const rsvpBtn = await screen.findByRole("button", { name: /RSVP NOW/i });
    fireEvent.click(rsvpBtn);

    // Expect the alumni question to render
    const companyInput = await screen.findByLabelText(/What company do you work for\?/i);
    expect(companyInput).toBeInTheDocument();

    // Expect the freshman question to NOT render
    expect(screen.queryByLabelText(/What is your major\?/i)).not.toBeInTheDocument();
  });
});
