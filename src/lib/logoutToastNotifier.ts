export interface ToastNotificationPayload {
  type: "success" | "error";
  message: string;
  durationMs: number;
}

export const LOGOUT_SUCCESS_MESSAGE = "Successfully logged out";

/**
 * Generates structured toast notification payload for logout events, replacing native alert() popups.
 */
export function handleLogoutNotification(
  toastTrigger: (type: "success" | "error", message: string) => void,
  isSuccess = true,
): ToastNotificationPayload {
  const message = isSuccess ? LOGOUT_SUCCESS_MESSAGE : "Failed to log out. Please try again.";
  const type = isSuccess ? "success" : "error";

  toastTrigger(type, message);

  return {
    type,
    message,
    durationMs: 3000,
  };
}
