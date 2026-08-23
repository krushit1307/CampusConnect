// =============================================================================
// Hook: useOfflineTickets
// Issue: #2899 - Implement 'Offline Mode' Ticket Caching with Service Workers
// Description: Manages the local caching of user tickets using IndexedDB.
// Fetches upcoming tickets when online, stores them locally, and serves them 
// instantly when the device loses internet connection.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { preCacheTicket, purgeExpiredTickets, isAppOffline } from '../../lib/pwa/cacheManager';

export interface CachedTicket {
    id: string;
    event_id: string;
    event_title: string;
    event_date: string;
    event_location: string;
    qr_code_url: string;
    qr_code_data: string; // The raw string encoded in the QR
    status: 'active' | 'used' | 'expired';
}

interface UseOfflineTicketsReturn {
    tickets: CachedTicket[];
    isLoading: boolean;
    isOffline: boolean;
    error: string | null;
    refreshTickets: () => Promise<void>;
    saveTicketToCameraRoll: (ticket: CachedTicket) => Promise<void>;
}

const DB_NAME = 'CampusConnectTicketsDB';
const STORE_NAME = 'tickets';
const DB_VERSION = 1;

/**
 * Helper: Open IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Helper: Save ticket to IndexedDB
 */
async function saveTicketDB(ticket: CachedTicket): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(ticket);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Helper: Get all tickets from IndexedDB
 */
async function getTicketsDB(): Promise<CachedTicket[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Helper: Delete ticket from IndexedDB
 */
async function deleteTicketDB(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export function useOfflineTickets(): UseOfflineTicketsReturn {
    const [tickets, setTickets] = useState<CachedTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(isAppOffline());
    const [error, setError] = useState<string | null>(null);

    // Listen for network status changes
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const refreshTickets = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // If offline, just load from IndexedDB
            if (isOffline) {
                const cached = await getTicketsDB();
                setTickets(cached.filter(t => t.status === 'active'));
                setIsLoading(false);
                return;
            }

            // If online, fetch from Supabase
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setTickets([]);
                setIsLoading(false);
                return;
            }

            const { data: rsvps, error: fetchError } = await supabase
                .from('event_rsvps')
                .select(`
          id,
          event_id,
          events (
            id,
            title,
            event_date,
            location,
            end_date
          )
        `)
                .eq('user_id', user.id)
                .eq('checked_in', false)
                .gte('events.event_date', new Date().toISOString()); // Only upcoming events

            if (fetchError) throw fetchError;

            const activeTicketIds: string[] = [];
            const fetchedTickets: CachedTicket[] = [];

            for (const rsvp of (rsvps || [])) {
                const event = rsvp.events as any;
                if (!event) continue;

                // Generate QR code data (usually the RSVP ID or a signed JWT)
                const qrData = JSON.stringify({ rsvpId: rsvp.id, userId: user.id, eventId: event.id });

                // In a real app, this URL would point to a generated image in Supabase Storage
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

                const ticket: CachedTicket = {
                    id: rsvp.id,
                    event_id: event.id,
                    event_title: event.title,
                    event_date: event.event_date,
                    event_location: event.location || 'TBA',
                    qr_code_url: qrCodeUrl,
                    qr_code_data: qrData,
                    status: 'active'
                };

                fetchedTickets.push(ticket);
                activeTicketIds.push(rsvp.id);

                // Save to IndexedDB for offline access
                await saveTicketDB(ticket);

                // Proactively tell the Service Worker to cache the QR image
                await preCacheTicket(rsvp.id, qrCodeUrl, ticket);
            }

            // Purge old tickets from cache to save space
            await purgeExpiredTickets(activeTicketIds);

            setTickets(fetchedTickets);
        } catch (err: any) {
            console.error('[useOfflineTickets] Refresh failed:', err);
            setError(err.message || 'Failed to load tickets');

            // Fallback to cache on network error
            try {
                const cached = await getTicketsDB();
                setTickets(cached.filter(t => t.status === 'active'));
            } catch (dbErr) {
                console.error('[useOfflineTickets] IndexedDB fallback failed:', dbErr);
            }
        } finally {
            setIsLoading(false);
        }
    }, [isOffline]);

    useEffect(() => {
        refreshTickets();
    }, [refreshTickets]);

    /**
     * Fallback mechanism: Downloads the QR code directly to the user's device camera roll.
     * Uses HTML5 Canvas to draw the image and trigger a download.
     */
    const saveTicketToCameraRoll = async (ticket: CachedTicket) => {
        try {
            const response = await fetch(ticket.qr_code_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `ticket_${ticket.event_title.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[useOfflineTickets] Download failed:', err);
            alert('Failed to download ticket. Please try again when online.');
        }
    };

    return {
        tickets,
        isLoading,
        isOffline,
        error,
        refreshTickets,
        saveTicketToCameraRoll
    };
}
