import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const target = process.env.LOAD_TEST_TARGET;
const allowedHosts = (process.env.LOAD_TEST_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

if (process.env.LOAD_TEST_CONFIRM_STAGING !== "YES") {
  throw new Error(
    "Refusing to start: set LOAD_TEST_CONFIRM_STAGING=YES after confirming the target is staging.",
  );
}

if (!target) {
  throw new Error("LOAD_TEST_TARGET must be the HTTPS URL of the staging API.");
}

let url;
try {
  url = new URL(target);
} catch {
  throw new Error("LOAD_TEST_TARGET must be an absolute URL.");
}

if (url.protocol !== "https:") {
  throw new Error("LOAD_TEST_TARGET must use HTTPS.");
}

if (allowedHosts.length === 0 || !allowedHosts.includes(url.hostname.toLowerCase())) {
  throw new Error("Refusing to start: add the exact staging hostname to LOAD_TEST_ALLOWED_HOSTS.");
}

const reportsDirectory = resolve("load-testing", "artillery", "reports");
mkdirSync(reportsDirectory, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonReport = resolve(reportsDirectory, `load-test-${timestamp}.json`);
const htmlReport = resolve(reportsDirectory, `load-test-${timestamp}.html`);
const artillery = process.platform === "win32" ? "artillery.cmd" : "artillery";
const config = resolve("load-testing", "artillery", "load-test.yml");

const run = spawnSync(artillery, ["run", "--output", jsonReport, config], {
  stdio: "inherit",
  env: process.env,
});

if (run.error) {
  throw new Error(`Unable to run Artillery: ${run.error.message}`);
}

if (run.status !== 0) {
  process.exit(run.status ?? 1);
}

const report = spawnSync(artillery, ["report", "--output", htmlReport, jsonReport], {
  stdio: "inherit",
  env: process.env,
});

if (report.error) {
  throw new Error(`Unable to generate Artillery report: ${report.error.message}`);
}

process.exit(report.status ?? 1);
