import { describe, expect, it } from "vitest";

import { nextBroadcastState, shouldUseFallback } from "./broadcastFailover";

describe("broadcast failover state", () => {
  it("activates the fallback on a disconnected or failed presenter connection", () => {
    expect(nextBroadcastState("primary", "disconnected", false)).toBe("fallback");
    expect(nextBroadcastState("primary", "failed", false)).toBe("fallback");
  });

  it("does not resume the primary source until the A/V check passes", () => {
    expect(nextBroadcastState("fallback", "checking", false)).toBe("fallback");
    expect(nextBroadcastState("fallback", "connected", false)).toBe("fallback");
    expect(nextBroadcastState("fallback", "connected", true)).toBe("primary");
  });

  it("treats either durable source signal as fallback mode", () => {
    expect(shouldUseFallback("fallback", "primary")).toBe(true);
    expect(shouldUseFallback("primary", "fallback")).toBe(true);
    expect(shouldUseFallback("primary", "primary")).toBe(false);
  });
});
