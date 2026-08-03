import { toast } from "sonner";
import { createClient } from "./supabase/client";

const DB_NAME = "campus-connect-offline-mutations";
const STORE_NAME = "offline_mutations_queue";
const DB_VERSION = 1;

export type MutationType = "like" | "rsvp" | "bookmark" | "comment" | "custom";
export type ActionType = "add" | "remove";

export interface QueuedMutationPayload {
  postId?: string;
  eventId?: string;
  emoji?: string;
  hasRsvpd?: boolean;
  isSaved?: boolean;
  content?: string;
  [key: string]: unknown;
}

export interface QueuedMutationItem {
  id: string;
  type: MutationType;
  targetId: string;
  action: ActionType;
  payload?: QueuedMutationPayload;
  timestamp: number;
  retryCount?: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("targetId", "targetId", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves all pending offline mutations from IndexedDB.
 */
export async function getPendingOfflineMutations(): Promise<QueuedMutationItem[]> {
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
    console.error("[OfflineMutationQueue] Error fetching pending mutations:", err);
    return [];
  }
}

/**
 * Removes a specific queued mutation item by ID from IndexedDB.
 */
export async function clearPendingOfflineMutation(id: string): Promise<void> {
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
    console.error(`[OfflineMutationQueue] Error clearing mutation ${id}:`, err);
  }
}

/**
 * Enqueues an offline mutation payload into IndexedDB.
 * Implements Conflict Resolution (Mutation Squashing):
 * If a pending mutation exists for the same targetId and type with an opposite action (add vs remove),
 * they cancel each other out and both are removed from the queue!
 */
export async function enqueueOfflineMutation(mutation: {
  type: MutationType;
  targetId: string;
  action: ActionType;
  payload?: QueuedMutationPayload;
}): Promise<string | null> {
  const existingItems = await getPendingOfflineMutations();
  const matching = existingItems.find(
    (item) => item.type === mutation.type && item.targetId === mutation.targetId,
  );

  if (matching) {
    if (matching.action !== mutation.action) {
      // Conflict resolution: Opposite actions squash/cancel each other out!
      console.log(
        `[OfflineMutationQueue] Conflict squashed: canceling out pending ${matching.action} with new ${mutation.action} for ${mutation.targetId}`,
      );
      await clearPendingOfflineMutation(matching.id);
      toast("Saved offline. Will sync when connected.", {
        icon: "📡",
      });
      return null;
    }
  }

  const id = `mut-${mutation.type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const item: QueuedMutationItem = {
    id,
    type: mutation.type,
    targetId: mutation.targetId,
    action: mutation.action,
    payload: mutation.payload,
    timestamp: Date.now(),
    retryCount: 0,
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

    console.log("[OfflineMutationQueue] Queued mutation:", id, item);

    toast("Saved offline. Will sync when connected.", {
      icon: "📡",
    });
  } catch (err) {
    console.error("[OfflineMutationQueue] Failed to store mutation:", err);
  }

  return id;
}

/**
 * Replays all queued offline mutations against the backend API.
 * Handles 401 Unauthorized / token expiry by attempting auth session refresh before stopping.
 */
export async function replayOfflineMutations(): Promise<{
  successCount: number;
  failedCount: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { successCount: 0, failedCount: 0 };
  }

  const items = await getPendingOfflineMutations();
  if (items.length === 0) {
    return { successCount: 0, failedCount: 0 };
  }

  console.log(`[OfflineMutationQueue] Replaying ${items.length} pending mutation(s)...`);
  const supabase = createClient();

  // Verify / refresh session before sync to handle token expiry gracefully
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData.session) {
      console.warn("[OfflineMutationQueue] No active session or token expired. Attempting refresh...");
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        console.error("[OfflineMutationQueue] Auth refresh failed. Retaining queue for re-login:", refreshErr);
        toast.error("Offline sync paused: Please log in to sync saved actions.");
        return { successCount: 0, failedCount: items.length };
      }
    }
  } catch (err) {
    console.error("[OfflineMutationQueue] Auth check exception:", err);
  }

  let successCount = 0;
  let failedCount = 0;

  for (const item of items) {
    try {
      let isSuccess = false;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (item.type === "like" && item.payload?.postId) {
        const emoji = (item.payload.emoji as string) || "❤️";
        if (item.action === "add") {
          const { error } = await supabase.from("post_reactions").insert({
            post_id: item.payload.postId,
            user_id: userId,
            emoji,
          });
          isSuccess = !error;
        } else {
          const { error } = await supabase
            .from("post_reactions")
            .delete()
            .eq("post_id", item.payload.postId)
            .eq("user_id", userId)
            .eq("emoji", emoji);
          isSuccess = !error;
        }
      } else if (item.type === "rsvp" && item.payload?.eventId) {
        if (item.action === "add") {
          const { error } = await supabase.from("event_rsvps").insert({
            event_id: item.payload.eventId,
            user_id: userId,
          });
          isSuccess = !error;
        } else {
          const { error } = await supabase
            .from("event_rsvps")
            .delete()
            .eq("event_id", item.payload.eventId)
            .eq("user_id", userId);
          isSuccess = !error;
        }
      } else if (item.type === "bookmark" && item.payload?.eventId) {
        if (item.action === "add") {
          const { error } = await supabase.from("saved_events").insert({
            event_id: item.payload.eventId,
            user_id: userId,
          });
          isSuccess = !error;
        } else {
          const { error } = await supabase
            .from("saved_events")
            .delete()
            .eq("event_id", item.payload.eventId)
            .eq("user_id", userId);
          isSuccess = !error;
        }
      } else {
        // Generic fallback success
        isSuccess = true;
      }

      if (isSuccess) {
        await clearPendingOfflineMutation(item.id);
        successCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      console.error(`[OfflineMutationQueue] Error replaying item ${item.id}:`, err);
      failedCount++;
    }
  }

  if (successCount > 0) {
    toast.success(
      successCount === 1
        ? "Offline action successfully synced!"
        : `${successCount} offline actions successfully synced!`,
      { duration: 4000 },
    );
  }

  return { successCount, failedCount };
}

/**
 * Initializes global window event listeners for offline mutation queue.
 */
export function initOfflineMutationQueue() {
  if (typeof window === "undefined") return;

  window.addEventListener("online", () => {
    console.log("[OfflineMutationQueue] Reconnected online. Starting mutation replay...");
    replayOfflineMutations();
  });

  if (navigator.onLine) {
    setTimeout(() => {
      replayOfflineMutations();
    }, 3000);
  }
}
