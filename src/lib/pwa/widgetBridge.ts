// =============================================================================
// Utility: Native Widget Bridge
// Issue: #3228 - Develop a 'Dynamic Event Countdown Widget' for Mobile Homescreens
// Description: Provides a bridge to communicate with native iOS (WidgetKit) 
// and Android (AppWidgetManager) extensions via Capacitor or a custom PWA 
// Widget API wrapper. Handles secure token passing to the App Group container.
// =============================================================================

import { supabase } from '../supabaseClient';

// Declare global Capacitor or Native Bridge interfaces
declare global {
    interface Window {
        Capacitor?: any;
        NativeWidgetBridge?: {
            reloadTimelines: (kind: string) => void;
            setSharedAuthToken: (token: string) => Promise<boolean>;
        };
    }
}

/**
 * Checks if the app is running inside a native wrapper (Capacitor) that supports widgets.
 */
export function isNativeWidgetSupported(): boolean {
    return !!(window.Capacitor?.isNativePlatform() || window.NativeWidgetBridge);
}

/**
 * Securely passes the user's current Supabase Auth Token to the native 
 * App Group container (iOS) or Shared Preferences (Android).
 * This allows the background Widget Extension to authenticate its own 
// network requests to the Supabase Edge Function without requiring the 
// user to log in separately inside the widget.
 */
export async function syncAuthTokenToWidget(): Promise<boolean> {
    if (!isNativeWidgetSupported()) return false;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            console.warn('[WidgetBridge] No active session to sync.');
            return false;
        }

        if (window.NativeWidgetBridge?.setSharedAuthToken) {
            await window.NativeWidgetBridge.setSharedAuthToken(session.access_token);
            return true;
        }

        // Fallback for Capacitor using a custom native plugin
        if (window.Capacitor?.Plugins?.WidgetPlugin) {
            await window.Capacitor.Plugins.WidgetPlugin.setAuthToken({
                token: session.access_token
            });
            return true;
        }

        return false;
    } catch (error) {
        console.error('[WidgetBridge] Failed to sync auth token:', error);
        return false;
    }
}

/**
 * Instructs the native OS to immediately reload the widget timeline.
 * This is called when the user RSVPs to a new event, ensuring the 
// homescreen widget updates instantly rather than waiting for the 
// 15-minute background refresh cycle.
 * 
 * @param widgetKind - The identifier of the widget to reload (e.g., 'EventCountdown')
 */
export function requestWidgetTimelineReload(widgetKind: string = 'EventCountdown'): void {
    if (!isNativeWidgetSupported()) return;

    try {
        if (window.NativeWidgetBridge?.reloadTimelines) {
            window.NativeWidgetBridge.reloadTimelines(widgetKind);
            console.log(`[WidgetBridge] Requested timeline reload for ${widgetKind}`);
            return;
        }

        if (window.Capacitor?.Plugins?.WidgetPlugin) {
            window.Capacitor.Plugins.WidgetPlugin.reloadTimelines({ kind: widgetKind });
            console.log(`[WidgetBridge] Requested timeline reload for ${widgetKind}`);
        }
    } catch (error) {
        console.error('[WidgetBridge] Failed to request timeline reload:', error);
    }
}

/**
 * Generates the deep link URL for a specific event.
 * Used by the native widget to open the main app directly to the event page.
 */
export function generateEventDeepLink(eventId: string): string {
    const isNative = window.Capacitor?.isNativePlatform();
    if (isNative) {
        return `campusconnect://events/${eventId}`;
    }
    // Fallback for PWA web environment
    return `${window.location.origin}/events/${eventId}`;
}
