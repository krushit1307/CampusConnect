import { describe, it, expect, vi } from "vitest";
import { getEventsNearby } from "./events";
import { supabase } from "./client";

vi.mock("./client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("getEventsNearby", () => {
  it("calls supabase.rpc with correct parameters and returns data", async () => {
    const mockEvents = [
      {
        id: "event-1",
        club_id: "club-1",
        category_id: null,
        title: "Nearby Concert",
        description: "Live music on campus",
        banner_url: null,
        event_date: "2026-08-01T18:00:00Z",
        start_date: "2026-08-01T18:00:00Z",
        end_date: "2026-08-01T21:00:00Z",
        location: "Main Quad",
        latitude: 37.7894,
        longitude: -122.4194,
        max_attendees: 100,
        available_spots: 50,
        status: "published",
        created_at: "2026-07-30T10:00:00Z",
        distance_meters: 1612.5,
      },
    ];

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: mockEvents,
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    });

    const result = await getEventsNearby(37.7749, -122.4194, 3218.69);

    expect(supabase.rpc).toHaveBeenCalledWith("get_events_nearby", {
      user_lat: 37.7749,
      user_lng: -122.4194,
      radius_meters: 3218.69,
    });
    expect(result.data).toEqual(mockEvents);
    expect(result.error).toBeNull();
  });

  it("uses default radius when radius_meters is omitted", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [],
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    });

    await getEventsNearby(37.7749, -122.4194);

    expect(supabase.rpc).toHaveBeenCalledWith("get_events_nearby", {
      user_lat: 37.7749,
      user_lng: -122.4194,
      radius_meters: 8046.72,
    });
  });

  it("handles errors gracefully when RPC fails", async () => {
    const mockError = { message: "Database connection failed", code: "500", details: "", hint: "" };

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: mockError,
      count: null,
      status: 500,
      statusText: "Error",
    });

    const result = await getEventsNearby(37.7749, -122.4194);

    expect(result.data).toBeNull();
    expect(result.error).toEqual(mockError);
  });
});
