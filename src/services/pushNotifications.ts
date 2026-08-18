import { createClient } from "@/lib/supabase/client";

// Utility to convert Base64 string to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestPushPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.error("This browser does not support desktop notification");
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export async function subscribeToPushNotifications(userId: string): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push messaging is not supported");
      return false;
    }

    const permission = await requestPushPermission();
    if (!permission) {
      console.warn("Notification permission denied");
      return false;
    }

    // Register service worker if not already registered
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // We need the VAPID public key
    const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      console.error("VITE_VAPID_PUBLIC_KEY is not defined in environment");
      return false;
    }

    // Subscribe to push manager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
    });

    const subscriptionData = subscription.toJSON();

    if (!subscriptionData.endpoint || !subscriptionData.keys) {
      throw new Error("Invalid subscription data");
    }

    const supabase = createClient();
    // Save to Supabase
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscriptionData.endpoint,
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      console.error("Error saving push subscription to Supabase:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
    return false;
  }
}

export async function checkSubscriptionStatus(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return true;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    const supabase = createClient();
    // Delete from Supabase
    const endpoint = subscription.endpoint;
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

    // Unsubscribe from browser
    await subscription.unsubscribe();
    return true;
  } catch (error) {
    console.error("Error unsubscribing:", error);
    return false;
  }
}
