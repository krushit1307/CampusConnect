import { defineConfig } from "vitest/config";
import viteReact from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [viteReact()],
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
