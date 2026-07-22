export function initOfflineSync() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        // Register the Service Worker (assuming Vite outputs it to /sw.js)
        const registration = await navigator.serviceWorker.register("/sw.js", {
          type: "module",
        });

        console.log("[OfflineSync] ServiceWorker registered with scope:", registration.scope);

        // Optional: Verify Background Sync API support for debugging
        if ("sync" in registration) {
          console.log("[OfflineSync] Background Sync API is supported and active.");
        } else {
          console.log(
            "[OfflineSync] Background Sync API not supported. Workbox will fallback to syncing on next startup.",
          );
        }
      } catch (error) {
        console.error("[OfflineSync] ServiceWorker registration failed:", error);
      }
    });
  } else {
    console.warn("[OfflineSync] Service workers are not supported in this browser.");
  }
}
