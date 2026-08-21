import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import EventDetailsPage from "./events.$eventId";
import { toast } from "sonner";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

let mockUser = {
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

let mockCheckIn = vi.fn().mockResolvedValue({ status: "success" });

vi.mock("@/hooks/useGeofencedCheckIn", () => ({
  useGeofencedCheckIn: () => ({
    checkIn: mockCheckIn,
    status: "idle",
  }),
}));

// Setup mock event that is active right now and has geofencing enabled
let mockEvent = {
  id: "event-1234",
  title: "Outdoor Music Fest",
  description: "Live outdoor college band performances.",
  event_date: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // started 15m ago
  start_date: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  end_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // ends in 2h
  location: "Festival Grounds",
  banner_url: "https://example.com/fest-banner.png",
  created_by: "organizer-1",
  is_high_risk: false,
  status: "published",
  short_id: "music-fest",
  max_attendees: 500,
  requires_approval: false,
  geofencing_enabled: true,
  geofence_radius_meters: 100,
  latitude: 40.7128,
  longitude: -74.0060,
  event_rsvps: [
    {
      id: "rsvp-123",
      user_id: "user-1",
      checked_in: false,
      status: "attending",
    },
  ],
  profiles: { full_name: "Organizer Person", email: "org@campus.edu" },
  clubs: { name: "Music Club", slug: "music-club" },
  event_metrics: { views: 120 },
  venues: {
    name: "Festival Grounds",
    building: "Main Campus Green",
    capacity: 1000,
    accessibility_features: {
      has_elevator: false,
      wheelchair_ramp: true,
      gender_neutral_restrooms: true,
      hearing_loop: false,
      low_sensory_zone: true,
    },
    latitude: 40.7128,
    longitude: -74.0060,
    geofence_radius_meters: 150,
  },
};

const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "mock-token" } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
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
    return {
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  }),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
  getSupabaseUrl: () => "https://mock.supabase.co",
}));

const mockGeolocation = {
  getCurrentPosition: vi.fn().mockImplementation((success) =>
    success({
      coords: {
        latitude: 40.71281, // extremely close to venue center (40.7128)
        longitude: -74.00601,
        accuracy: 10,
      },
    })
  ),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Mock navigator.geolocation
  Object.defineProperty(global.navigator, "geolocation", {
    value: mockGeolocation,
    configurable: true,
  });
});

afterEach(() => {
  // @ts-ignore
  delete global.navigator.geolocation;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Dynamic Geofenced Auto Check-In (#3271)", () => {
  it("renders location permission dialog automatically on active event load", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/events/music-fest"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>
    );

    // Dialog title should be shown automatically
    const dialogTitle = await screen.findByText("Automatic Check-In");
    expect(dialogTitle).toBeInTheDocument();

    // Dialog privacy explanation text should be visible
    expect(screen.getByText(/We need to verify that you are physically present at the venue/i)).toBeInTheDocument();
  });

  it("triggers automatic check-in when user accepts location verification", async () => {
    render(
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/events/music-fest"]}>
              <Routes>
                <Route path="/events/:eventId" element={<EventDetailsPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>
    );

    // Find and click the Enable & Check In button
    const enableBtn = await screen.findByRole("button", { name: /Enable & Check In/i });
    fireEvent.click(enableBtn);

    // Should fetch current geolocation coordinates and call RPC checkIn
    await waitFor(() => {
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
      expect(mockCheckIn).toHaveBeenCalledWith("rsvp-123");
      expect(toast.success).toHaveBeenCalledWith("Welcome! You have been automatically checked in.");
    });
  });
});
