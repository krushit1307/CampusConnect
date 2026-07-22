///<reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";
import { BackgroundSyncPlugin } from "workbox-background-sync";

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
