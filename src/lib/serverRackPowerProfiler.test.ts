import { describe, expect, it } from "vitest";
import {
  BREAKER_AMPS,
  SAFETY_THRESHOLD_RATIO,
  evaluateRackPower,
  kubernetesThrottlePatch,
  parsePduTelemetry,
  pduStatusPath,
  safetyThresholdAmps,
} from "./serverRackPowerProfiler";

describe("server rack power profiler (#5282)", () => {
  it("sets the safety threshold at 85% of a 20-amp breaker", () => {
    expect(BREAKER_AMPS).toBe(20);
    expect(SAFETY_THRESHOLD_RATIO).toBe(0.85);
    expect(safetyThresholdAmps()).toBe(17);
  });

  it("parses APC and CyberPower PDU draws and trips at 4000W", () => {
    const apc = parsePduTelemetry("apc", {
      outletPhaseMeasurement: { current: 33.3, voltage: 120 },
    });
    const cyber = parsePduTelemetry("cyberpower", {
      data: { power_watt: 4000, voltage: 120 },
    });
    expect(evaluateRackPower(apc).exceedsThreshold).toBe(true);
    expect(evaluateRackPower(cyber).exceedsThreshold).toBe(true);
    expect(pduStatusPath("apc")).toContain("/rest/pdu/");
    expect(pduStatusPath("cyberpower")).toContain("/api/v1/pdu/");
  });

  it("does not throttle when draw stays under the 17A / 2040W cap", () => {
    const reading = parsePduTelemetry("apc", { amps: 16, volts: 120 });
    expect(evaluateRackPower(reading).exceedsThreshold).toBe(false);
    expect(kubernetesThrottlePatch().spec.containers[0].resources.limits["nvidia.com/gpu"]).toBe(
      "0",
    );
  });
});
