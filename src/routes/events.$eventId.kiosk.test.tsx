import "@testing-library/jest-dom/vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import KioskMode from "./events.$eventId.kiosk";

// Mock kiosk telemetry service
vi.mock("@/services/kioskTelemetry", () => ({
  useKioskTelemetry: vi.fn(),
}));

// Mock Supabase Client
const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

describe("Kiosk Mode - Guest Network Provisioning (#4819)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default fetch stub
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const setupMocks = (options: {
    eventCreatorCollege: string;
    studentCollege: string;
    studentName: string;
    studentId: string;
    userId: string;
    rsvpId: string;
  }) => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { created_by: "creator-123" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: (fields: string) => ({
            eq: (field: string, val: string) => ({
              single: () => {
                if (val === "creator-123") {
                  return Promise.resolve({
                    data: { college: options.eventCreatorCollege },
                    error: null,
                  });
                }
                return Promise.resolve({
                  data: {
                    id: options.userId,
                    full_name: options.studentName,
                    college: options.studentCollege,
                  },
                  error: null,
                });
              },
            }),
          }),
        };
      }
      if (table === "event_rsvps") {
        return {
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { id: options.rsvpId, user_id: options.userId, checked_in: true },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "guest_network_credentials") {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnSelf(),
        eq: vi.fn().mockReturnSelf(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
  };

  const triggerBarcodeScan = (scannedValue: string) => {
    act(() => {
      for (const char of scannedValue) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
      }
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
  };

  it("does not provision guest credentials when checked-in attendee belongs to the host college", async () => {
    setupMocks({
      eventCreatorCollege: "Harvard",
      studentCollege: "Harvard",
      studentName: "John Harvard",
      studentId: "12345",
      userId: "user-123",
      rsvpId: "rsvp-123",
    });

    render(
      <MemoryRouter initialEntries={["/events/evt-123/kiosk"]}>
        <Routes>
          <Route path="/events/:eventId/kiosk" element={<KioskMode />} />
        </Routes>
      </MemoryRouter>,
    );

    // Initial state check
    expect(screen.getByText("READY TO SCAN")).toBeInTheDocument();

    // Trigger check-in scan
    triggerBarcodeScan("12345");

    await waitFor(() => {
      expect(screen.getByText("SUCCESS")).toBeInTheDocument();
      expect(screen.getByText("John Harvard")).toBeInTheDocument();
    });

    // Verify Cisco ISE API webhook was NOT triggered
    expect(global.fetch).not.toHaveBeenCalled();

    // Verify no guest credentials card is shown
    expect(screen.queryByText(/Guest Wi-Fi Provisioned/i)).not.toBeInTheDocument();
  });

  it("provisions guest credentials and renders them when an external guest checks in successfully (via webhook)", async () => {
    setupMocks({
      eventCreatorCollege: "MIT",
      studentCollege: "Harvard",
      studentName: "John Harvard",
      studentId: "12345",
      userId: "user-123",
      rsvpId: "rsvp-123",
    });

    const mockResponse = {
      username: "mit_guest_john_h",
      password: "SECRET_PASSWORD",
      essid: "MIT-Guest",
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/events/evt-123/kiosk"]}>
        <Routes>
          <Route path="/events/:eventId/kiosk" element={<KioskMode />} />
        </Routes>
      </MemoryRouter>,
    );

    // Trigger check-in scan
    triggerBarcodeScan("12345");

    await waitFor(() => {
      expect(screen.getByText("SUCCESS")).toBeInTheDocument();
      expect(screen.getByText("John Harvard")).toBeInTheDocument();
    });

    // Verify Webhook request details
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cisco-ise.local/v1/guest-provision",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer cisco-ise-secret-token",
        }),
        body: expect.stringContaining("user-123"),
      }),
    );

    // Verify Guest Wi-Fi card details rendered on screen
    expect(screen.getByText(/Guest Wi-Fi Provisioned/i)).toBeInTheDocument();
    expect(screen.getByText("MIT-Guest")).toBeInTheDocument();
    expect(screen.getByText("mit_guest_john_h")).toBeInTheDocument();
    expect(screen.getByText("SECRET_PASSWORD")).toBeInTheDocument();
  });

  it("provisions fallback credentials and renders them when the Cisco ISE webhook fails", async () => {
    setupMocks({
      eventCreatorCollege: "MIT",
      studentCollege: "Harvard",
      studentName: "John Harvard",
      studentId: "12345",
      userId: "user-123",
      rsvpId: "rsvp-123",
    });

    // Mock webhook to fail/throw
    const fetchMock = vi.fn().mockRejectedValue(new Error("Cisco ISE offline"));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/events/evt-123/kiosk"]}>
        <Routes>
          <Route path="/events/:eventId/kiosk" element={<KioskMode />} />
        </Routes>
      </MemoryRouter>,
    );

    // Trigger check-in scan
    triggerBarcodeScan("12345");

    await waitFor(() => {
      expect(screen.getByText("SUCCESS")).toBeInTheDocument();
    });

    // Verify Webhook request was attempted
    expect(fetchMock).toHaveBeenCalled();

    // Verify fallback guest credentials are still generated and rendered
    expect(screen.getByText(/Guest Wi-Fi Provisioned/i)).toBeInTheDocument();
    expect(screen.getByText("MIT-Guest")).toBeInTheDocument();
    // Username contains host college and user id substring
    expect(screen.getByText(/mit_guest_user/i)).toBeInTheDocument();
    // Expiration text exists
    expect(screen.getByText(/Valid for 12 Hours on this Device/i)).toBeInTheDocument();
  });
});
