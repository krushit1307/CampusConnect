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
  "User-Agent": "CampusConnect-Create-Issues-Script",
};

// 2. Helper for API Requests
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

// 3. The 20 New Issues Payload
const newIssues = [
  {
    title: "Implement Search Bar in Club Directory",
    body: "**Description:** The Club Directory currently lists all clubs, making it hard to find a specific one as the list grows. We need a real-time search input at the top of the page that filters clubs by name or category as the user types.\n\n**Acceptance Criteria:**\n- Add a `<SearchInput />` component to `clubs.index.tsx`.\n- State should update on change and filter the `clubs` array before rendering.\n\n**Suggested Files:** `src/routes/clubs.index.tsx`",
    labels: ["ECSoC26", "good-ui"],
  },
  {
    title: "Add Hover Animations to Event Cards",
    body: "**Description:** Our event cards look a bit static. To make the interface feel more premium, we should add a subtle lift or scale animation when the user hovers over an event card on the feed.\n\n**Acceptance Criteria:**\n- Use Tailwind's `group-hover:scale-105` or similar transition classes.\n- Ensure the animation is smooth (e.g., `transition-transform duration-300`).\n\n**Suggested Files:** `src/components/EventCard.tsx`",
    labels: ["ECSoC26", "good-ui"],
  },
  {
    title: "Add Empty State for Discussion Feed",
    body: '**Description:** When a club has no discussions yet, the feed is completely blank. We need an engaging "Empty State" component that encourages users to start the conversation.\n\n**Acceptance Criteria:**\n- Create a nice illustration or use Lucide icons.\n- Display "No posts yet. Be the first to start a discussion!"\n\n**Suggested Files:** `src/routes/feed.tsx`',
    labels: ["ECSoC26", "good-ui"],
  },
  {
    title: "Create a User Profile Settings Page UI",
    body: "**Description:** Users need a place to view and update their profile details (Bio, Display Name, Profile Picture). We need to build the frontend layout for this settings page.\n\n**Acceptance Criteria:**\n- Build a form UI with inputs for Name, Bio, and an Avatar upload circle.\n- Ensure it looks good on both mobile and desktop.\n\n**Suggested Files:** `src/routes/settings.tsx`",
    labels: ["ECSoC26", "good-ui"],
  },
  {
    title: "Add Tooltips to Icon Buttons",
    body: "**Description:** Buttons that only display icons (like edit, delete, or share) can be confusing for new users. We need to wrap these buttons in a Tooltip component that reveals the button's action on hover.\n\n**Acceptance Criteria:**\n- Implement a Radix UI or custom Tooltip.\n- Apply it to at least 3 icon-only buttons across the dashboard.\n\n**Suggested Files:** `src/components/ui/tooltip.tsx`, `src/routes/dashboard.tsx`",
    labels: ["ECSoC26", "good-ui"],
  },
  {
    title: "Implement Skeleton Loader for Club Profiles",
    body: "**Description:** When navigating to a specific club's page, it takes a moment to fetch data from Supabase. We need a loading skeleton to improve perceived performance.\n\n**Acceptance Criteria:**\n- Build a skeleton that mimics the Club header and description layout.\n- Display it while `isLoading` is true.\n\n**Suggested Files:** `src/routes/clubs.$slug.tsx`",
    labels: ["ECSoC26", "good-ui"],
  },
  {
    title: "Fix Responsive Layout on Certificate View Page",
    body: "**Description:** On mobile devices, the generated event certificates overflow the screen or get cut off. We need to apply responsive CSS to scale the certificate down appropriately on small screens.\n\n**Acceptance Criteria:**\n- The certificate preview should fit entirely within the viewport width on mobile (`max-w-full`).\n\n**Suggested Files:** `src/routes/certificates.tsx`",
    labels: ["ECSoC26", "good-ui"],
  },
  {
    title: "Implement Rate Limiting on RSVP Endpoint",
    body: "**Description:** To prevent abuse, users shouldn't be able to spam the RSVP button 50 times a second. We need to add backend logic to rate limit this action.\n\n**Acceptance Criteria:**\n- Implement a debounce on the frontend.\n- Ensure the Supabase function rejects rapid, duplicate RSVP requests for the same event.\n\n**Suggested Files:** `src/routes/events.tsx`, `supabase/functions/`",
    labels: ["ECSoC26", "good-backend"],
  },
  {
    title: "Add Webhook for Post-Event Certificate Generation",
    body: "**Description:** We want to automate certificate delivery. Create a Supabase Edge Function that acts as a webhook to generate certificates for all attendees once an event's `end_time` passes.\n\n**Acceptance Criteria:**\n- Create a new Edge Function `generate-event-certs`.\n- It should query attendees and trigger the PDF generation logic.\n\n**Suggested Files:** `supabase/functions/generate-event-certs/index.ts`",
    labels: ["ECSoC26", "good-backend"],
  },
  {
    title: "Implement Club Join Request API Logic",
    body: '**Description:** Some clubs are "invite-only" or require approval. We need an API layer to handle "Join Requests" that insert a record into a `club_requests` table instead of directly adding the user as a member.\n\n**Acceptance Criteria:**\n- Write the Supabase RPC or standard insert logic for club join requests.\n\n**Suggested Files:** `src/lib/supabase/client.ts`',
    labels: ["ECSoC26", "good-backend"],
  },
  {
    title: "Add User Role Verification Middleware",
    body: "**Description:** Only users with the `club_admin` role should be able to create, edit, or delete events. We need to enforce this using Supabase Row Level Security (RLS) policies.\n\n**Acceptance Criteria:**\n- Write an RLS policy for the `events` table that checks the user's role before allowing `INSERT` or `UPDATE`.\n\n**Suggested Files:** `supabase/migrations/`",
    labels: ["ECSoC26", "good-backend"],
  },
  {
    title: "Create Supabase Edge Function for Bulk Email Notifications",
    body: "**Description:** When a club creates a major event, all members should be notified. Set up a Supabase Edge Function (using Resend or another provider) to send bulk emails to club members.\n\n**Acceptance Criteria:**\n- Function receives an event ID, queries all club members, and dispatches emails.\n\n**Suggested Files:** `supabase/functions/send-event-emails/index.ts`",
    labels: ["ECSoC26", "good-backend"],
  },
  {
    title: "Create SQL Migration for Event Categories",
    body: "**Description:** Events need to be categorized (e.g., Tech, Cultural, Sports). We need a new SQL migration to create an `event_categories` table and add a foreign key to the `events` table.\n\n**Acceptance Criteria:**\n- Provide the raw SQL migration script.\n- Include seed data for standard categories.\n\n**Suggested Files:** `supabase/migrations/002_event_categories.sql`",
    labels: ["ECSoC26", "good-backend"],
  },
  {
    title: "Add Database Triggers for Member Count",
    body: "**Description:** Querying the `club_members` table every time to get a count is slow. We should add a `member_count` integer to the `clubs` table and use a Postgres Trigger to auto-increment/decrement it.\n\n**Acceptance Criteria:**\n- Write a trigger `on_member_added` and `on_member_removed`.\n\n**Suggested Files:** `supabase/migrations/003_member_count_trigger.sql`",
    labels: ["ECSoC26", "good-backend"],
  },
  {
    title: "Optimize Query for Fetching User's Registered Events",
    body: "**Description:** The current dashboard query for fetching the events a user has RSVP'd to is unoptimized. We need to rewrite the Supabase query to efficiently join the `events` and `rsvps` tables.\n\n**Acceptance Criteria:**\n- Update the fetching logic to use a single `.select('*, rsvps!inner(*)')` call.\n\n**Suggested Files:** `src/routes/dashboard.tsx`",
    labels: ["ECSoC26", "good-backend"],
  },
  {
    title: "Implement Soft Delete for Discussion Posts",
    body: "**Description:** Instead of hard-deleting discussion posts (which breaks comment trees), we should implement soft deletes. Add a `deleted_at` timestamp column and update queries to filter them out.\n\n**Acceptance Criteria:**\n- Add `deleted_at` to the discussions table.\n- Update frontend queries to append `.is('deleted_at', null)`.\n\n**Suggested Files:** `supabase/migrations/`, `src/routes/feed.tsx`",
    labels: ["ECSoC26", "good-backend"],
  },
  {
    title: "Add Unit Tests for Date Utility Functions",
    body: "**Description:** We have critical utilities that format dates for events. We need to ensure these don't break across timezones. Add a testing framework (Vitest or Jest) and write tests for `src/lib/utils.ts`.\n\n**Acceptance Criteria:**\n- Install Vitest.\n- Write at least 3 test cases for date formatting.\n\n**Suggested Files:** `src/lib/utils.test.ts`",
    labels: ["ECSoC26", "good-pr"],
  },
  {
    title: "Add Dark Mode Toggle Button to Navbar",
    body: "**Description:** The app uses Tailwind, but users can't manually toggle between light and dark modes. Add a sun/moon toggle button to the top Navbar.\n\n**Acceptance Criteria:**\n- Create a `<ThemeToggle />` component.\n- Implement a React Context or use `next-themes` logic to toggle the `dark` class on the `<html>` element.\n\n**Suggested Files:** `src/components/site/Navbar.tsx`, `src/components/ThemeToggle.tsx`",
    labels: ["ECSoC26", "good-ui"],
  },
  {
    title: "Add Markdown Support for Discussion Posts",
    body: "**Description:** Plain text discussions are boring. Let's allow users to use markdown (bold, italics, bullet points) in their posts by integrating `react-markdown` on the feed page.\n\n**Acceptance Criteria:**\n- Parse discussion post bodies using `react-markdown`.\n- Ensure standard styling is applied to markdown elements.\n\n**Suggested Files:** `src/routes/feed.tsx`",
    labels: ["ECSoC26", "good-issue"],
  },
  {
    title: "Document API Endpoints in README",
    body: '**Description:** New contributors need to know how the Supabase database is structured. Add a section to `README.md` that clearly documents the core tables and how they relate.\n\n**Acceptance Criteria:**\n- Add an "Architecture / Database" section to the README.\n- Include an ERD or simple list of tables and columns.\n\n**Suggested Files:** `README.md`',
    labels: ["ECSoC26", "good-issue"],
  },
];

// 4. Main Creation Logic
async function createNewIssues() {
  console.log(`🚀 Starting Bulk Issue Creation for repo: ${GITHUB_REPO}\n`);

  // First fetch existing to avoid exact duplicates
  console.log("⏳ Checking existing issues to prevent duplicates...");
  const existingIssues = await githubRequest("/issues?state=all&per_page=100");
  const existingTitles = new Set((existingIssues || []).map((i: { title: string }) => i.title));

  let createdCount = 0;
  for (const issue of newIssues) {
    if (existingTitles.has(issue.title)) {
      console.log(`⏩ Skipping issue "${issue.title}" (Already exists)`);
      continue;
    }

    console.log(`➕ Creating issue: "${issue.title}"`);

    const res = await githubRequest(`/issues`, "POST", issue);

    if (res) {
      createdCount++;
      console.log(`   ✅ Success`);
    } else {
      console.log(`   ❌ Failed`);
    }

    // Delay 1.5 seconds to avoid GitHub API abuse limits
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log(`\n🎉 Done! Successfully created ${createdCount} new issues.`);
}

createNewIssues();
