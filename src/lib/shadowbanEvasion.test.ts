import { describe, expect, it } from "vitest";

import { normalizeShadowbanFingerprint } from "./shadowbanEvasion";

describe("shadowban evasion fingerprint normalization", () => {
  it("accepts a stable fingerprint value", () => {
    expect(normalizeShadowbanFingerprint("  abcdef0123456789  ")).toBe("abcdef0123456789");
  });

  it("rejects fallback and malformed identifiers", () => {
    expect(normalizeShadowbanFingerprint("fallback-anonymous-id")).toBeNull();
    expect(normalizeShadowbanFingerprint("short")).toBeNull();
    expect(normalizeShadowbanFingerprint("x".repeat(257))).toBeNull();
    expect(normalizeShadowbanFingerprint("not safe/with spaces")).toBeNull();
    expect(normalizeShadowbanFingerprint(null)).toBeNull();
  });
});
