import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
});
