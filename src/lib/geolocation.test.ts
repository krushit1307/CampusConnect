// src/lib/geolocation.test.ts
// Issue: #4679 - Automated "Waitlist Promotion" Geographic Prioritization
// Tests for geolocation library functions

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateUserLocation,
  requestGPSPingForWaitlist,
  getUserLocation,
  calculateDistance,
  updateLocationFromBrowser,
} from "./geolocation";

// Mock Supabase client
vi.mock("./supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe("geolocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateUserLocation", () => {
    it("should successfully update user location with valid coordinates", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, message: "Location updated successfully." },
        error: null,
      });

      const result = await updateUserLocation(40.7128, -74.006);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Location updated successfully.");
      expect(supabase.rpc).toHaveBeenCalledWith("update_user_location", {
        p_latitude: 40.7128,
        p_longitude: -74.006,
      });
    });

    it("should reject invalid latitude", async () => {
      const result = await updateUserLocation(91, -74.006);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid latitude");
    });

    it("should reject invalid longitude", async () => {
      const result = await updateUserLocation(40.7128, 181);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid longitude");
    });

    it("should handle server errors", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const result = await updateUserLocation(40.7128, -74.006);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("requestGPSPingForWaitlist", () => {
    it("should successfully request GPS ping for waitlist", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true, users_pinged: 5, message: "GPS ping requested for 5 users" },
        error: null,
      });

      const result = await requestGPSPingForWaitlist("event-123");

      expect(result.success).toBe(true);
      expect(result.users_pinged).toBe(5);
      expect(supabase.functions.invoke).toHaveBeenCalledWith("request-gps-ping", {
        body: { eventId: "event-123" },
      });
    });

    it("should handle server errors", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.functions.invoke as any).mockResolvedValue({
        data: null,
        error: { message: "Function error" },
      });

      const result = await requestGPSPingForWaitlist("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Function error");
    });
  });

  describe("getUserLocation", () => {
    it("should successfully fetch user location", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.from as any).mockReturnValue({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              latitude: 40.7128,
              longitude: -74.006,
              last_location_updated_at: "2024-01-01T00:00:00Z",
            },
            error: null,
          })),
        })),
      });

      const result = await getUserLocation();

      expect(result).toEqual({
        latitude: 40.7128,
        longitude: -74.006,
        last_updated: "2024-01-01T00:00:00Z",
      });
    });

    it("should return null on error", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.from as any).mockReturnValue({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: { message: "Error fetching location" },
          })),
        })),
      });

      const result = await getUserLocation();

      expect(result).toBeNull();
    });
  });

  describe("calculateDistance", () => {
    it("should calculate distance between two points correctly", () => {
      // Distance between NYC (40.7128, -74.0060) and Boston (42.3601, -71.0589)
      // Should be approximately 305 km
      const distance = calculateDistance(40.7128, -74.006, 42.3601, -71.0589);
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(310);
    });

    it("should return 0 for same coordinates", () => {
      const distance = calculateDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(distance).toBeCloseTo(0, 5);
    });

    it("should handle negative coordinates", () => {
      const distance = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
      expect(distance).toBeGreaterThan(700);
      expect(distance).toBeLessThan(750);
    });
  });

  describe("updateLocationFromBrowser", () => {
    it("should successfully update location from browser", async () => {
      // Mock navigator.geolocation
      global.navigator = {
        geolocation: {
          getCurrentPosition: vi.fn((success) => {
            success({
              coords: {
                latitude: 40.7128,
                longitude: -74.006,
              },
            });
          }),
        },
      } as any;

      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, message: "Location updated successfully." },
        error: null,
      });

      const result = await updateLocationFromBrowser();

      expect(result.success).toBe(true);
      expect(result.message).toBe("Location updated successfully.");
    });

    it("should handle geolocation not supported", async () => {
      global.navigator = {} as any;

      const result = await updateLocationFromBrowser();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Geolocation is not supported");
    });

    it("should handle geolocation permission denied", async () => {
      global.navigator = {
        geolocation: {
          getCurrentPosition: vi.fn((success, error) => {
            error({ message: "Permission denied" });
          }),
        },
      } as any;

      const result = await updateLocationFromBrowser();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
    });
  });
});
