import fs from "fs";
import path from "path";

// 1. Setup and Authentication
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
  console.error("Please add your actual PAT: GITHUB_TOKEN=your_real_token_here");
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
  "User-Agent": "CampusConnect-Update-Labels-Script",
};

// 2. Map of exact issue titles to their new single label
const issueLabelMap: Record<string, string> = {
  "Add loading skeletons for event cards on the feed page": "good-ui",
  "Create a beautiful empty state for the Club Directory": "good-ui",
  "Add toast notifications for Login/Signup errors": "good-ui",
  "Make the dashboard sidebar responsive (mobile-friendly)": "good-ui",
  'Add a "Copy Link" share button to individual event pages': "good-ui",
  "Add JSDoc comments to Supabase data fetching hooks": "good-backend",
  "Improve accessibility by adding aria-labels to all icon-only buttons": "good-ui",
  "Design a better 404 Not Found page": "good-ui",
  "Add basic frontend validation for the RSVP form": "good-ui",
  "Create a reusable date formatting utility": "good-ui",
  "Implement a Scroll-to-Top button on long feeds": "good-ui",
  "Add show/hide password toggle on login screen": "good-ui",
  "Show loading spinner while certificate is generating": "good-ui",
  "Refactor hardcoded button styles to use a unified Component": "good-ui",
  "Add Husky pre-commit hook to run linter": "good-backend",
  "Ensure contrast is accessible in Dark Mode": "good-ui",
  "Add Initials Fallback to User Avatars": "good-ui",
  "Proofread and fix typos in README and Contribution docs": "good-issue",
  "Validate environment variables on app startup": "good-backend",
  "Implement infinite scroll or pagination for events": "good-backend",
};

// 3. Helper for API Requests
async function githubRequest(endpoint: string, method: string = "GET", body?: unknown) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      ...headers,
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ GitHub API Error (${response.status}) on ${endpoint}: ${errorText}`);
    return null;
  }

  if (response.status === 204) return true;
  return await response.json();
}

// 4. Main Update Logic
async function updateIssueLabels() {
  console.log(`🚀 Starting Label Update for repo: ${GITHUB_REPO}\n`);
  console.log("⏳ Fetching all open issues...");

  // Fetch existing issues
  const existingIssues = await githubRequest("/issues?state=open&per_page=100");
  if (!existingIssues || !Array.isArray(existingIssues)) {
    console.error("Failed to fetch issues.");
    return;
  }

  console.log(`Found ${existingIssues.length} open issues. Processing updates...`);

  let updatedCount = 0;
  for (const issue of existingIssues) {
    // We only want to process standard issues, not PRs (GitHub returns PRs in the issues endpoint)
    if (issue.pull_request) continue;

    const title = issue.title.trim();
    const newLabel = issueLabelMap[title];

    if (newLabel) {
      console.log(`🔄 Updating Issue #${issue.number}: "${title}"`);
      console.log(`   -> Setting label to: [ECSoC26, ${newLabel}]`);

      const res = await githubRequest(`/issues/${issue.number}`, "PATCH", {
        labels: ["ECSoC26", newLabel], // Re-add the ECSoC26 label alongside the new one
      });

      if (res) {
        updatedCount++;
        console.log(`   ✅ Success`);
      } else {
        console.log(`   ❌ Failed`);
      }

      // Delay to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      console.log(`⏭️  Skipping Issue #${issue.number}: "${title}" (No exact match in map)`);
    }
  }

  console.log(`\n🎉 Done! Successfully updated labels on ${updatedCount} issues.`);
}

updateIssueLabels();
