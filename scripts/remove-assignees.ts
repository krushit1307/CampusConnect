import fs from "fs";
import path from "path";

// ─── 1. Setup & Auth ──────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local file not found.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const githubTokenMatch = envContent.match(/GITHUB_TOKEN=(.*)/);
const githubRepoMatch = envContent.match(/GITHUB_REPO=(.*)/);

const GITHUB_TOKEN = githubTokenMatch ? githubTokenMatch[1].trim() : null;
const GITHUB_REPO = githubRepoMatch ? githubRepoMatch[1].trim() : null;

if (!GITHUB_TOKEN || GITHUB_TOKEN === "your_personal_access_token") {
  console.error("❌ Valid GITHUB_TOKEN not found in .env.local.");
  process.exit(1);
}
if (!GITHUB_REPO) {
  console.error("❌ GITHUB_REPO not found in .env.local.");
  process.exit(1);
}

const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;
const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
  "User-Agent": "CampusConnect-Remove-Assignees-Script",
};

// ─── 2. Helper ────────────────────────────────────────────────────────────────
async function githubRequest(endpoint: string, method: string = "GET", body?: unknown) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return true;
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ GitHub API Error (${response.status}) on ${endpoint}: ${errorText}`);
    return null;
  }
  return await response.json();
}

// ─── 3. Issue range to fix: #251 – #283 ──────────────────────────────────────
const ISSUE_START = 251;
const ISSUE_END = 283;

// ─── 4. Main Logic ────────────────────────────────────────────────────────────
async function removeAllAssignees() {
  console.log(`\n🔧 CampusConnect — Remove Assignees Script`);
  console.log(`📦 Repository: ${GITHUB_REPO}`);
  console.log(`🎯 Issues: #${ISSUE_START} → #${ISSUE_END}\n`);

  let fixedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let num = ISSUE_START; num <= ISSUE_END; num++) {
    // Fetch the issue to get current assignees
    const issue = await githubRequest(`/issues/${num}`);

    if (!issue) {
      console.log(`❌ [#${num}] Could not fetch issue.`);
      failedCount++;
      continue;
    }

    // Skip PRs (the API returns PRs in issues endpoint too)
    if (issue.pull_request) {
      console.log(`⏩ [#${num}] Skipping — this is a PR, not an issue.`);
      skippedCount++;
      continue;
    }

    const assignees: string[] = (issue.assignees || []).map((a: { login: string }) => a.login);

    if (assignees.length === 0) {
      console.log(`✅ [#${num}] No assignees — nothing to remove.`);
      skippedCount++;
      continue;
    }

    console.log(
      `🗑️  [#${num}] Removing assignees: [${assignees.join(", ")}] from "${issue.title.slice(0, 60)}..."`,
    );

    // DELETE /issues/{issue_number}/assignees
    const res = await githubRequest(`/issues/${num}/assignees`, "DELETE", {
      assignees,
    });

    if (res !== null) {
      console.log(`   ✅ Done — issue #${num} is now unassigned.`);
      fixedCount++;
    } else {
      console.log(`   ❌ Failed to remove assignees from #${num}.`);
      failedCount++;
    }

    // Respect GitHub secondary rate limit
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`\n${"─".repeat(55)}`);
  console.log(`🎉 Finished!`);
  console.log(`   🗑️  Unassigned : ${fixedCount} issues`);
  console.log(`   ⏩ Skipped    : ${skippedCount} issues`);
  console.log(`   ❌ Failed     : ${failedCount} issues`);
  console.log(`${"─".repeat(55)}\n`);
}

removeAllAssignees();
