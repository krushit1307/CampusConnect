/**
 * Web Push Notifications Utility
 * 
 * Handles requesting notification permissions, subscribing the user to push notifications,
 * and sending the subscription details to the backend for storage.
 */

import { supabase } from './supabase/client';

// Public VAPID Key (Replace with your actual generated VAPID public key)
// @ts-ignore - import.meta.env is provided by Vite
const VAPID_PUBLIC_KEY = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || 'your-vapid-public-key-here';

/**
 * Checks if the browser supports service workers and push notifications.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Requests notification permission from the user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return await Notification.requestPermission();
}

/**
 * Registers the service worker and subscribes the user to push notifications.
 * Sends the subscription object to the backend to be stored in the push_subscriptions table.
 */
export async function subscribeToPushNotifications(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications are not supported in this browser.' };
  }

  try {
    // 1. Register Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered successfully:', registration);

    // 2. Check permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied by user.' };
    }

    // 3. Subscribe to push manager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });

    // 4. Send subscription to backend
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        endpoint: subscription.endpoint,
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(subscription.getKey('auth')!),
      }, { onConflict: 'user_id,endpoint' });

    if (error) {
      console.error('Failed to save push subscription to database:', error);
      return { success: false, error: 'Failed to save subscription to database.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error subscribing to push notifications:', err);
    return { success: false, error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Helper: Converts a base64 string to a Uint8Array (required for VAPID key).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Helper: Converts an ArrayBuffer to a base64 string for database storage.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
