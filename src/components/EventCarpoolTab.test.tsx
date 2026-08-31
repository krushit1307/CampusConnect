// ============================================================
// CampusConnect – Event Carpool Tab Tests
// src/components/EventCarpoolTab.test.tsx
// Issue #3663
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { EventCarpoolTab } from "./EventCarpoolTab";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({ data: [], error: null })),
          single: vi.fn(() => ({
            data: null,
            error: { code: "PGRST116" },
          })),
          maybeSingle: vi.fn(() => ({ data: null, error: null })),
        })),
        neq: vi.fn(() => ({ data: [], error: null })),
        in: vi.fn(() => ({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: "cp-new",
              event_id: "evt-1",
              driver_user_id: "u-1",
              seats_offered: 3,
              seats_taken: 0,
              departure_time: new Date().toISOString(),
              location_string: "Library",
              notes: null,
              status: "active",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
  }),
}));

vi.mock("@/services/EventCarpoolService", () => ({
  getEventCarpools: vi.fn().mockResolvedValue([]),
  createCarpool: vi.fn().mockResolvedValue({}),
  cancelCarpool: vi.fn().mockResolvedValue(undefined),
  requestCarpoolSeat: vi.fn().mockResolvedValue({}),
  acceptCarpoolRequest: vi.fn().mockResolvedValue(undefined),
  declineCarpoolRequest: vi.fn().mockResolvedValue(undefined),
  cancelCarpoolRequest: vi.fn().mockResolvedValue(undefined),
  initiateDriverRiderDM: vi.fn().mockResolvedValue(undefined),
  hasUserRequested: vi.fn().mockResolvedValue(false),
}));

import {
  getEventCarpools,
  requestCarpoolSeat,
} from "@/services/EventCarpoolService";

describe("EventCarpoolTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );
    expect(screen.getByText("Loading carpools…")).toBeInTheDocument();
  });

  it("renders empty state when no carpools exist", async () => {
    vi.mocked(getEventCarpools).mockResolvedValueOnce([]);

    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No ride shares yet. Be the first to offer a ride!"),
      ).toBeInTheDocument();
    });
  });

  it("renders Offer a Ride button", async () => {
    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Offer a Ride")).toBeInTheDocument();
    });
  });

  it("opens offer form when Offer a Ride is clicked", async () => {
    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Offer a Ride")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Offer a Ride"));

    expect(screen.getByText("Seats Available")).toBeInTheDocument();
    expect(screen.getByText("Departure Time")).toBeInTheDocument();
    expect(screen.getByText("Pickup Location")).toBeInTheDocument();
  });

  it("renders carpool list with correct info", async () => {
    const mockCarpool = {
      id: "cp-1",
      event_id: "evt-1",
      driver_user_id: "u-other",
      driver_name: "Jane Driver",
      driver_avatar: null,
      seats_offered: 3,
      seats_taken: 1,
      departure_time: new Date(Date.now() + 86400000).toISOString(),
      location_string: "Student Union",
      notes: "I have a spacious car",
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requests: [],
    };

    vi.mocked(getEventCarpools).mockResolvedValueOnce([mockCarpool]);

    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Driver: Jane Driver")).toBeInTheDocument();
      expect(screen.getByText(/Student Union/)).toBeInTheDocument();
      expect(screen.getByText("1 / 3 seats taken")).toBeInTheDocument();
      expect(screen.getByText("Request Seat")).toBeInTheDocument();
    });
  });

  it("shows Request Seat button for available carpools", async () => {
    const mockCarpool = {
      id: "cp-1",
      event_id: "evt-1",
      driver_user_id: "u-other",
      driver_name: "Jane Driver",
      driver_avatar: null,
      seats_offered: 3,
      seats_taken: 0,
      departure_time: new Date(Date.now() + 86400000).toISOString(),
      location_string: "Library",
      notes: null,
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requests: [],
    };

    vi.mocked(getEventCarpools).mockResolvedValueOnce([mockCarpool]);

    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Request Seat")).toBeInTheDocument();
    });
  });

  it("does not show Request Seat when carpool is full", async () => {
    const mockCarpool = {
      id: "cp-1",
      event_id: "evt-1",
      driver_user_id: "u-other",
      driver_name: "Jane Driver",
      driver_avatar: null,
      seats_offered: 2,
      seats_taken: 2,
      departure_time: new Date(Date.now() + 86400000).toISOString(),
      location_string: "Library",
      notes: null,
      status: "full" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requests: [],
    };

    vi.mocked(getEventCarpools).mockResolvedValueOnce([mockCarpool]);

    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Request Seat")).not.toBeInTheDocument();
    });
  });

  it("shows Cancel Ride for driver's own carpool", async () => {
    const mockCarpool = {
      id: "cp-1",
      event_id: "evt-1",
      driver_user_id: "u-1",
      driver_name: "Me",
      driver_avatar: null,
      seats_offered: 3,
      seats_taken: 0,
      departure_time: new Date(Date.now() + 86400000).toISOString(),
      location_string: "Library",
      notes: null,
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requests: [],
    };

    vi.mocked(getEventCarpools).mockResolvedValueOnce([mockCarpool]);

    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Cancel Ride")).toBeInTheDocument();
      expect(screen.getByText("Your ride")).toBeInTheDocument();
    });
  });

  it("calls requestCarpoolSeat when Request Seat is clicked", async () => {
    const mockCarpool = {
      id: "cp-1",
      event_id: "evt-1",
      driver_user_id: "u-other",
      driver_name: "Jane Driver",
      driver_avatar: null,
      seats_offered: 3,
      seats_taken: 0,
      departure_time: new Date(Date.now() + 86400000).toISOString(),
      location_string: "Library",
      notes: null,
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requests: [],
    };

    vi.mocked(getEventCarpools).mockResolvedValue([mockCarpool]);
    vi.mocked(requestCarpoolSeat).mockResolvedValueOnce({} as any);

    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Request Seat")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Request Seat"));

    await waitFor(() => {
      expect(requestCarpoolSeat).toHaveBeenCalledWith({
        carpool_id: "cp-1",
        rider_user_id: "u-1",
        pickup_notes: undefined,
      });
    });
  });

  it("shows pending request status", async () => {
    const mockCarpool = {
      id: "cp-1",
      event_id: "evt-1",
      driver_user_id: "u-other",
      driver_name: "Jane Driver",
      driver_avatar: null,
      seats_offered: 3,
      seats_taken: 0,
      departure_time: new Date(Date.now() + 86400000).toISOString(),
      location_string: "Library",
      notes: null,
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requests: [
        {
          id: "req-1",
          carpool_id: "cp-1",
          rider_user_id: "u-1",
          rider_name: "Me",
          rider_avatar: null,
          status: "pending" as const,
          pickup_notes: null,
          created_at: new Date().toISOString(),
          responded_at: null,
        },
      ],
    };

    vi.mocked(getEventCarpools).mockResolvedValueOnce([mockCarpool]);
    vi.mocked(hasUserRequested).mockResolvedValueOnce(true);

    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("⏳ Request pending — waiting for driver to respond"),
      ).toBeInTheDocument();
    });
  });

  it("shows accepted request confirmation", async () => {
    const mockCarpool = {
      id: "cp-1",
      event_id: "evt-1",
      driver_user_id: "u-other",
      driver_name: "Jane Driver",
      driver_avatar: null,
      seats_offered: 3,
      seats_taken: 1,
      departure_time: new Date(Date.now() + 86400000).toISOString(),
      location_string: "Library",
      notes: null,
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requests: [
        {
          id: "req-1",
          carpool_id: "cp-1",
          rider_user_id: "u-1",
          rider_name: "Me",
          rider_avatar: null,
          status: "accepted" as const,
          pickup_notes: null,
          created_at: new Date().toISOString(),
          responded_at: new Date().toISOString(),
        },
      ],
    };

    vi.mocked(getEventCarpools).mockResolvedValueOnce([mockCarpool]);
    vi.mocked(hasUserRequested).mockResolvedValueOnce(true);

    render(
      <EventCarpoolTab eventId="evt-1" eventTitle="Test Event" userId="u-1" />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "✅ Your seat is confirmed! A DM thread has been opened with the driver.",
        ),
      ).toBeInTheDocument();
    });
  });
});
