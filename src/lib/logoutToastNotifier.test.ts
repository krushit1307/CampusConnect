import { describe, it, expect, vi } from "vitest";
import { handleLogoutNotification, LOGOUT_SUCCESS_MESSAGE } from "./logoutToastNotifier";

describe("Change Standard Browser Alert to Custom Toast on Logout Suite (#3835)", () => {
  it("dispatches success toast with 'Successfully logged out' message instead of alert()", () => {
    const mockToast = vi.fn();

    const payload = handleLogoutNotification(mockToast, true);

    expect(mockToast).toHaveBeenCalledWith("success", LOGOUT_SUCCESS_MESSAGE);
    expect(payload.type).toBe("success");
    expect(payload.message).toBe(LOGOUT_SUCCESS_MESSAGE);
  });

  it("handles logout failure cases gracefully with an error toast", () => {
    const mockToast = vi.fn();

    const payload = handleLogoutNotification(mockToast, false);

    expect(mockToast).toHaveBeenCalledWith("error", "Failed to log out. Please try again.");
    expect(payload.type).toBe("error");
  });
});
