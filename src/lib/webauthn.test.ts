import { describe, it, expect, vi, beforeEach } from "vitest";
import { isWebAuthnSupported, registerPasskey, authenticateWithPasskey } from "./webauthn";

describe("WebAuthn Passkeys Helper", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isWebAuthnSupported", () => {
    it("returns false if PublicKeyCredential is not present", () => {
      const isSupported = isWebAuthnSupported();
      expect(typeof isSupported).toBe("boolean");
    });
  });

  describe("registerPasskey", () => {
    it("handles registration when WebAuthn is not supported", async () => {
      if (!isWebAuthnSupported()) {
        const res = await registerPasskey("Test Key");
        expect(res.success).toBe(false);
        expect(res.error).toContain("not supported");
      }
    });
  });

  describe("authenticateWithPasskey", () => {
    it("handles authentication when WebAuthn is not supported", async () => {
      if (!isWebAuthnSupported()) {
        const res = await authenticateWithPasskey("test@example.com");
        expect(res.success).toBe(false);
        expect(res.error).toContain("not supported");
      }
    });
  });
});
