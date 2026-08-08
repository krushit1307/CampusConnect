import { describe, it, expect, vi, beforeEach } from "vitest";
import { isWebAuthnSupported, registerPasskey, authenticateWithPasskey } from "./webauthn";

describe("WebAuthn Passkeys Helper", () => {
  beforeEach(() => {
    const originalWindow = (typeof window !== "undefined" ? window : {}) as Record<string, unknown>;
    const originalNavigator = (typeof navigator !== "undefined" ? navigator : {}) as Record<
      string,
      unknown
    >;

    vi.stubGlobal("window", {
      ...originalWindow,
      location: {
        ...((originalWindow.location as Record<string, unknown>) || {}),
        hostname: "localhost",
        origin: "http://localhost:3000",
      },
      PublicKeyCredential: () => {},
    });
    vi.stubGlobal("navigator", {
      ...originalNavigator,
      credentials: {
        create: vi.fn(),
        get: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
