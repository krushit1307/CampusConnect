///<reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST || []);

// ── Workbox Background Sync Plugin for RSVP Mutations ──
const rsvpBgSyncPlugin = new BackgroundSyncPlugin("rsvp-mutations-queue", {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours (in minutes)
  onSync: async (options) => {
    try {
      await options.queue.replayRequests();
      console.log("[SW] RSVP Workbox Background Sync completed replaying queued requests.");

      // Broadcast success message to open tabs
      const clients = await self.clients.matchAll();
      for (const client of clients) {
        client.postMessage({ type: "OFFLINE_RSVP_SYNC_SUCCESS" });
        client.postMessage({ type: "OFFLINE_EVENTS_SYNC" });
      }
    } catch (err) {
      console.error("[SW] RSVP Workbox Background Sync replay failed:", err);
      const clients = await self.clients.matchAll();
      for (const client of clients) {
        client.postMessage({
          type: "OFFLINE_RSVP_SYNC_ERROR",
          reason:
            err instanceof Error ? err.message : "Sync failed due to conflict or full capacity",
        });
      }
    }
  },
});

// Intercept RSVP mutation endpoint (/toggle-rsvp or /event_rsvps)
registerRoute(
  ({ url, request }) => {
    const isRsvpEndpoint =
      url.pathname.includes("/toggle-rsvp") || url.pathname.includes("/event_rsvps");
    const isMutationMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
    return isRsvpEndpoint && isMutationMethod;
  },
  new NetworkOnly({
    plugins: [rsvpBgSyncPlugin],
  }),
);

// ── Workbox Background Sync Plugin for Supabase Mutations ──
// Intercepts failed POST/PUT/PATCH/DELETE requests (e.g. to /rest/v1/events)
// and queues them in IndexedDB for automatic background replay when online.
const bgSyncPlugin = new BackgroundSyncPlugin("supabase-mutations-queue", {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours (in minutes)
  onSync: async (options) => {
    try {
      await options.queue.replayRequests();
      console.log("[SW] Workbox Background Sync completed replaying queued requests.");

      // Broadcast message to all open tabs so client app can refresh UI
      const clients = await self.clients.matchAll();
      for (const client of clients) {
        client.postMessage({ type: "OFFLINE_EVENTS_SYNC" });
      }
    } catch (err) {
      console.error("[SW] Workbox Background Sync replay failed:", err);
    }
  },
});

// Intercept all other Supabase mutation endpoints (POST, PUT, PATCH, DELETE)
registerRoute(
  ({ url, request }) => {
    const isRsvpEndpoint =
      url.pathname.includes("/toggle-rsvp") || url.pathname.includes("/event_rsvps");
    if (isRsvpEndpoint) return false;

    const isSupabaseMutation =
      url.hostname.includes("supabase.co") ||
      url.pathname.includes("/rest/v1/") ||
      url.pathname.includes("/functions/v1/");
    const isMutationMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
    return isSupabaseMutation && isMutationMethod;
  },
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
);

// Listen for custom background sync event tag 'sync-offline-events'
self.addEventListener("sync" as never, (event: unknown) => {
  const syncEvent = event as { tag: string; waitUntil: (p: Promise<unknown>) => void };
  if (syncEvent.tag === "sync-offline-events" || syncEvent.tag === "supabase-mutations-queue") {
    console.log("[SW] Received background sync event tag:", syncEvent.tag);
    syncEvent.waitUntil(
      self.clients.matchAll().then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "OFFLINE_EVENTS_SYNC" });
        }
      }),
    );
  }
});

// Static assets (JS/CSS/Fonts) — serve from cache instantly, refresh in background.
registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font",
  new StaleWhileRevalidate({
    cacheName: "static-assets-cache",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

// All other Supabase API calls (GET requests) — always go to network, never cache.
registerRoute(
  ({ url }) => url.hostname.includes("supabase.co") || url.pathname.includes("/rest/v1/"),
  new NetworkOnly(),
);

// Offline fallback for full-page navigations (e.g. a hard refresh while offline).
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("offline-fallback-cache").then((cache) => cache.add(OFFLINE_URL)));
});

registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event, request }) => {
    try {
      return await new NetworkOnly().handle({ event, request });
    } catch {
      const cache = await caches.open("offline-fallback-cache");
      const cachedResponse = await cache.match(OFFLINE_URL);
      return cachedResponse || Response.error();
    }
  },
);
