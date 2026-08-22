// =============================================================================
// Lib: kioskOfflineSync
// Issue: #3319 - Dynamic Offline Sync for Kiosk Mode
// Description: Offline-first storage for the Check-in Kiosk. Downloads the
// full RSVP list for an event into IndexedDB before scanning starts, serves
// every scan from that local cache (never Supabase), and queues check-ins in
// a 'sync_queue' store that gets flushed to Supabase once connectivity
// returns (triggered by the browser's online event and by this app's
// Service Worker's "OFFLINE_RSVP_SYNC" background-sync message).
// =============================================================================

import { createClient } from "./supabase/client";

const DB_NAME = "campus-connect-kiosk-offline";
const DB_VERSION = 1;
const RSVP_STORE = "rsvps";
const QUEUE_STORE = "sync_queue";

export interface LocalRsvpRecord {
  id: string;
  event_id: string;
  user_id: string;
  full_name: string;
  checked_in: boolean;
}

export interface QueuedCheckIn {
  id: string;
  rsvpId: string;
  eventId: string;
  scannedAt: number;
}

function openKioskDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RSVP_STORE)) {
        const store = db.createObjectStore(RSVP_STORE, { keyPath: "id" });
        store.createIndex("event_id", "event_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fetches every RSVP for the event from Supabase and caches it in IndexedDB
 * so the kiosk can validate scans even with zero connectivity.
 */
export async function downloadRsvpsForOfflineUse(eventId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_rsvps")
    .select("id, event_id, user_id, checked_in, profiles:user_id(full_name)")
    .eq("event_id", eventId);

  if (error || !data) {
    console.error("[kioskOfflineSync] Failed to download RSVPs:", error);
    return 0;
  }

  const db = await openKioskDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RSVP_STORE, "readwrite");
    const store = tx.objectStore(RSVP_STORE);
    for (const rsvp of data) {
      store.put({
        id: rsvp.id,
        event_id: rsvp.event_id,
        user_id: rsvp.user_id,
        full_name: (rsvp.profiles as any)?.full_name || "Attendee",
        checked_in: rsvp.checked_in,
      } as LocalRsvpRecord);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return data.length;
}

/**
 * Looks up a scanned RSVP in the local IndexedDB cache. Never hits Supabase.
 */
export async function findLocalRsvp(
  eventId: string,
  rsvpId: string,
): Promise<LocalRsvpRecord | null> {
  const db = await openKioskDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RSVP_STORE, "readonly");
    const req = tx.objectStore(RSVP_STORE).get(rsvpId);

    req.onsuccess = () => {
      const record = req.result as LocalRsvpRecord | undefined;
      resolve(record && record.event_id === eventId ? record : null);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Marks the cached RSVP as attended locally and enqueues the scan for sync.
 */
export async function markLocalRsvpAttended(rsvp: LocalRsvpRecord): Promise<void> {
  const db = await openKioskDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([RSVP_STORE, QUEUE_STORE], "readwrite");

    tx.objectStore(RSVP_STORE).put({ ...rsvp, checked_in: true });

    const queueItem: QueuedCheckIn = {
      id: `checkin-${rsvp.id}-${Date.now()}`,
      rsvpId: rsvp.id,
      eventId: rsvp.event_id,
      scannedAt: Date.now(),
    };
    tx.objectStore(QUEUE_STORE).put(queueItem);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedCheckIns(): Promise<QueuedCheckIn[]> {
  const db = await openKioskDatabase();
  return new Promise((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, "readonly").objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function clearQueuedCheckIn(id: string): Promise<void> {
  const db = await openKioskDatabase();
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, "readwrite").objectStore(QUEUE_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Flushes the local sync_queue: bulk-updates Supabase with every scan that
 * happened while offline, then clears each item once confirmed synced.
 */
export async function flushKioskSyncQueue(): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0 };
  }

  const queued = await getQueuedCheckIns();
  if (queued.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  const supabase = createClient();
  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queued) {
    try {
      const { error } = await supabase
        .from("event_rsvps")
        .update({ checked_in: true })
        .eq("id", item.rsvpId);

      if (error) throw error;

      await clearQueuedCheckIn(item.id);
      syncedCount += 1;
    } catch (err) {
      console.error(`[kioskOfflineSync] Failed to sync check-in ${item.id}:`, err);
      failedCount += 1;
    }
  }

  return { syncedCount, failedCount };
}