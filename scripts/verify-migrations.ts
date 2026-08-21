import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

type DbVersionRow = {
  migration_name: string;
  executed_at: string | null;
};

type VerificationResult = {
  migrationDirectory: string;
  localMigrations: string[];
  appliedMigrations: string[];
  missingMigrations: string[];
  extraDbVersions: string[];
};

const MIGRATION_FILE_PATTERN = /^[0-9][A-Za-z0-9_-]*\.sql$/;

function getEnv(name: string, fallbackName?: string): string | undefined {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

export function getMigrationDirectory(rootDir = process.cwd()): string {
  return path.join(rootDir, "supabase", "migrations");
}

export function listLocalMigrationFiles(migrationDirectory = getMigrationDirectory()): string[] {
  if (!existsSync(migrationDirectory)) {
    throw new Error(`Migration directory not found: ${migrationDirectory}`);
  }

  return readdirSync(migrationDirectory)
    .filter((fileName) => MIGRATION_FILE_PATTERN.test(fileName))
    .sort((left, right) => left.localeCompare(right));
}

export function diffMigrations(localMigrations: string[], appliedMigrations: string[]) {
  const applied = new Set(appliedMigrations);
  const local = new Set(localMigrations);

  return {
    missingMigrations: localMigrations.filter((migration) => !applied.has(migration)),
    extraDbVersions: appliedMigrations.filter((migration) => !local.has(migration)),
  };
}

export async function fetchAppliedMigrationNames() {
  const supabaseUrl = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or VITE_SUPABASE_URL is required to verify migrations.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to read public.db_versions safely.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase
    .from("db_versions")
    .select("migration_name, executed_at")
    .order("migration_name", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to read public.db_versions. Run the db_versioning migration first. ${error.message}`,
    );
  }

  return ((data ?? []) as DbVersionRow[]).map((row) => row.migration_name).sort();
}

export async function verifyMigrations(rootDir = process.cwd()): Promise<VerificationResult> {
  const migrationDirectory = getMigrationDirectory(rootDir);
  const localMigrations = listLocalMigrationFiles(migrationDirectory);
  const appliedMigrations = await fetchAppliedMigrationNames();
  const { missingMigrations, extraDbVersions } = diffMigrations(localMigrations, appliedMigrations);

  return {
    migrationDirectory,
    localMigrations,
    appliedMigrations,
    missingMigrations,
    extraDbVersions,
  };
}

export function printVerificationResult(result: VerificationResult): void {
  console.log("\nDatabase migration parity check");
  console.log("================================");
  console.log(`Migration directory: ${result.migrationDirectory}`);
  console.log(`Local migration files: ${result.localMigrations.length}`);
  console.log(`Rows in public.db_versions: ${result.appliedMigrations.length}`);

  if (result.missingMigrations.length > 0) {
    console.error("\nMissing migrations in public.db_versions:");
    for (const migration of result.missingMigrations) {
      console.error(`  - ${migration}`);
    }
  }

  if (result.extraDbVersions.length > 0) {
    console.warn("\nRows in public.db_versions with no matching local file:");
    for (const migration of result.extraDbVersions) {
      console.warn(`  - ${migration}`);
    }
  }

  if (result.missingMigrations.length === 0) {
    console.log("\n✅ All local Supabase migrations are recorded in public.db_versions.");
  }
}

async function main() {
  try {
    const result = await verifyMigrations();
    printVerificationResult(result);

    if (result.missingMigrations.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("\n❌ Migration verification failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
