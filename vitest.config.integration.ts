import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest configuration specifically for Supabase integration tests.
 * These tests run against a real local Docker database spun up via the Supabase CLI.
 * They require Node environment (not jsdom) and longer timeouts for DB operations.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Only include files in the integration test directory
    include: ["supabase/tests/integration/**/*.test.ts"],
    // Global setup handles starting/stopping the Supabase Docker stack
    globalSetup: ["supabase/tests/integration/global-setup.ts"],
    // Extended timeouts to account for Docker spin-up and real DB queries
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 60000,
    globalSetupTimeout: 300000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
