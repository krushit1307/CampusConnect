import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitestEntry = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const explicitFilters = process.argv.slice(2);
const batchSize = Number.parseInt(process.env.VITEST_BATCH_SIZE || "10", 10);
const batchTimeoutMs = Number.parseInt(process.env.VITEST_BATCH_TIMEOUT_MS || "60000", 10);
const testFilePattern = /\.(?:test|spec)\.(?:ts|tsx)$/;

async function collectTests(directory) {
  const entries = await readdir(path.join(projectRoot, directory), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTests(relativePath)));
    } else if (testFilePattern.test(entry.name)) {
      files.push(relativePath);
    }
  }

  return files;
}

const testFiles = explicitFilters.length
  ? explicitFilters
  : (
      await Promise.all(
        ["src", "graphql", "tests"].map(async (directory) => collectTests(directory)),
      )
    )
      .flat()
      .sort();

const batches = [];
for (let index = 0; index < testFiles.length; index += batchSize) {
  batches.push(testFiles.slice(index, index + batchSize));
}

let failed = false;
for (let index = 0; index < batches.length; index += 1) {
  console.log(`\n[test batch ${index + 1}/${batches.length}] ${batches[index].length} file(s)`);
  const result = spawnSync(
    process.execPath,
    [vitestEntry, "run", "--config", "vitest.config.ts", ...batches[index]],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
      timeout: batchTimeoutMs,
    },
  );

  if (result.signal) {
    console.error(
      `Test batch ${index + 1} terminated by ${result.signal} after ${batchTimeoutMs}ms.`,
    );
    failed = true;
    continue;
  }
  if (result.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;
