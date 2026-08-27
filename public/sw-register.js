if ("serviceWorker" in navigator) {
  // If running locally in development, unregister any active service worker to prevent HMR / preamble caching conflicts
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      let unregisteredAny = false;
      Promise.all(
        registrations.map((registration) =>
          registration.unregister().then((success) => {
            if (success) {
              console.log("[SW] Unregistered local service worker successfully.");
              unregisteredAny = true;
            }
          }),
        ),
      ).then(() => {
        if (unregisteredAny) {
          window.location.reload();
        }
      });
    });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[SW] Registered successfully:", registration.scope);
        })
        .catch((error) => {
          console.error("[SW] Registration failed:", error);
        });
    });

    // Fallback registration in case window.load fired before this script ran
    if (!navigator.serviceWorker.controller) {
      navigator.serviceWorker.register("/sw.js");
    }
  }
}
