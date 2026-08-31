import { describe, expect, it } from "vitest";
import {
  FALLBACK_DEVICE_FINGERPRINT,
  isHighDemandEvent,
  normalizeDeviceFingerprint,
} from "./ticketScalping";

describe("ticket scalping helpers", () => {
  it("requires the explicit server-managed high-demand flag", () => {
    expect(isHighDemandEvent({ is_high_demand: true })).toBe(true);
    expect(isHighDemandEvent({ is_high_demand: false })).toBe(false);
    expect(isHighDemandEvent({ is_high_risk: true } as never)).toBe(false);
    expect(isHighDemandEvent(null)).toBe(false);
  });

  it("rejects the shared fingerprint failure fallback", () => {
    expect(normalizeDeviceFingerprint(FALLBACK_DEVICE_FINGERPRINT)).toBeNull();
    expect(normalizeDeviceFingerprint("  fallback-anonymous-id  ")).toBeNull();
  });

  it("accepts a bounded FingerprintJS visitor id", () => {
    expect(normalizeDeviceFingerprint("a1b2c3d4e5f6g7h8i9j0")).toBe("a1b2c3d4e5f6g7h8i9j0");
    expect(normalizeDeviceFingerprint("too short")).toBeNull();
    expect(normalizeDeviceFingerprint("x".repeat(129))).toBeNull();
  });
});
