import { execSync } from "child_process";

/**
 * Global setup script for Vitest integration tests.
 * Spins up the local Supabase stack before tests run, and tears it down after.
 *
 * Note: This requires Docker to be running and the Supabase CLI to be installed globally.
 */
export const setupTimeout = 300000;

export async function setup() {
  console.log("\n🐳 [Global Setup] Starting Supabase local stack...");
  console.log("   (This may take 1-2 minutes if Docker images need to be pulled)");

  try {
    // Start Supabase in the background, inheriting stdio so users can see progress
    execSync("supabase start", { stdio: "inherit" });
    console.log("✅ [Global Setup] Supabase started successfully.");
  } catch (error) {
    console.error("\n❌ [Global Setup] Failed to start Supabase.");
    console.error("   Please ensure Docker Desktop is running and the Supabase CLI is installed.");
    throw error;
  }
}

export async function teardown() {
  console.log("\n🛑 [Global Teardown] Stopping Supabase local stack...");
  try {
    // --no-backup prevents creating a DB dump on stop, keeping CI/CD fast
    execSync("supabase stop --no-backup", { stdio: "inherit" });
    console.log("✅ [Global Teardown] Supabase stopped successfully.");
  } catch (error) {
    console.error("❌ [Global Teardown] Failed to stop Supabase cleanly.");
    throw error;
  }
}
