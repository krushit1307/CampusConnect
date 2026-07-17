import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
    // Use a separate config file so vitest never loads vite.config.ts
    // and its browser-only plugin stack (Vite plugins, etc.)
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
});
