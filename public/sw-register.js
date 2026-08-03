if ("serviceWorker" in navigator) {
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