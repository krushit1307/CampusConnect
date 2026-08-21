import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeVenueCapacityOptimization, WAITLIST_THRESHOLD } from "../venueCapacityOptimizer";
import { createClient } from "../../lib/supabase/client";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

describe("Venue Capacity Optimizer Service (#3463)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects chronic under-capacity venue bookings when past waitlists average > 10", async () => {
    // Mock RPC fallback or RPC return
    mockRpc.mockResolvedValue({
      data: {
        should_upgrade: true,
        avg_waitlist_count: 15,
        current_venue_name: "Room 101",
        current_capacity: 30,
        suggested_venue_name: "Room 204",
        suggested_capacity: 50,
        prompt_message:
          "You consistently cap out Room 101 with 15 people on the waitlist. Room 204 (Capacity 50) is available on this date. Click here to upgrade your venue instantly.",
      },
      error: null,
    });

    const result = await analyzeVenueCapacityOptimization("club-chess", "Room 101");

    expect(result.should_upgrade).toBe(true);
    expect(result.avg_waitlist_count).toBe(15);
    expect(result.suggested_venue_name).toBe("Room 204");
    expect(result.suggested_capacity).toBe(50);
    expect(result.prompt_message).toContain(
      "You consistently cap out Room 101 with 15 people on the waitlist",
    );
    expect(result.prompt_message).toContain("Room 204 (Capacity 50) is available");
  });

  it("does NOT generate upgrade recommendation if average waitlist is 10 or below", async () => {
    mockRpc.mockResolvedValue({
      data: {
        should_upgrade: false,
        avg_waitlist_count: 4,
        current_venue_name: "Room 101",
        current_capacity: 30,
      },
      error: null,
    });

    const result = await analyzeVenueCapacityOptimization("club-chess", "Room 101");
    expect(result.should_upgrade).toBe(false);
    expect(result.suggested_venue_name).toBeUndefined();
  });

  it("client fallback calculates waitlist average from last 5 past events correctly", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("RPC not found") });

    mockFrom.mockImplementation((table: string) => {
      if (table === "events") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      { waitlist_count: 15, max_attendees: 30 },
                      { waitlist_count: 15, max_attendees: 30 },
                      { waitlist_count: 15, max_attendees: 30 },
                      { waitlist_count: 15, max_attendees: 30 },
                      { waitlist_count: 15, max_attendees: 30 },
                    ],
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "venues") {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ name: "Room 204", capacity: 50 }],
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await analyzeVenueCapacityOptimization("club-chess", "Room 101");

    expect(result.should_upgrade).toBe(true);
    expect(result.avg_waitlist_count).toBe(15);
    expect(result.suggested_venue_name).toBe("Room 204");
    expect(result.suggested_capacity).toBe(50);
  });
});
