/**
 * Web Push Notification Utilities
 * Implements VAPID key conversion, graceful permission requests,
 * and push notification payload formatting (#2645).
 */

export interface EventPushPayload {
  title: string;
  body: string;
  icon: string;
  data: {
    url: string;
    eventId: string;
  };
  tag: string;
}

/**
 * Converts a URL-safe Base64 VAPID public key into a Uint8Array.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String || typeof base64String !== "string") {
    return new Uint8Array(0);
  }
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Converts an ArrayBuffer key to a Base64 string for database storage.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Checks if Web Push notifications are supported in the current browser.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Gracefully requests notification permission from the user (e.g. after successful RSVP).
 */
export async function requestNotificationPermissionGracefully(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

/**
 * Formats a push notification payload for an upcoming event reminder.
 */
export function formatEventReminderPayload(
  eventTitle: string,
  eventId: string,
  minutesUntilStart = 60,
): EventPushPayload {
  return {
    title: `Upcoming Event: ${eventTitle}`,
    body: `Your event "${eventTitle}" starts in ${minutesUntilStart} minutes! Tap to view details.`,
    icon: "/favicon.png",
    data: {
      url: `/events/${eventId}`,
      eventId,
    },
    tag: `event-reminder-${eventId}`,
  };
}
