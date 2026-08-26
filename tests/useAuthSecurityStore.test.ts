import { describe, it, expect, beforeEach } from "vitest";
import { useAuthSecurityStore } from "@/store/useAuthSecurityStore";

describe("useAuthSecurityStore", () => {
  beforeEach(() => {
    useAuthSecurityStore.getState().clearAuth();
    // Re-apply defaults that clearAuth intentionally clears
    useAuthSecurityStore.setState({
      isAuthenticated: true,
      mfaVerified: true,
    });
  });

  it("setAuthenticated(null) clears token and sets isAuthenticated=false", () => {
    useAuthSecurityStore.getState().setAuthenticated("tok_123");
    expect(useAuthSecurityStore.getState().token).toBe("tok_123");
    expect(useAuthSecurityStore.getState().isAuthenticated).toBe(true);

    useAuthSecurityStore.getState().setAuthenticated(null);
    expect(useAuthSecurityStore.getState().token).toBeNull();
    expect(useAuthSecurityStore.getState().isAuthenticated).toBe(false);
  });

  it("setIsLeaderTab updates isLeaderTab", () => {
    useAuthSecurityStore.getState().setIsLeaderTab(true);
    expect(useAuthSecurityStore.getState().isLeaderTab).toBe(true);
  });

  it("setMfaVerified updates mfaVerified", () => {
    useAuthSecurityStore.getState().setMfaVerified(false);
    expect(useAuthSecurityStore.getState().mfaVerified).toBe(false);
  });

  it("setSessionTimeoutWarning updates the warning flag", () => {
    useAuthSecurityStore.getState().setSessionTimeoutWarning(true);
    expect(useAuthSecurityStore.getState().sessionTimeoutWarning).toBe(true);
  });

  it("clearAuth wipes sensitive fields", () => {
    useAuthSecurityStore.getState().setAuthenticated("tok_x");
    useAuthSecurityStore.getState().setMfaVerified(true);

    useAuthSecurityStore.getState().clearAuth();

    const s = useAuthSecurityStore.getState();
    expect(s.token).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.mfaVerified).toBe(false);
    expect(s.sessionTimeoutWarning).toBe(false);
  });
});
