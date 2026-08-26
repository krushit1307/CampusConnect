import { describe, expect, it } from "vitest";

import {
  REVOCATION_REASON_MAX_LENGTH,
  buildRevocationMessage,
  normalizeRevocationReason,
} from "./certificateRevocation";

describe("certificate revocation helpers", () => {
  it("trims and accepts a valid reason", () => {
    expect(normalizeRevocationReason("  Final assessment irregularity  ")).toBe(
      "Final assessment irregularity",
    );
  });

  it("rejects empty, too-short, and oversized reasons", () => {
    expect(normalizeRevocationReason("  ")).toBeNull();
    expect(normalizeRevocationReason("no")).toBeNull();
    expect(normalizeRevocationReason("x".repeat(REVOCATION_REASON_MAX_LENGTH + 1))).toBeNull();
  });

  it("builds an explicit public revoked message", () => {
    expect(buildRevocationMessage("Academic misconduct confirmed.")).toContain(
      "REVOKED. This credential has been invalidated",
    );
    expect(buildRevocationMessage(null)).toContain("issuer-reported integrity concern");
  });
});
