import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateDistanceKm,
  calculateDistanceMiles,
  getTransitItineraries,
  transitScooterService,
} from "../transitScooterService";
import { createClient } from "@/lib/supabase/client";

// Mock supabase client
vi.mock("@/lib/supabase/client", () => {
  const mockInvoke = vi.fn();
  const mockFrom = vi.fn().mockReturnValue({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: "res-1" }], error: null }),
    }),
  });
  return {
    createClient: vi.fn().mockReturnValue({
      functions: {
        invoke: mockInvoke,
      },
      from: mockFrom,
    }),
  };
});

describe("transitScooterService - Haversine Maths", () => {
  it("calculates correct distance in kilometers between coordinates", () => {
    // Distance between Main Quad (30.3582, 76.3688) and Downtown Hub (30.3415, 76.3524)
    const distKm = calculateDistanceKm(30.3582, 76.3688, 30.3415, 76.3524);
    expect(distKm).toBeGreaterThan(2.0);
    expect(distKm).toBeLessThan(3.0);
  });

  it("calculates correct distance in miles", () => {
    const distMiles = calculateDistanceMiles(30.3582, 76.3688, 30.3415, 76.3524);
    expect(distMiles).toBeCloseTo(2.45 * 0.621371, 1);
  });
});

describe("transitScooterService - Public Transit Itineraries", () => {
  it("generates transit itineraries from standard campus hubs", () => {
    const venueLat = 30.3564;
    const venueLon = 76.3647;
    const itineraries = getTransitItineraries(venueLat, venueLon, "Library Hall");

    expect(itineraries.length).toBe(3);
    expect(itineraries[0].legs.length).toBe(2);
    expect(itineraries[0].finalStop.name).toContain("Library Hall North Transit stop");

    // verify walking distances are calculated correctly for the final leg
    expect(itineraries[0].walkingDistanceMiles).toBeLessThan(itineraries[2].walkingDistanceMiles);
  });

  it("correctly identifies when walking distance exceeds the 0.5-mile threshold", () => {
    const venueLat = 30.3564;
    const venueLon = 76.3647;
    const itineraries = getTransitItineraries(venueLat, venueLon);

    // Day 1 (index 0) offset is 0.003, walking dist should be ~0.26 miles
    expect(itineraries[0].walkingDistanceMiles).toBeLessThan(0.5);

    // Day 3 (index 2) offset is 0.012, walking dist should be ~1.05 miles (> 0.5 miles)
    expect(itineraries[2].walkingDistanceMiles).toBeGreaterThan(0.5);
  });
});

describe("transitScooterService - Edge Function Integration", () => {
  const mockSupabase = createClient();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the Supabase edge function with coordinates and returns e-scooters", async () => {
    const mockScooter = {
      id: "scooter-lime-1",
      provider: "lime",
      latitude: 30.3565,
      longitude: 76.3648,
      batteryPercent: 88,
      distanceToStopFeet: 45,
      distanceToStopMeters: 13,
      unlockPrice: 1.0,
      pricePerMinute: 0.22,
      deepLink: "lime://ride?id=scooter-lime-1",
    };

    const mockInvoke = mockSupabase.functions.invoke as any;
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        scooters: [mockScooter],
      },
      error: null,
    });

    const scooters = await transitScooterService.getAvailableScooters(30.3564, 76.3647);
    expect(scooters.length).toBe(1);
    expect(scooters[0]).toEqual(mockScooter);
    expect(mockInvoke).toHaveBeenCalledWith("transit-scooter-sync", {
      body: { latitude: 30.3564, longitude: 76.3647, radiusFeet: 200, minBattery: 20 },
    });
  });

  it("caches coordinates query results and avoids duplicate edge function calls", async () => {
    const mockInvoke = mockSupabase.functions.invoke as any;
    mockInvoke.mockResolvedValue({
      data: { success: true, scooters: [] },
      error: null,
    });

    // Query same coordinates twice in quick succession
    await transitScooterService.getAvailableScooters(30.4, 76.4);
    await transitScooterService.getAvailableScooters(30.4, 76.4);

    // Should only invoke once
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("falls back to deterministic client mock generation if edge function invocation fails", async () => {
    const mockInvoke = mockSupabase.functions.invoke as any;
    mockInvoke.mockRejectedValue(new Error("Network connection error"));

    const scooters = await transitScooterService.getAvailableScooters(30.3564, 76.3647, 300, 20);

    expect(scooters.length).toBeGreaterThan(0);
    expect(scooters[0].id).toContain("scooter-");
    expect(scooters[0].distanceToStopFeet).toBeLessThanOrEqual(300);
  });

  it("records scooter reservation log in event_logistics database", async () => {
    const success = await transitScooterService.reserveScooter("scooter-1", "lime");
    expect(success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("event_logistics");
  });
});
