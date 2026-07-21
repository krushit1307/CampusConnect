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

const mixedIssues = [
  {
    title: "Implement Dark Mode Toggle and Persistence in Local Storage",
    body: "## 📋 Summary\nAdd a site-wide dark mode toggle that persists the user's preference using `localStorage` and respects the OS-level `prefers-color-scheme` media query.\n\n## 🎯 Background\nUsers often browse late at night. Dark mode improves accessibility and reduces eye strain.\n\n## ✅ Acceptance Criteria\n- [ ] Create a `ThemeToggle` button in the navbar.\n- [ ] Use `next-themes` or custom React Context to manage `light`, `dark`, and `system` states.\n- [ ] Ensure Tailwind's `dark:` classes are applied globally at the `<html>` root.\n\n## 🗂️ Files to Modify\n- `src/components/ThemeToggle.tsx`\n- `src/App.tsx` or Root Layout",
    labels: ["ECSoC26", "enhancement", "ui"]
  },
  {
    title: "Create Custom 404 Error Page with 'Go to Dashboard' Action",
    body: "## 📋 Summary\nInstead of a blank white screen, provide a branded 404 Not Found page featuring a playful illustration and quick links back to the main app areas.\n\n## 🎯 Background\nBroken links happen. A good 404 page retains users who would otherwise leave the site.\n\n## ✅ Acceptance Criteria\n- [ ] Design a 404 page matching the CampusConnect branding.\n- [ ] Add a prominent 'Return to Dashboard' button.\n- [ ] Catch unmapped React Router paths and render this component.\n\n## 🗂️ Files to Modify\n- `src/pages/NotFound.tsx`\n- `src/App.tsx` (Routing)",
    labels: ["ECSoC26", "ui", "good-first-issue"]
  },
  {
    title: "Add 'Pull to Refresh' gesture support for mobile feed",
    body: "## 📋 Summary\nImplement a pull-to-refresh mobile gesture on the discussion feed and event lists, ensuring a native app-like experience for smartphone users.\n\n## 🎯 Background\nCurrently, users must hard-refresh the browser on mobile to see new posts.\n\n## ✅ Acceptance Criteria\n- [ ] Integrate a pull-to-refresh library or custom touch event handler.\n- [ ] Show a loading spinner during the refresh cycle.\n- [ ] Trigger the Supabase fetch functions upon release.\n\n## 🗂️ Files to Modify\n- `src/components/FeedList.tsx`\n- `src/components/EventDirectory.tsx`",
    labels: ["ECSoC26", "enhancement", "mobile"]
  },
  {
    title: "Implement Skeleton Loaders for the Club Directory Page",
    body: "## 📋 Summary\nReplace static loading text with animated Skeleton UI components while fetching clubs from the database, preventing layout shift.\n\n## 🎯 Background\nThe club directory currently renders nothing or a simple string while waiting for the network request.\n\n## ✅ Acceptance Criteria\n- [ ] Build a reusable `ClubCardSkeleton` component.\n- [ ] Display a grid of 6 skeleton cards while `isLoading` is true.\n- [ ] Swap them out seamlessly when data arrives.\n\n## 🗂️ Files to Modify\n- `src/components/ui/Skeleton.tsx`\n- `src/pages/ClubsDirectory.tsx`",
    labels: ["ECSoC26", "ui", "performance"]
  },
  {
    title: "Add Image Cropping functionality before uploading Club Avatars",
    body: "## 📋 Summary\nIntegrate an image cropper modal so club admins can crop their logos to a perfect 1:1 square before uploading them to Supabase Storage.\n\n## 🎯 Background\nUsers currently upload rectangles which get squished or cut off unpredictably via CSS `object-cover`.\n\n## ✅ Acceptance Criteria\n- [ ] Add `react-image-crop` or `react-easy-crop` dependency.\n- [ ] Intercept file selection, open a modal to crop the image.\n- [ ] Generate the cropped blob and upload that to storage instead of the raw file.\n\n## 🗂️ Files to Modify\n- `src/components/ImageUploader.tsx`",
    labels: ["ECSoC26", "enhancement", "ui"]
  },
  {
    title: "Build a Notification Dropdown with 'Mark all as read' feature",
    body: "## 📋 Summary\nImplement a bell icon dropdown in the navigation bar that displays the 5 most recent notifications and allows users to clear them.\n\n## 🎯 Background\nThe database already tracks notifications, but there is no unified UI for students to see them globally.\n\n## ✅ Acceptance Criteria\n- [ ] Create a `NotificationDropdown` component using Radix UI Popover.\n- [ ] Fetch notifications for `auth.uid()`.\n- [ ] Add a 'Mark all as read' button that executes a batch update in Supabase.\n\n## 🗂️ Files to Modify\n- `src/components/Navigation/NotificationBell.tsx`",
    labels: ["ECSoC26", "ui", "feature"]
  },
  {
    title: "Implement OAuth Login via Google and GitHub providers",
    body: "## 📋 Summary\nExpand our authentication beyond Magic Links/Passwords by integrating Google and GitHub OAuth providers via Supabase Auth.\n\n## 🎯 Background\nStudents prefer fast single-sign-on (SSO) options over remembering passwords.\n\n## ✅ Acceptance Criteria\n- [ ] Configure OAuth providers in the Supabase Dashboard.\n- [ ] Add 'Login with Google' and 'Login with GitHub' buttons to the Auth screen.\n- [ ] Handle the OAuth callback URL routing.\n\n## 🗂️ Files to Modify\n- `src/pages/Auth/Login.tsx`\n- `src/lib/supabaseClient.ts`",
    labels: ["ECSoC26", "security", "enhancement"]
  },
  {
    title: "Create a User Onboarding Wizard for new signups",
    body: "## 📋 Summary\nWhen a user logs in for the very first time, present them with a 3-step modal to fill out their Name, Major/College, and bio before they can use the app.\n\n## 🎯 Background\nProfiles are often left blank. We need to prompt users to complete them immediately after signup.\n\n## ✅ Acceptance Criteria\n- [ ] Detect if the user's profile is incomplete on initial load.\n- [ ] Display an un-dismissible Dialog overlay with a multi-step form.\n- [ ] Save the data to the `profiles` table.\n\n## 🗂️ Files to Modify\n- `src/components/OnboardingWizard.tsx`\n- `src/App.tsx`",
    labels: ["ECSoC26", "ui", "feature"]
  },
  {
    title: "Add Infinite Scroll to the Discussion Feed",
    body: "## 📋 Summary\nReplace standard pagination with infinite scrolling on the discussion feed using an IntersectionObserver.\n\n## 🎯 Background\nThe feed grows very long. Fetching all posts at once causes lag, and clicking 'Next Page' is poor UX for social feeds.\n\n## ✅ Acceptance Criteria\n- [ ] Implement `react-intersection-observer`.\n- [ ] Update the Supabase query to use `.range(start, end)`.\n- [ ] Fetch the next 10 posts when the user scrolls to the bottom sentinel.\n\n## 🗂️ Files to Modify\n- `src/components/Feed/PostList.tsx`",
    labels: ["ECSoC26", "performance", "ui"]
  },
  {
    title: "Refactor Button component to support various design variants",
    body: "## 📋 Summary\nStandardize all buttons across the application by refactoring the `Button.tsx` component to utilize `class-variance-authority` (cva).\n\n## 🎯 Background\nWe currently have mismatched button styles everywhere. We need strict variants: primary, secondary, destructive, ghost, outline, and link.\n\n## ✅ Acceptance Criteria\n- [ ] Implement `cva` inside `Button.tsx`.\n- [ ] Define the 6 core variants and 3 sizes (sm, md, lg).\n- [ ] Update at least 5 different pages to use the new standardized variants.\n\n## 🗂️ Files to Modify\n- `src/components/ui/Button.tsx`\n- Various pages.",
    labels: ["ECSoC26", "refactor", "ui"]
  },
  {
    title: "Add a Markdown/Rich-Text editor for writing discussion posts",
    body: "## 📋 Summary\nAllow users to write rich-text posts (bold, italics, lists, code blocks) instead of plain text by implementing a markdown editor.\n\n## 🎯 Background\nStudents sharing code snippets or detailed announcements need formatting options.\n\n## ✅ Acceptance Criteria\n- [ ] Add a markdown editor library (like `react-mde` or `uiw/react-md-editor`).\n- [ ] Save the raw markdown string to the database.\n- [ ] Use `react-markdown` to render the posts securely in the feed.\n\n## 🗂️ Files to Modify\n- `src/components/Feed/CreatePostBox.tsx`\n- `src/components/Feed/PostItem.tsx`",
    labels: ["ECSoC26", "feature", "ui"]
  },
  {
    title: "Build an Interactive Map component for finding Event locations",
    body: "## 📋 Summary\nIntegrate an interactive map (e.g. Leaflet or Mapbox) on the Event Details page to visually show where the event is taking place based on coordinates.\n\n## 🎯 Background\nText-based locations (e.g., 'Room 404') are hard to find for freshmen. A map provides crucial context.\n\n## ✅ Acceptance Criteria\n- [ ] Use `react-leaflet` or similar map library.\n- [ ] Read `latitude` and `longitude` from the event data.\n- [ ] Place a marker at the coordinates and render the map canvas.\n\n## 🗂️ Files to Modify\n- `src/pages/EventDetails.tsx`\n- `src/components/EventMap.tsx`",
    labels: ["ECSoC26", "feature", "integrations"]
  },
  {
    title: "Implement 'Share to WhatsApp/Twitter' buttons for Events",
    body: "## 📋 Summary\nAdd quick social sharing buttons on the Event page that generate pre-filled text linking to the event URL.\n\n## 🎯 Background\nWord-of-mouth is how events grow. Making sharing frictionless is essential.\n\n## ✅ Acceptance Criteria\n- [ ] Create Twitter and WhatsApp share icons.\n- [ ] Encode the event title and URL into the `href` intent schemes (e.g., `https://twitter.com/intent/tweet?text=...`).\n- [ ] Use the Web Share API on mobile devices if supported.\n\n## 🗂️ Files to Modify\n- `src/components/Events/EventSharePanel.tsx`",
    labels: ["ECSoC26", "ui", "good-first-issue"]
  },
  {
    title: "Create an 'Add to Calendar' button for Event RSVPs",
    body: "## 📋 Summary\nProvide a dropdown button that lets attendees instantly add the event to Google Calendar, Apple Calendar, or Outlook.\n\n## 🎯 Background\nUsers often RSVP but forget to attend because it's not in their personal calendar.\n\n## ✅ Acceptance Criteria\n- [ ] Use a library like `add-to-calendar-button-react` or manually generate the ICS strings.\n- [ ] Pass the event start time, end time, title, and description.\n- [ ] Place the button prominently next to the RSVP button.\n\n## 🗂️ Files to Modify\n- `src/components/Events/EventActions.tsx`",
    labels: ["ECSoC26", "feature", "integrations"]
  },
  {
    title: "Add smooth page transition animations using Framer Motion",
    body: "## 📋 Summary\nEnhance the application's feel by adding subtle fade-in and slide-up animations when navigating between major routes using Framer Motion.\n\n## 🎯 Background\nInstant page snapping feels cheap. A fast, 200ms fade makes the app feel premium and native.\n\n## ✅ Acceptance external\n- [ ] Install `framer-motion`.\n- [ ] Wrap the main router `Outlet` in an `AnimatePresence`.\n- [ ] Add `initial`, `animate`, and `exit` props to route wrappers.\n\n## 🗂️ Files to Modify\n- `src/App.tsx`\n- `src/components/PageWrapper.tsx`",
    labels: ["ECSoC26", "ui", "enhancement"]
  },
  {
    title: "Implement real-time typing indicators in discussion threads",
    body: "## 📋 Summary\nUse Supabase Realtime Presence to show when other users are currently typing a comment on a discussion post.\n\n## 🎯 Background\nTyping indicators make the app feel alive and prevent users from navigating away when they know a reply is coming.\n\n## ✅ Acceptance Criteria\n- [ ] Track keystrokes in the comment input box.\n- [ ] Broadcast a `typing` event via Supabase Realtime channel.\n- [ ] Display 'Someone is typing...' above the comments list.\n\n## 🗂️ Files to Modify\n- `src/components/Feed/CommentSection.tsx`",
    labels: ["ECSoC26", "feature", "realtime"]
  },
  {
    title: "Write comprehensive Cypress end-to-end tests for the RSVP flow",
    body: "## 📋 Summary\nAdd automated E2E tests to ensure the Event RSVP pipeline never breaks. Test logging in, finding an event, clicking RSVP, and checking the dashboard.\n\n## 🎯 Background\nThis is the most critical user flow in the app. Manual testing is error-prone.\n\n## ✅ Acceptance Criteria\n- [ ] Install Cypress.\n- [ ] Write a spec file `rsvp.cy.ts`.\n- [ ] Mock the Supabase auth state or use a dedicated test account.\n- [ ] Assert the UI updates correctly after RSVP.\n\n## 🗂️ Files to Modify\n- `cypress/e2e/rsvp.cy.ts`\n- `package.json`",
    labels: ["ECSoC26", "testing", "quality"]
  },
  {
    title: "Configure Prettier and ESLint pre-commit hooks using Husky",
    body: "## 📋 Summary\nPrevent bad code from being pushed to the repository by automatically running the linter and formatter on staged files before a commit is allowed.\n\n## 🎯 Background\nCode review time is wasted pointing out missing semicolons or bad indentation.\n\n## ✅ Acceptance Criteria\n- [ ] Install `husky` and `lint-staged`.\n- [ ] Configure a pre-commit hook to run `eslint --fix` and `prettier --write` on `*.ts` and `*.tsx` files.\n- [ ] Test the hook by trying to commit badly formatted code.\n\n## 🗂️ Files to Modify\n- `package.json`\n- `.husky/pre-commit`",
    labels: ["ECSoC26", "config", "developer-experience"]
  },
  {
    title: "Add dynamic meta tags for SEO on public Club profile pages",
    body: "## 📋 Summary\nEnsure that when a Club's URL is shared on Discord or Twitter, a proper embed card (OpenGraph) with the club's banner and description appears.\n\n## 🎯 Background\nCurrently, React Helmet isn't dynamically updating the `<meta>` tags properly for web scrapers.\n\n## ✅ Acceptance Criteria\n- [ ] Utilize `react-helmet-async` on the Club Details page.\n- [ ] Inject the club's name into `<title>` and `og:title`.\n- [ ] Inject the club's banner into `og:image` and `twitter:image`.\n\n## 🗂️ Files to Modify\n- `src/pages/ClubDetails.tsx`",
    labels: ["ECSoC26", "seo", "enhancement"]
  },
  {
    title: "Build a multi-step form for creating new Events",
    body: "## 📋 Summary\nThe current 'Create Event' form is a massive wall of inputs. Break it down into a 3-step wizard: 1. Basic Info, 2. Date & Location, 3. Banner & Capacity.\n\n## 🎯 Background\nLong forms cause high abandonment rates. A wizard reduces cognitive load for organizers.\n\n## ✅ Acceptance Criteria\n- [ ] Refactor the form using `react-hook-form` and `zod` for validation across steps.\n- [ ] Add 'Next' and 'Previous' buttons.\n- [ ] Display a progress bar indicating which step the user is on.\n\n## 🗂️ Files to Modify\n- `src/components/Forms/CreateEventForm.tsx`",
    labels: ["ECSoC26", "ui", "refactor"]
  },
  {
    title: "Implement search debouncing on the main navigation search bar",
    body: "## 📋 Summary\nPrevent the search bar from firing a Supabase database query on every single keystroke. Implement a 300ms debounce.\n\n## 🎯 Background\nTyping 'react' fires 5 separate database queries rapidly, which is wasteful and hits rate limits.\n\n## ✅ Acceptance Criteria\n- [ ] Add a `useDebounce` custom hook.\n- [ ] Only trigger the search fetch function when the user stops typing for 300 milliseconds.\n\n## 🗂️ Files to Modify\n- `src/components/Navigation/GlobalSearch.tsx`\n- `src/hooks/useDebounce.ts`",
    labels: ["ECSoC26", "performance", "good-first-issue"]
  },
  {
    title: "Create a 'Trending Clubs' carousel on the student dashboard",
    body: "## 📋 Summary\nHighlight active clubs by displaying a horizontal carousel of the top 5 clubs with the most members on the main student dashboard.\n\n## 🎯 Background\nNew users don't know which clubs to join. Showcasing popular ones increases engagement.\n\n## ✅ Acceptance Criteria\n- [ ] Use `embla-carousel-react` to build the slider.\n- [ ] Fetch the top 5 clubs ordered by `member_count` descending.\n- [ ] Ensure the carousel is touch-friendly on mobile devices.\n\n## 🗂️ Files to Modify\n- `src/pages/Dashboard.tsx`\n- `src/components/Clubs/TrendingCarousel.tsx`",
    labels: ["ECSoC26", "ui", "feature"]
  },
  {
    title: "Add visual password strength indicator on registration page",
    body: "## 📋 Summary\nHelp users create secure passwords by displaying a progress bar (Red/Yellow/Green) based on password complexity (length, symbols, numbers).\n\n## 🎯 Background\nSupabase requires complex passwords, but users don't know why their 'password123' is rejected until they submit the form.\n\n## ✅ Acceptance Criteria\n- [ ] Implement a password strength algorithm (e.g., `zxcvbn`).\n- [ ] Render a progress bar below the password input field.\n- [ ] Disable the submit button until the strength is at least 'Good'.\n\n## 🗂️ Files to Modify\n- `src/pages/Auth/Register.tsx`",
    labels: ["ECSoC26", "security", "ui"]
  },
  {
    title: "Implement email verification requirement before user can post",
    body: "## 📋 Summary\nPrevent spam by locking down Write actions (creating posts, comments, RSVPs) until the user has clicked the verification link sent to their email.\n\n## 🎯 Background\nCurrently, unverified accounts can immediately post, opening the door to bot spam.\n\n## ✅ Acceptance Criteria\n- [ ] Check `auth.users` for `email_confirmed_at` via the Supabase session.\n- [ ] If unverified, render a disabled state for the 'Post' button with a tooltip: 'Please verify your email to post'.\n- [ ] Show a global banner reminding them to verify.\n\n## 🗂️ Files to Modify\n- `src/components/Feed/CreatePostBox.tsx`\n- `src/App.tsx`",
    labels: ["ECSoC26", "security", "feature"]
  },
  {
    title: "Build a custom Video Player component for past event recordings",
    body: "## 📋 Summary\nCreate a branded, custom HTML5 video player wrapper to display recordings of past workshops, rather than relying on default browser controls.\n\n## 🎯 Background\nDefault browser video players look different on Safari, Chrome, and Firefox, hurting brand consistency.\n\n## ✅ Acceptance Criteria\n- [ ] Hide native controls.\n- [ ] Build custom Play/Pause, Timeline Scrubber, Volume, and Fullscreen buttons.\n- [ ] Ensure keyboard shortcuts (Space to play, arrows to seek) work.\n\n## 🗂️ Files to Modify\n- `src/components/VideoPlayer.tsx`",
    labels: ["ECSoC26", "ui", "feature"]
  },
  {
    title: "Add extensive keyboard navigation support for custom dropdown menus",
    body: "## 📋 Summary\nEnsure that all custom Radix-based dropdowns (like the User Profile menu) can be navigated entirely using the Tab, Arrow keys, and Enter key.\n\n## 🎯 Background\nWeb accessibility (a11y) is a core requirement. Keyboard power users and visually impaired students rely on this.\n\n## ✅ Acceptance Criteria\n- [ ] Verify focus traps within modals and dropdowns.\n- [ ] Add `aria-expanded` and `aria-haspopup` attributes where missing.\n- [ ] Write a test or manually verify full keyboard operation.\n\n## 🗂️ Files to Modify\n- `src/components/Navigation/UserDropdown.tsx`",
    labels: ["ECSoC26", "accessibility", "ui"]
  },
  {
    title: "Create a 'Report Bug' modal dialog accessible from the footer",
    body: "## 📋 Summary\nAllow users to quickly report UI glitches or errors by clicking a link in the footer, opening a modal to submit feedback directly to a database table.\n\n## 🎯 Background\nDevelopers need immediate user feedback when things break in production.\n\n## ✅ Acceptance Criteria\n- [ ] Create a `feedback` table in Supabase.\n- [ ] Build a Modal component with a text area and screenshot upload option.\n- [ ] Trigger an insert query to Supabase on submit.\n\n## 🗂️ Files to Modify\n- `src/components/Footer.tsx`\n- `src/components/Modals/BugReportModal.tsx`",
    labels: ["ECSoC26", "feature", "quality"]
  },
  {
    title: "Implement visual feedback (e.g. confetti) upon successful RSVP",
    body: "## 📋 Summary\nDelight the user by triggering a lightweight confetti particle animation when they successfully RSVP to an event.\n\n## 🎯 Background\nMicro-interactions and joyful UI increase user retention and satisfaction.\n\n## ✅ Acceptance Criteria\n- [ ] Install `react-confetti` or `canvas-confetti`.\n- [ ] Fire the confetti burst exactly when the Supabase RSVP mutation succeeds.\n- [ ] Ensure it doesn't cause scrolling issues or layout shifts.\n\n## 🗂️ Files to Modify\n- `src/components/Events/EventActions.tsx`",
    labels: ["ECSoC26", "ui", "good-first-issue"]
  },
  {
    title: "Refactor color tokens in Tailwind config to use CSS variables",
    body: "## 📋 Summary\nInstead of hardcoding hex codes in `tailwind.config.js`, map them to CSS variables (e.g., `var(--color-primary)`) defined in `index.css` to allow for runtime theme switching.\n\n## 🎯 Background\nThis is a prerequisite for highly customizable theming and advanced dark modes.\n\n## ✅ Acceptance Criteria\n- [ ] Extract all brand hex colors into `:root` in `index.css`.\n- [ ] Update `tailwind.config.js` to reference these variables using HSL/RGB formats.\n- [ ] Verify no colors break across the app.\n\n## 🗂️ Files to Modify\n- `tailwind.config.js` (or Vite Tailwind 4 config)\n- `src/index.css`",
    labels: ["ECSoC26", "refactor", "config"]
  },
  {
    title: "Add 'Similar Events' recommendation block on Event details page",
    body: "## 📋 Summary\nBelow the main event description, display a row of 3 upcoming events that share the same `category_id` as the current event.\n\n## 🎯 Background\nKeep users engaged by directing them to other events they might be interested in, reducing bounce rates.\n\n## ✅ Acceptance Criteria\n- [ ] Write a Supabase query to fetch events with matching category, excluding the current event ID.\n- [ ] Render 3 mini event cards.\n- [ ] Handle empty states gracefully (hide the section if no similar events exist).\n\n## 🗂️ Files to Modify\n- `src/pages/EventDetails.tsx`",
    labels: ["ECSoC26", "feature", "ui"]
  },
  {
    title: "Build a localized date/time formatter utility utilizing date-fns",
    body: "## 📋 Summary\nCreate a unified utility file `dateUtils.ts` that exports functions to format timestamps into 'Relative time' (e.g., '2 hours ago') and standard formats ('October 12, 2026').\n\n## 🎯 Background\nDates are formatted inconsistently using native `Intl` or raw strings across different components.\n\n## ✅ Acceptance Criteria\n- [ ] Import `date-fns`.\n- [ ] Export `formatRelativeTime(date)` and `formatStandardDate(date)`.\n- [ ] Replace at least 10 instances of manual date formatting across the app with this utility.\n\n## 🗂️ Files to Modify\n- `src/utils/dateUtils.ts`\n- Various components",
    labels: ["ECSoC26", "refactor", "good-first-issue"]
  },
  {
    title: "Configure Vercel Analytics and Speed Insights for production monitoring",
    body: "## 📋 Summary\nIntegrate the `@vercel/analytics` and `@vercel/speed-insights` packages into the React application to track page views, unique visitors, and Core Web Vitals.\n\n## 🎯 Background\nWe are deploying to Vercel but missing critical telemetry to understand how real users experience the site's performance.\n\n## ✅ Acceptance Criteria\n- [ ] Install both packages.\n- [ ] Add `<Analytics />` and `<SpeedInsights />` to the root `App.tsx` layout.\n- [ ] Ensure they only run in the production environment to save quota.\n\n## 🗂️ Files to Modify\n- `src/App.tsx`\n- `package.json`",
    labels: ["ECSoC26", "config", "analytics"]
  }
];

async function createNewMixedIssues() {
  console.log("\n🚀 CampusConnect — 32 New Mixed Issues Script");
  console.log(`📦 Repository: ${GITHUB_REPO}`);
  console.log(`📝 Total issues to create: ${mixedIssues.length}\n`);

  console.log("⏳ Fetching existing issues to prevent duplicates...");
  const [openIssues, closedIssues] = await Promise.all([
    githubRequest("/issues?state=open&per_page=100"),
    githubRequest("/issues?state=closed&per_page=100"),
  ]);

  const allExisting = [...(openIssues || []), ...(closedIssues || [])];
  const existingTitles = new Set(allExisting.map((i: { title: string }) => i.title));
  console.log(`✅ Found ${existingTitles.size} existing issues to check against.\n`);

  let createdCount = 0;
  let skippedCount = 0;
  const createdNumbers: number[] = [];

  for (let index = 0; index < mixedIssues.length; index++) {
    const issue = mixedIssues[index];
    const issueNum = String(index + 1).padStart(2, "0");

    if (existingTitles.has(issue.title)) {
      console.log(`⏩ [${issueNum}/${mixedIssues.length}] SKIP  — "${issue.title.slice(0, 70)}..."`);
      skippedCount++;
      continue;
    }

    console.log(`➕ [${issueNum}/${mixedIssues.length}] CREATE — "${issue.title.slice(0, 70)}..."`);

    const res = await githubRequest("/issues", "POST", issue);
    if (res) {
      createdCount++;
      createdNumbers.push(res.number);
      console.log(`   ✅ Created: #${res.number} — ${res.html_url}`);
    } else {
      console.log("   ❌ Failed to create this issue.");
    }

    if (index < mixedIssues.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log("🎉 Issue Creation Done!");
  console.log(`   ✅ Created : ${createdCount} issues`);
  console.log(`   ⏩ Skipped : ${skippedCount} issues`);
  console.log(`${"─".repeat(60)}\n`);

  if (createdNumbers.length > 0) {
    console.log("⏳ Waiting 45 seconds for GitHub Actions to trigger and auto-assign...");
    console.log("   (After the wait, we will automatically run the unassign cleanup loop)");
    await new Promise((resolve) => setTimeout(resolve, 45000));

    console.log("\n🧹 Starting unassign cleanup loop...");
    for (const num of createdNumbers) {
      console.log(`🗑️  Unassigning from issue #${num}...`);
      const issue = await githubRequest(`/issues/${num}`);
      if (issue) {
        const assignees: string[] = (issue.assignees || []).map((a: { login: string }) => a.login);
        if (assignees.length > 0) {
          await githubRequest(`/issues/${num}/assignees`, "DELETE", { assignees });
          console.log("   ✅ Successfully unassigned.");
        } else {
          console.log("   ✅ Already unassigned.");
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log("\n🎉 All unassignment cleanups completed successfully!");
  }
}

createNewMixedIssues();
