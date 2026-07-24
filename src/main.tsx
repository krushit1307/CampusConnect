import React from "react";
import ReactDOM from "react-dom/client";
// @ts-expect-error - react-helmet-async types may not be resolved in all editor settings
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./styles.css";
import { initOfflineCache } from "./lib/cache/offlineCache";

// Start custom client-side caching layer with O(1) LRU eviction
initOfflineCache();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
);
