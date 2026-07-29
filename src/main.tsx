import { initializeTracing } from "./instrumentation";

// Initialize tracing FIRST
initializeTracing();

import React from "react";
import ReactDOM from "react-dom/client";
// @ts-expect-error - react-helmet-async types may not be resolved in all editor settings
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./styles.css";
import { initOfflineCache } from "./lib/cache/offlineCache";
import { initOfflineSync } from "./lib/offlineSync";
import { registerSW } from "virtual:pwa-register";

// Start custom client-side caching layer with O(1) LRU eviction
initOfflineCache();
// Start background sync manager for offline event creation & replay
initOfflineSync();

if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
);
