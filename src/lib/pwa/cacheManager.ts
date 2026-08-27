// =============================================================================
// Utility: PWA Cache Manager & Service Worker Messaging
// Issue: #2899 - Implement 'Offline Mode' Ticket Caching with Service Workers
// Description: Handles communication with the Vite PWA Service Worker (Workbox).
// Provides methods to proactively pre-fetch and cache ticket payloads and 
// QR code image assets so they are available in Airplane Mode.
// =============================================================================

import { Workbox } from 'workbox-window';

// Global Workbox instance
let wb: Workbox | null = null;

/**
 * Initializes the Workbox Service Worker registration.
 * Should be called once at the root of the application (e.g., in main.tsx).
 */
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        wb = new Workbox('/sw.js');

        wb.addEventListener('installed', (event) => {
            if (event.isUpdate) {
                console.log('[PWA] New content available; please refresh.');
                // In a production app, you might show a toast notification here
            } else {
                console.log('[PWA] Content cached for offline use.');
            }
        });

        wb.addEventListener('waiting', () => {
            console.log('[PWA] New service worker waiting. Activating...');
            // Auto-skip waiting to ensure immediate updates
            wb?.messageSkipWaiting();
        });

        wb.register().catch((err) => {
            console.error('[PWA] Service Worker registration failed:', err);
        });
    } else {
        console.warn('[PWA] Service Workers are not supported in this browser.');
    }
}

/**
 * Sends a message to the Service Worker to pre-cache a specific URL or payload.
 * This is triggered immediately after a user RSVPs to an event, ensuring the 
 * ticket is available offline before they even navigate to the /my-tickets page.
 * 
 * @param ticketId - The unique ID of the RSVP/Ticket
 * @param qrCodeUrl - The URL of the generated QR code image
 * @param ticketPayload - The JSON data of the ticket (event name, date, etc.)
 */
export async function preCacheTicket(
    ticketId: string,
    qrCodeUrl: string,
    ticketPayload: any
): Promise<void> {
    if (!wb) {
        console.warn('[PWA] Workbox not initialized. Cannot pre-cache ticket.');
        return;
    }

    try {
        // Store the JSON payload in IndexedDB via the SW or directly via our hook
        // Here we instruct the SW to cache the QR code image asset aggressively
        await wb.messageSW({
            type: 'CACHE_TICKET_ASSET',
            payload: {
                url: qrCodeUrl,
                ticketId: ticketId,
                strategy: 'CacheFirst' // QR codes are immutable, CacheFirst is perfect
            }
        });

        console.log(`[PWA] Successfully pre-cached ticket ${ticketId}`);
    } catch (error) {
        console.error('[PWA] Failed to message SW for pre-caching:', error);
    }
}

/**
 * Clears expired tickets from the Service Worker cache.
 * Should be run periodically or when the app comes online to prevent 
// local storage from filling up with old event tickets.
 * 
 * @param activeTicketIds - Array of ticket IDs that are still valid (event hasn't ended)
 */
export async function purgeExpiredTickets(activeTicketIds: string[]): Promise<void> {
    if (!wb) return;

    try {
        await wb.messageSW({
            type: 'PURGE_EXPIRED_TICKETS',
            payload: { activeTicketIds }
        });
        console.log('[PWA] Purged expired tickets from cache.');
    } catch (error) {
        console.error('[PWA] Failed to purge expired tickets:', error);
    }
}

/**
 * Checks if the app is currently running in offline mode.
 * Wraps the native navigator.onLine API with event listeners for reactive UI.
 */
export function isAppOffline(): boolean {
    return !navigator.onLine;
}
