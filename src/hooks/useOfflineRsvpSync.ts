import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getQueuedRsvps, removeQueuedRsvp } from '@/lib/events/offlineRsvpSync';
import { supabase } from '@/lib/supabase/client';

export function useOfflineRsvpSync() {
  useEffect(() => {
    let isFlushing = false;

    const flushQueue = async () => {
      if (isFlushing || !navigator.onLine) return;
      isFlushing = true;

      try {
        const queue = await getQueuedRsvps();
        if (queue.length === 0) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('[useOfflineRsvpSync] User not logged in, cannot sync offline RSVPs.');
          return;
        }

        for (const item of queue) {
          try {
            const { data, error } = await supabase.functions.invoke('toggle-rsvp', {
              body: {
                eventId: item.eventId,
                hasRsvpd: item.hasRsvpd,
                captchaToken: item.captchaToken,
                accommodationsRequested: item.accommodationsRequested,
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Idempotency-Key': item.idempotencyKey,
              },
            });

            if (error) {
              console.error('[useOfflineRsvpSync] Failed to sync item', item.idempotencyKey, error);
              // If it's a rate limit or server error, we leave it in the queue for later
              continue;
            }

            // Remove from queue after successful sync
            await removeQueuedRsvp(item.idempotencyKey);

            // Determine status message
            if (item.hasRsvpd) {
              toast.success('Offline RSVP cancellation synced.');
            } else if (data?.status === 'waitlisted') {
              toast.success(`Offline RSVP synced: Event full, you're on the waitlist (#${data.position}).`);
            } else {
              toast.success('Offline RSVP synced: You are attending!');
            }
          } catch (itemErr) {
            console.error('[useOfflineRsvpSync] Error syncing individual RSVP', itemErr);
          }
        }
      } catch (err) {
        console.error('[useOfflineRsvpSync] Error in flush loop', err);
      } finally {
        isFlushing = false;
      }
    };

    // 1. Flush on mount
    flushQueue();

    // 2. Flush on online event
    const handleOnline = () => flushQueue();
    window.addEventListener('online', handleOnline);

    // 3. Flush on message from Service Worker (background sync)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OFFLINE_RSVP_SYNC') {
        flushQueue();
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, []);
}
