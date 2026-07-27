///<reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
declare let self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST || []);

const bgSyncPlugin = new BackgroundSyncPlugin("supabase-mutations-queue", {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours (in minutes)
});

registerRoute(
  ({ url, request }) => {
    return (
      url.hostname.includes("supabase.co") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
    );
  },
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
);

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
registerRoute(({ url }) => url.hostname.includes("supabase.co"), new NetworkOnly());

// Offline fallback for full-page navigations (e.g. a hard refresh while offline).
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("offline-fallback-cache").then((cache) => cache.add(OFFLINE_URL)));
});

registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event }) => {
    try {
      return await new NetworkOnly().handle({ event, request: event.request } as never);
    } catch (error) {
      const cache = await caches.open("offline-fallback-cache");
      const cachedResponse = await cache.match(OFFLINE_URL);
      return cachedResponse || Response.error();
    }
  },
);
