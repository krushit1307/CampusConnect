import { defineConfig } from "vitest/config";
import viteReact from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "node:url";

const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
    include: [
      "src/**/*.test.{ts,tsx}",
      "graphql/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
    ],
    exclude: ["node_modules/**", "dist/**", "e2e/**", ".github/**", "tools/**"],
  },
});
