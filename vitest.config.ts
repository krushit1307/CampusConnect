import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  test: {
    environment: "node",
    // Use a separate config file so vitest never loads vite.config.ts
    // and its browser-only plugin stack (@tanstack/react-start, etc.)
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
});
