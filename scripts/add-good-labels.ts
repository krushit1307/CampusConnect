import fs from "fs";
import path from "path";

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

const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "CampusConnect-Issues-Script",
};

async function githubRequest(endpoint: string, method: string = "GET", body?: unknown) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      ...headers,
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) return null;
  if (response.status === 204) return true;
  return await response.json();
}

// Issue numbers range from 693 to 724
const issueNumbers = Array.from({ length: 32 }, (_, i) => 693 + i);

const backendKeywords = ["oauth", "real-time", "email verification"];
const prKeywords = ["prettier", "eslint", "tailwind config"];
const issueKeywords = ["cypress", "seo", "date/time formatter", "vercel analytics"];

function determineLabel(title: string) {
  const lowerTitle = title.toLowerCase();
  
  if (backendKeywords.some(kw => lowerTitle.includes(kw))) return "good-backend";
  if (prKeywords.some(kw => lowerTitle.includes(kw))) return "good-pr";
  if (issueKeywords.some(kw => lowerTitle.includes(kw))) return "good-issue";
  
  return "good-ui";
}

async function addLabels() {
  console.log(`⏳ Updating 32 issues with specific labels...`);
  let count = 0;

  for (const num of issueNumbers) {
    const issue = await githubRequest(`/issues/${num}`);
    if (issue) {
      const currentLabels = issue.labels.map((l: any) => l.name);
      const labelToAdd = determineLabel(issue.title);
      
      // Ensure we haven't already added one of the four
      const fourLabels = ["good-issue", "good-pr", "good-ui", "good-backend"];
      const hasOneOfFour = currentLabels.some((l: string) => fourLabels.includes(l));
      
      if (!hasOneOfFour) {
        currentLabels.push(labelToAdd);
        await githubRequest(`/issues/${num}`, "PATCH", { labels: currentLabels });
        console.log(`✅ [Issue #${num}] Added '${labelToAdd}'`);
        count++;
      } else {
        console.log(`⏩ [Issue #${num}] Already has one of the target labels.`);
      }
    } else {
      console.log(`❌ Failed to fetch issue #${num}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\\n🎉 Successfully added labels to ${count} issues!`);
}

addLabels();
