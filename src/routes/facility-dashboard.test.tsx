import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FacilityDashboard from "./facility-dashboard";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetVal = vi.fn();
const mockFromVal = vi.fn();

vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      from: (table: string) => mockFromVal(table),
      auth: {
        getUser: () => mockGetVal(),
      },
    }),
  };
});

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

// Mock SiteShell
vi.mock("@/components/site/SiteShell", () => ({
  SiteShell: ({ children }: any) => <div data-testid="site-shell">{children}</div>,
}));

describe("Real-Time Accessibility Need Dashboard for Venues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("denies access to non-managers and non-admins (redirects to /)", async () => {
    // Mock normal student profile
    mockGetVal.mockResolvedValue({ data: { user: { id: "student-123" } } });
    mockFromVal.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { role: "student" }, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/facility-dashboard"]}>
          <Routes>
            <Route path="/facility-dashboard" element={<FacilityDashboard />} />
            <Route path="/" element={<div data-testid="home">Home</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expect to be redirected to home
    const home = await screen.findByTestId("home");
    expect(home).toBeInTheDocument();
  });

  it("renders assigned venues, daily briefings, and toggles deployments for managers", async () => {
    // Mock facility manager session
    mockGetVal.mockResolvedValue({ data: { user: { id: "manager-123" } } });
    mockFromVal.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { role: "facility_manager" }, error: null }),
            }),
          }),
        };
      }

      if (table === "venue_managers") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  {
                    venue_id: "venue-1",
                    venues: { id: "venue-1", name: "Room A", building: "Student Union", capacity: 200 },
                  },
                ],
                error: null,
              }),
          }),
        };
      }

      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              neq: () => ({
                gte: () => ({
                  lte: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: "event-1",
                          title: "Hackathon",
                          start_date: new Date().toISOString(),
                          end_date: new Date().toISOString(),
                          status: "scheduled",
                          clubs: { name: "Tech Club" },
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === "accommodation_requests") {
        return {
          select: () => ({
            in: () => ({
              neq: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "req-1",
                      event_id: "event-1",
                      accommodation_type: "WHEELCHAIR_SEATING",
                      state: "SUBMITTED",
                    },
                    {
                      id: "req-2",
                      event_id: "event-1",
                      accommodation_type: "ASL_INTERPRETER",
                      state: "SUBMITTED",
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "venue_deployments") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [],
                error: null,
              }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }

      if (table === "thermostat_telemetry") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "tel-1",
                        venue_id: "venue-1",
                        temperature_fahrenheit: 72.5,
                        recorded_at: new Date().toISOString(),
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }

      if (table === "thermal_alerts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
            }),
          }),
        };
      }

      return {};
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/facility-dashboard"]}>
          <Routes>
            <Route path="/facility-dashboard" element={<FacilityDashboard />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify header renders title
    const headerTitle = await screen.findByText("Facility Manager Dashboard");
    expect(headerTitle).toBeInTheDocument();

    // Verify select list shows assigned venue
    const selectOpt = screen.getByText("Student Union - Room A");
    expect(selectOpt).toBeInTheDocument();

    // Verify daily briefing aggregates correctly
    const briefingItem = screen.getByText(/Today, expect 1 wheelchair user and 1 ASL request/i);
    expect(briefingItem).toBeInTheDocument();

    // Verify event title is displayed
    const eventHeading = screen.getByText("Hackathon");
    expect(eventHeading).toBeInTheDocument();

    // Verify Deploy buttons exist
    const deployRampBtn = screen.getByRole("button", { name: "Deploy Ramp" });
    const confirmAslBtn = screen.getByRole("button", { name: "Confirm ASL" });
    expect(deployRampBtn).toBeInTheDocument();
    expect(confirmAslBtn).toBeInTheDocument();

    // Click deploy ramp
    fireEvent.click(deployRampBtn);

    // Expect toast success to be called
    expect(mockToastSuccess).toHaveBeenCalledWith("Deployment status updated successfully!");

    // Verify environmental telemetry panel renders
    const hvacHeader = screen.getByText("HVAC & Thermostat Telemetry");
    expect(hvacHeader).toBeInTheDocument();
    
    const tempReading = screen.getByText("72.5°F");
    expect(tempReading).toBeInTheDocument();
  });
});
