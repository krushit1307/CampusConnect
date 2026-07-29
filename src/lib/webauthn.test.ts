import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    isWebAuthnSupported,
    getWebAuthnErrorMessage,
    getRpId,
    getOrigin,
} from "./webauthn";

describe("WebAuthn Utility Tests", () => {
    beforeEach(() => {
        const originalWindow = (typeof window !== 'undefined' ? window : {}) as any;
        const originalNavigator = (typeof navigator !== 'undefined' ? navigator : {}) as any;

        vi.stubGlobal("window", {
            ...originalWindow,
            location: {
                ...originalWindow.location,
                hostname: "localhost",
                origin: "http://localhost:3000",
            },
            PublicKeyCredential: () => { },
        });
        vi.stubGlobal("navigator", {
            ...originalNavigator,
            credentials: {},
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("isWebAuthnSupported", () => {
        it("should return true when window, PublicKeyCredential, and navigator.credentials are present", () => {
            expect(isWebAuthnSupported()).toBe(true);
        });

        it("should return false when window is undefined", () => {
            vi.stubGlobal("window", undefined);
            expect(isWebAuthnSupported()).toBe(false);
        });

        it("should return false when PublicKeyCredential is not defined", () => {
            vi.stubGlobal("window", {
                location: { hostname: "localhost" },
            });
            expect(isWebAuthnSupported()).toBe(false);
        });

        it("should return false when navigator.credentials is not defined", () => {
            vi.stubGlobal("navigator", {});
            expect(isWebAuthnSupported()).toBe(false);
        });
    });

    describe("getRpId", () => {
        it("should extract hostname from window location", () => {
            expect(getRpId()).toBe("localhost");
        });
    });

    describe("getOrigin", () => {
        it("should return origin from window location", () => {
            expect(getOrigin()).toBe("http://localhost:3000");
        });
    });

    describe("getWebAuthnErrorMessage", () => {
        it("should map NotAllowedError to user cancellation statement", () => {
            const error = new DOMException("The operation was cancelled", "NotAllowedError");
            expect(getWebAuthnErrorMessage(error)).toContain("cancelled or timed out");
        });

        it("should map SecurityError to connection instructions", () => {
            const error = new DOMException("Security error", "SecurityError");
            expect(getWebAuthnErrorMessage(error)).toContain("secure connection (HTTPS)");
        });

        it("should map InvalidStateError to device duplication info", () => {
            const error = new DOMException("Passkey present", "InvalidStateError");
            expect(getWebAuthnErrorMessage(error)).toContain("already registered on this device");
        });

        it("should map general Error objects to their message", () => {
            const error = new Error("Custom test error");
            expect(getWebAuthnErrorMessage(error)).toBe("Custom test error");
        });

        it("should map other types/strings to fallback message", () => {
            expect(getWebAuthnErrorMessage("Arbitrary string error")).toBe(
                "An unexpected error occurred during authentication."
            );
        });
    });
});
