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
    // Keep the 300+ file suite within a predictable CI/developer memory budget.
    // Vitest otherwise scales workers to the host CPU count, multiplying the
    // jsdom and transformed-module footprint until Node reaches its heap limit.
    pool: "vmForks",
    minWorkers: 1,
    maxWorkers: 2,
    vmMemoryLimit: "512MB",
    include: [
      "src/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}",
      "graphql/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
    ],
    exclude: ["node_modules/**", "dist/**", "e2e/**", ".github/**", "tools/**"],
  },
});
