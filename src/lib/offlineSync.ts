import { toast } from "sonner";
import { createClient } from "./supabase/client";

const DB_NAME = "campus-connect-offline-events";
const STORE_NAME = "pending-events";
const DB_VERSION = 1;

export interface QueuedEventPayload {
  title: string;
  description: string;
  category_id?: string | null;
  location?: string | null;
  start_date: string;
  end_date: string;
  event_date: string;
  created_by: string;
  club_id?: string | null;
  requires_approval?: boolean;
}

export interface QueuedEventItem {
  id: string;
  timestamp: number;
  payload: QueuedEventPayload;
}

/**
 * Opens or upgrades the IndexedDB database for offline event queueing.
 */

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queues an event payload into IndexedDB when offline.
 * Also attempts to register a Workbox / ServiceWorker Background Sync tag.
 */
export async function queueOfflineEvent(payload: QueuedEventPayload): Promise<string> {
  const id = `offline-evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const item: QueuedEventItem = {
    id,
    timestamp: Date.now(),
    payload,
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    console.log("[OfflineSync] Queued event in IndexedDB:", id, payload.title);

    // Request Service Worker Background Sync if supported
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ("sync" in registration) {
          await registration.sync.register("sync-offline-events");
          console.log("[OfflineSync] Registered 'sync-offline-events' background sync tag.");
        }
      } catch (err) {
        console.warn("[OfflineSync] Could not register background sync tag:", err);
      }
    }
  } catch (err) {
    console.error("[OfflineSync] Failed to store event in IndexedDB:", err);
  }

  return id;
}

/**
 * Retrieves all pending offline events from IndexedDB.
 */
export async function getPendingOfflineEvents(): Promise<QueuedEventItem[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[OfflineSync] Failed to fetch pending events from IndexedDB:", err);
    return [];
  }
}

/**
 * Deletes a queued offline event item by ID from IndexedDB.
 */
export async function clearPendingOfflineEvent(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`[OfflineSync] Failed to clear item ${id} from IndexedDB:`, err);
  }
}

/**
 * Replays all pending offline event creations against Supabase.
 * Executed when connectivity is restored or on app startup.
 */
export async function replayOfflineEvents(): Promise<{
  successCount: number;
  failedCount: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { successCount: 0, failedCount: 0 };
  }

  const items = await getPendingOfflineEvents();
  if (items.length === 0) {
    return { successCount: 0, failedCount: 0 };
  }

  console.log(`[OfflineSync] Replaying ${items.length} pending offline event(s)...`);
  const supabase = createClient();
  let successCount = 0;
  let failedCount = 0;

  for (const item of items) {
    try {
      const { error } = await supabase.from("events").insert(item.payload);

      if (error) {
        console.error(`[OfflineSync] Error syncing offline event "${item.payload.title}":`, error);
        failedCount++;
      } else {
        console.log(
          `[OfflineSync] Successfully synced offline event "${item.payload.title}" (${item.id})`,
        );
        await clearPendingOfflineEvent(item.id);
        successCount++;
      }
    } catch (err) {
      console.error(`[OfflineSync] Exception while syncing offline event (${item.id}):`, err);
      failedCount++;
    }
  }

  if (successCount > 0) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("refetchEvents"));
    }
    toast.success(
      successCount === 1
        ? "Offline event successfully synced & created!"
        : `${successCount} offline events successfully synced!`,
      { duration: 5000 },
    );
  }

  return { successCount, failedCount };
}

/**
 * Initializes the Service Worker and sets up automatic online listeners for background sync replay.
 */
export function initOfflineSync() {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          type: "module",
        });

        console.log("[OfflineSync] ServiceWorker registered with scope:", registration.scope);

        if ("sync" in registration) {
          console.log("[OfflineSync] Background Sync API is supported and active.");
        } else {
          console.log("[OfflineSync] Background Sync API not supported. Workbox fallback active.");
        }
      } catch (error) {
        console.error("[OfflineSync] ServiceWorker registration failed:", error);
      }
    });
  } else {
    console.warn("[OfflineSync] Service workers are not supported in this browser.");
  }

  // Listen for online events to automatically replay queued requests
  window.addEventListener("online", () => {
    console.log("[OfflineSync] Network status changed to online. Attempting background sync...");
    replayOfflineEvents();
  });

  // Also listen for custom message from Service Worker when a sync event fires
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "OFFLINE_EVENTS_SYNC") {
        replayOfflineEvents();
      }
    });
  }

  // If already online at startup, check for any un-synced items left over from prior sessions
  if (navigator.onLine) {
    setTimeout(() => {
      replayOfflineEvents();
    }, 2000);
  }
}
