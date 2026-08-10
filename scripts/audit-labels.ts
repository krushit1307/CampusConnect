import fs from "fs";
import path from "path";

// Types
interface GitHubLabel {
  id: number;
  name: string;
  color?: string;
  description?: string | null;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  labels: (string | GitHubLabel)[];
  pull_request?: unknown;
}

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

const headers: Record<string, string> = {
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "CampusConnect-Audit-Labels-Script",
};

if (GITHUB_TOKEN && !GITHUB_TOKEN.includes("placeholder")) {
  headers["Authorization"] = `token ${GITHUB_TOKEN}`;
}

// Helper for API Requests
async function githubRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown,
): Promise<T | null> {
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

  if (response.status === 204) return true as unknown as T;
  return (await response.json()) as T;
}

// Fetch all repository labels (paginated)
async function fetchAllLabels(): Promise<GitHubLabel[]> {
  const allLabels: GitHubLabel[] = [];
  let page = 1;

  while (true) {
    const labels = await githubRequest<GitHubLabel[]>(`/labels?per_page=100&page=${page}`);
    if (!labels || !Array.isArray(labels) || labels.length === 0) {
      break;
    }
    allLabels.push(...labels);
    if (labels.length < 100) break;
    page++;
  }

  return allLabels;
}

// Fetch all repository issues (paginated)
async function fetchAllIssues(): Promise<GitHubIssue[]> {
  const allIssues: GitHubIssue[] = [];
  let page = 1;

  while (true) {
    const issues = await githubRequest<GitHubIssue[]>(
      `/issues?state=all&per_page=100&page=${page}`,
    );
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      break;
    }
    for (const issue of issues) {
      if (!issue.pull_request) {
        allIssues.push(issue);
      }
    }
    if (issues.length < 100) break;
    page++;
  }

  return allIssues;
}

// Main Audit Logic
async function auditLabels() {
  console.log("🚀 Starting Label Audit...\n");

  console.log("✔ Loading configuration");

  console.log("✔ Fetching repository labels");
  const labels = await fetchAllLabels();

  console.log("✔ Fetching issues");
  const issues = await fetchAllIssues();

  console.log("✔ Calculating usage");
  const labelUsage: Record<string, number> = {};

  // Initialize every repo label with zero
  for (const label of labels) {
    labelUsage[label.name] = 0;
  }

  // Count usage across all non-PR issues
  for (const issue of issues) {
    if (Array.isArray(issue.labels)) {
      for (const item of issue.labels) {
        const labelName = typeof item === "string" ? item : item.name;
        if (labelName) {
          if (labelUsage[labelName] !== undefined) {
            labelUsage[labelName]++;
          } else {
            labelUsage[labelName] = 1;
          }
        }
      }
    }
  }

  console.log("✔ Detecting unused labels");
  const unusedLabels = Object.keys(labelUsage).filter((name) => labelUsage[name] === 0);

  console.log("✔ Detecting duplicate labels");
  // Case-insensitive duplicate check
  const lowerMap: Record<string, string[]> = {};
  for (const labelName of Object.keys(labelUsage)) {
    const lower = labelName.toLowerCase();
    if (!lowerMap[lower]) {
      lowerMap[lower] = [];
    }
    lowerMap[lower].push(labelName);
  }

  const potentialDuplicates: string[][] = [];
  for (const group of Object.values(lowerMap)) {
    if (group.length > 1) {
      potentialDuplicates.push(group);
    }
  }

  console.log("✔ Generating Markdown report");

  // Format date: YYYY-MM-DD
  const auditDate = new Date().toISOString().split("T")[0];

  const totalLabels = labels.length;
  const totalIssues = issues.length;
  const unusedCount = unusedLabels.length;

  let totalDuplicateCount = 0;
  for (const group of potentialDuplicates) {
    totalDuplicateCount += group.length;
  }

  // Sort labels alphabetically for usage table
  const sortedLabelNames = Object.keys(labelUsage).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  let usageTableMarkdown = "| Label | Usage Count |\n| --- | --- |\n";
  for (const name of sortedLabelNames) {
    usageTableMarkdown += `| ${name} | ${labelUsage[name]} |\n`;
  }

  let unusedLabelsMarkdown = "";
  if (unusedLabels.length === 0) {
    unusedLabelsMarkdown = "No unused labels found.";
  } else {
    unusedLabelsMarkdown = unusedLabels.map((name) => `- ${name}`).join("\n");
  }

  let duplicateLabelsMarkdown = "";
  if (potentialDuplicates.length === 0) {
    duplicateLabelsMarkdown = "No potential duplicate labels found.";
  } else {
    duplicateLabelsMarkdown = potentialDuplicates
      .map((group) => `- Potential duplicate group: ${group.join(", ")}`)
      .join("\n");
  }

  const reportContent = `# Repository Label Audit Report

## Summary

- Repository: ${GITHUB_REPO}
- Audit Date: ${auditDate}
- Total Labels: ${totalLabels}
- Total Issues: ${totalIssues}
- Unused Labels: ${unusedCount}
- Potential Duplicate Labels: ${totalDuplicateCount}

---

## Label Usage

${usageTableMarkdown.trim()}

---

## Unused Labels

${unusedLabelsMarkdown}

---

## Potential Duplicate Labels

${duplicateLabelsMarkdown}

---

Generated automatically by scripts/audit-labels.ts
`;

  const reportPath = path.resolve(process.cwd(), "label-audit-report.md");
  fs.writeFileSync(reportPath, reportContent, "utf-8");

  console.log("✔ Saved label-audit-report.md");
  console.log("\n🎉 Label audit completed successfully.");
}

auditLabels();
