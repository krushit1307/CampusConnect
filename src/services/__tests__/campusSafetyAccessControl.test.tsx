import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampusSafetyAccessControlService } from "../campusSafetyAccessControlService";

// ---------------------------------------------------------------------------
// Supabase Client mock
// ---------------------------------------------------------------------------
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "exterior_doors") {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      if (table === "lorawan_gateways") {
        return {
          select: mockSelect,
        };
      }
      if (table === "lorawan_transmissions") {
        return {
          insert: mockInsert,
        };
      }
      return {
        select: mockSelect,
        update: mockUpdate,
        insert: mockInsert,
      };
    },
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("CampusSafetyAccessControlService", () => {
  const mockDoors = [
    {
      id: "door-1",
      building: "Science Building",
      door_name: "North Gate",
      status: "OPEN",
      rest_endpoint_url: "http://science.local/north/lock",
      lora_device_eui: "1000000000000001",
    },
    {
      id: "door-2",
      building: "Science Building",
      door_name: "South Gate",
      status: "OPEN",
      rest_endpoint_url: "http://science.local/south/lock",
      lora_device_eui: "1000000000000002",
    },
  ];

  const mockGateways = [
    {
      id: "gateway-1",
      gateway_name: "Main Mast",
      location: "Tower Roof",
      status: "ONLINE",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default query builders
    mockSelect.mockImplementation((columns?: string) => {
      // We return builders that chain eq / limit
      return {
        eq: (col: string, val: any) => {
          if (col === "building") {
            return {
              data: mockDoors,
              error: null,
            };
          }
          if (col === "status") {
            return {
              limit: (limitNum: number) => {
                return {
                  data: mockGateways,
                  error: null,
                };
              },
            };
          }
          return { data: [], error: null };
        },
      };
    });

    mockUpdate.mockImplementation(() => {
      return {
        eq: () => ({ error: null }),
      };
    });

    mockInsert.mockImplementation(() => {
      return { error: null };
    });
  });

  it("locks doors using REST API when connectivity is healthy", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await CampusSafetyAccessControlService.lockDoors("Science Building");

    expect(result.success).toBe(true);
    expect(result.method).toBe("REST");
    expect(result.doorsUpdated).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Door update should be called with status: LOCKED
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("fails over to LoRaWAN when REST API connection times out or fails", async () => {
    // Simulate network error/rejection
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const result = await CampusSafetyAccessControlService.lockDoors("Science Building");

    expect(result.success).toBe(true);
    expect(result.method).toBe("LORAWAN");
    expect(result.doorsUpdated).toBe(2);
    // Verifies LoRa transmissions are logged
    expect(mockInsert).toHaveBeenCalledTimes(2);
    // Verifies payload generation format (payload:0x...)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "LOCK_ALL",
        encrypted_payload: expect.stringMatching(/^payload:0x[0-9A-F]+$/),
      })
    );
  });

  it("directly fails over to LoRaWAN when network blackout option is toggled", async () => {
    const result = await CampusSafetyAccessControlService.lockDoors("Science Building", {
      simulateNetworkBlackout: true,
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe("LORAWAN");
    // Verify REST API was completely skipped (no fetch calls)
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
