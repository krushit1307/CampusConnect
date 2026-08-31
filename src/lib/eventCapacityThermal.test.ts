import { describe, expect, it } from "vitest";

import {
  formatDeviceCount,
  getThermalColor,
  getThermalRatio,
  normalizeMacAddress,
  normalizeWifiApiResponse,
} from "./eventCapacityThermal";

describe("event capacity thermal helpers", () => {
  it("normalizes supported MAC address separators and rejects unsafe identifiers", () => {
    expect(normalizeMacAddress("aa-bb-cc-dd-ee-ff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizeMacAddress("AA:BB:CC:DD:EE:FF")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizeMacAddress("not-a-mac")).toBeNull();
    expect(normalizeMacAddress(123)).toBeNull();
  });

  it("normalizes aggregate provider readings and drops malformed or excessive counts", () => {
    expect(
      normalizeWifiApiResponse({
        data: [
          { mac: "aa-bb-cc-dd-ee-ff", clientCount: 12.8 },
          { mac: "00:11:22:33:44:55", clients: 8 },
          { mac: "invalid", clients: 4 },
          { mac: "66:77:88:99:AA:BB", clients: -1 },
          { mac: "CC:DD:EE:FF:00:11", clients: 2_000_000 },
        ],
      }),
    ).toEqual([
      { macAddress: "AA:BB:CC:DD:EE:FF", deviceCount: 12 },
      { macAddress: "00:11:22:33:44:55", deviceCount: 8 },
    ]);
  });

  it("maps capacity ratios to low, high, and over-capacity heat colors", () => {
    expect(getThermalRatio(50, 100)).toBe(0.5);
    expect(getThermalRatio(null, 100)).toBe(0);
    expect(getThermalColor(0.4)).toBe("#86efac");
    expect(getThermalColor(0.8)).toBe("#facc15");
    expect(getThermalColor(1.2)).toBe("#dc2626");
  });

  it("formats missing readings explicitly instead of implying zero occupancy", () => {
    expect(formatDeviceCount(null)).toBe("No reading");
    expect(formatDeviceCount(120)).toBe("120 devices");
  });
});
