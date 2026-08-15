import { get, set } from 'idb-keyval';

export interface QueuedRsvp {
  eventId: string;
  hasRsvpd: boolean;
  captchaToken?: string;
  accommodationsRequested?: string | null;
  idempotencyKey: string;
  queuedAt: number;
}

const OUTBOX_KEY = 'rsvp_outbox';

export async function getQueuedRsvps(): Promise<QueuedRsvp[]> {
  try {
    const queue = await get<QueuedRsvp[]>(OUTBOX_KEY);
    return queue || [];
  } catch (error) {
    console.error('[OfflineRsvpSync] Failed to get queued RSVPs', error);
    return [];
  }
}

export async function queueRsvpSubmission(payload: QueuedRsvp): Promise<void> {
  try {
    const queue = await getQueuedRsvps();
    
    // Prevent duplicate entries for the same event and action
    const existingIndex = queue.findIndex(q => q.eventId === payload.eventId && q.hasRsvpd === payload.hasRsvpd);
    if (existingIndex > -1) {
      queue[existingIndex] = payload;
    } else {
      queue.push(payload);
    }
    
    await set(OUTBOX_KEY, queue);
    
    // Attempt to register Background Sync for the Service Worker
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('sync-offline-rsvps');
      } catch (err) {
        console.warn('[OfflineRsvpSync] Background sync could not be registered', err);
      }
    }
  } catch (error) {
    console.error('[OfflineRsvpSync] Failed to queue RSVP', error);
  }
}

export async function removeQueuedRsvp(idempotencyKey: string): Promise<void> {
  try {
    const queue = await getQueuedRsvps();
    const newQueue = queue.filter(q => q.idempotencyKey !== idempotencyKey);
    await set(OUTBOX_KEY, newQueue);
  } catch (error) {
    console.error('[OfflineRsvpSync] Failed to remove queued RSVP', error);
  }
}
