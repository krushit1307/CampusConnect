import fs from "fs";
import path from "path";

// ─── 1. Setup & Authentication ───────────────────────────────────────────────
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
  "User-Agent": "CampusConnect-Frontend-Issues-Script",
};

// ─── 2. Helper for API Requests ───────────────────────────────────────────────
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

// ─── 3. The 30 New Frontend Issues Payload ────────────────────────────────────
/**
 * Label legend (used from existing repo labels):
 *  - "ECSoC26"       → COMPULSORY on all issues (Elite Coders Summer Of Code '26)
 *  - "frontend"      → front-end work
 *  - "good-ui"       → UI/UX improvement (from the four official ones)
 *  - "good-issue"    → well-scoped, standalone issue
 *  - "good-pr"       → good candidate for a clean PR
 *  - "good-backend"  → cross-cutting (added only when backend RLS/DB also touched)
 *  - "enhancement"   → new feature
 *  - "UI/UX"         → visual / interaction design
 *  - "accessibility" → a11y
 *  - "refactor"      → code quality
 *  - "bug"           → confirmed bug
 *  - "design"        → visual design work
 */
const newFrontendIssues = [
  // ── Landing Page ─────────────────────────────────────────────────────────
  {
    title: "[Frontend] Redesign Hero Section on Landing Page with Animated Background",
    body: `## 📋 Summary
The current hero section on the landing page uses a static SVG gradient background. We should replace it with a visually rich, animated hero section that makes an excellent first impression for new visitors.

## 🎯 Background
File: \`src/routes/index.tsx\`

The \`<section>\` with the inline \`backgroundImage\` style prop currently renders a static SVG. Students visiting for the first time need to immediately understand the value proposition of CampusConnect through a compelling, dynamic UI.

## ✅ Acceptance Criteria
- [ ] Replace the static SVG background with a CSS animated gradient or a subtle particle/grid animation using pure CSS keyframes.
- [ ] Add a smooth fade-in entrance animation (e.g., \`@keyframes fadeInUp\`) for the heading, subheading, and CTA buttons.
- [ ] The hero must remain fully responsive (mobile: \`h-96\`, desktop: \`md:h-[500px]\`).
- [ ] CTA buttons ("Get Started" and "Explore Events") must retain their current routing to \`/auth\` and \`/events\`.
- [ ] Do NOT use any external animation libraries — use Tailwind CSS classes and vanilla CSS only.

## 🗂️ Files to Modify
- \`src/routes/index.tsx\` — Hero \`<section>\` JSX and inline styles
- \`src/styles.css\` — Add keyframe animations as needed

## 💡 Hints
- Use CSS \`@keyframes\` with \`translateY\` and \`opacity\` for text entrance effects.
- Tailwind \`animate-*\` utilities and \`tw-animate-css\` (already in \`package.json\`) can help.
- Keep the color palette consistent: primary navy \`#123a57\`, accent gold \`#f5c66b\`.`,
    labels: ["ECSoC26", "frontend", "good-ui", "UI/UX", "enhancement"],
  },

  // ── Navbar ────────────────────────────────────────────────────────────────
  {
    title: "[Frontend] Add Active Route Indicator Pill to Mobile Navigation Menu",
    body: `## 📋 Summary
The desktop navbar highlights the active route using underline decoration, but the mobile hamburger menu only uses background color. We should unify the active route indicator design in the mobile nav to be consistent with the desktop.

## 🎯 Background
File: \`src/components/site/Navbar.tsx\`

The mobile nav panel (rendered when \`mobileMenuOpen === true\`) switches \`bg-black text-cream\` for the active link. This is inconsistent with the desktop underline style and feels jarring on small screens.

## ✅ Acceptance Criteria
- [ ] Add a left-border indicator (\`border-l-4 border-l-[#f5c66b]\`) to the active mobile nav link.
- [ ] Retain the background color change for clarity, but add the yellow left border accent.
- [ ] Ensure the focus ring (keyboard accessibility) is still visible.
- [ ] Verify no layout shift occurs on links that have the extra border padding.

## 🗂️ Files to Modify
- \`src/components/site/Navbar.tsx\`

## 💡 Hints
- The active state check is already done via \`isActive\` boolean per link.
- Append \`border-l-4 border-l-[#f5c66b]\` to the active link's className string.`,
    labels: ["ECSoC26", "frontend", "good-ui", "UI/UX"],
  },

  // ── Events Page ───────────────────────────────────────────────────────────
  {
    title: "[Frontend] Implement Category Tag Chips with Color Coding on Events Page",
    body: `## 📋 Summary
The Events page filter buttons ("All", "Workshop", "Talk", "Hackathon", "Social") are unstyled plain buttons. They should be redesigned as visually distinct tag chips with unique accent colors per category, making it faster and more intuitive to filter events.

## 🎯 Background
File: \`src/routes/events.tsx\`

Currently the filter buttons use a generic \`bg-black / bg-white\` toggle. Adding distinct colors per category (e.g., green for Workshop, blue for Hackathon) will improve visual scanning and engagement.

## ✅ Acceptance Criteria
- [ ] Each filter chip should have a unique background color when **active**: 
  - All → black
  - Workshop → \`bg-lime\`
  - Talk → \`bg-sky\`
  - Hackathon → \`bg-lavender\`
  - Social → \`bg-peach\`
- [ ] Inactive chips should use \`bg-white\` with a border.
- [ ] Transition should be smooth (\`transition-colors duration-200\`).
- [ ] The "Clear All" button should reset to "All" correctly.
- [ ] Must be accessible (proper \`aria-pressed\` attribute on each chip button).

## 🗂️ Files to Modify
- \`src/routes/events.tsx\` — Filter button array and rendering logic

## 💡 Hints
- Create a \`filterColors\` map object keyed by filter name.
- Use \`aria-pressed={filter === t}\` for screen reader accessibility.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement", "accessibility"],
  },

  {
    title: "[Frontend] Add 'No Events Found' Empty State with Call-to-Action for Filtered View",
    body: `## 📋 Summary
When a user selects a category filter (e.g., "Hackathon") and no events match, the events grid renders an empty section with no feedback. We need a well-designed empty state component that tells the user no events match and encourages them to clear the filter or create one.

## 🎯 Background
File: \`src/routes/events.tsx\`

When \`filteredEvents.length === 0\` and \`filter !== "All"\`, nothing is rendered in the grid area. This is confusing UX.

## ✅ Acceptance Criteria
- [ ] When \`filteredEvents.length === 0\` and a filter is active, show a centered empty state card.
- [ ] The card should include:
  - A relevant icon (e.g., \`Calendar\` from Lucide).
  - Text: \`"No {filter} events found."\` (dynamic).
  - A "Clear filter" button that calls \`setFilter("All")\`.
- [ ] The empty state should span the full grid width using \`col-span-full\`.
- [ ] Animate the card entrance with \`animate-in\` or a CSS fade.

## 🗂️ Files to Modify
- \`src/routes/events.tsx\`

## 💡 Hints
- Wrap the conditional in \`filteredEvents.length === 0 && filter !== "All"\`.
- Reuse the existing \`neu-border\` class for card styling.`,
    labels: ["ECSoC26", "frontend", "good-issue", "UI/UX"],
  },

  {
    title: "[Frontend] Add Event Date Countdown Timer Badge to EventCard",
    body: `## 📋 Summary
Event cards currently show the event date as a static formatted date badge. Adding a dynamic countdown (e.g., "In 3 days" or "Tomorrow") gives users a better sense of urgency and makes upcoming events feel more relevant.

## 🎯 Background
File: \`src/components/EventCard.tsx\`

The EventCard already displays a date badge. We should augment it with a human-readable countdown string computed from the event date.

## ✅ Acceptance Criteria
- [ ] Compute a relative time string using \`Intl.RelativeTimeFormat\` or \`date-fns\` (already in \`package.json\`).
- [ ] Display the countdown below the date badge — e.g., "In 3 days", "Tomorrow", "Today!".
- [ ] If event is past, display "Ended" instead.
- [ ] The countdown badge should use a distinct color — e.g., \`bg-peach\` for upcoming, \`bg-gray-100\` for past.
- [ ] Ensure no layout shifts occur in the card grid.

## 🗂️ Files to Modify
- \`src/components/EventCard.tsx\`
- \`src/lib/utils.ts\` — Add a \`getCountdown(dateStr: string): string\` utility function

## 💡 Hints
- Use \`date-fns\` \`formatDistanceToNow\` or \`differenceInDays\` for the calculation.
- Cap the countdown at "In X months" for events far in the future.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement"],
  },

  {
    title: "[Frontend] Implement Event Search/Filter Bar with Keyboard Shortcut Support",
    body: `## 📋 Summary
The events page currently only supports filter chips for category-based filtering. Adding a live search text input allows users to find events by keyword in the title or description. Bonus: add a keyboard shortcut (e.g., \`/\` key) to focus the search.

## 🎯 Background
File: \`src/routes/events.tsx\`

The club directory at \`clubs.index.tsx\` already has a search input with a 300ms debounce. We should bring the same UX pattern to the events page.

## ✅ Acceptance Criteria
- [ ] Add a search input above the filter chips on the events page.
- [ ] Filter events by matching against \`event.title\` and \`event.description\` (case-insensitive).
- [ ] Implement 300ms debounce so filtering doesn't trigger on every keystroke.
- [ ] Add a clear (\`X\`) button inside the input when search has a value.
- [ ] Pressing \`/\` on keyboard (when not in another input) focuses the search bar.
- [ ] Announce result count to screen readers via \`aria-live="polite"\`.

## 🗂️ Files to Modify
- \`src/routes/events.tsx\`

## 💡 Hints
- Reuse the search input pattern from \`src/routes/clubs.index.tsx\` — it already has clear-X and debounce.
- Use \`useRef\` for the input and a \`keydown\` event listener on \`document\` for the \`/\` shortcut.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement", "accessibility"],
  },

  // ── EventCard Component ───────────────────────────────────────────────────
  {
    title: "[Frontend] Add Share Button to EventCard with Native Share API Fallback",
    body: `## 📋 Summary
Events should be shareable with a single click. The EventCard component should include a Share button that uses the Web Share API on mobile and copies the event URL to clipboard as a fallback on desktop.

## 🎯 Background
File: \`src/components/EventCard.tsx\`

Currently there is no way to share individual events from the events listing. The Discussion Feed (\`feed.tsx\`) has social sharing links (Twitter, LinkedIn, WhatsApp) but the EventCard has none.

## ✅ Acceptance Criteria
- [ ] Add a "Share" icon button (\`Share2\` from Lucide) to the EventCard footer.
- [ ] On click: attempt \`navigator.share({ title, url })\` — the Web Share API.
- [ ] If \`navigator.share\` is not available (desktop), copy the event URL to clipboard using \`navigator.clipboard.writeText()\`.
- [ ] Show a \`sonner\` toast on success: "Link copied to clipboard!" or "Shared!".
- [ ] The button must have an accessible \`aria-label="Share this event"\`.

## 🗂️ Files to Modify
- \`src/components/EventCard.tsx\`

## 💡 Hints
- \`navigator.share\` is supported on mobile Chrome/Safari; check with \`if (navigator.share)\`.
- Use \`toast\` from \`sonner\` (already installed) for feedback.`,
    labels: ["ECSoC26", "frontend", "good-pr", "enhancement", "accessibility"],
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  {
    title: "[Frontend] Implement Real Activity Feed in Dashboard 'Recent Activity' Widget",
    body: `## 📋 Summary
The Dashboard's "Recent Activity" widget currently shows a hardcoded placeholder: "No recent activity fetched yet." We need to wire up actual data from Supabase to display the user's recent actions (RSVPs, posts, club joins).

## 🎯 Background
File: \`src/routes/dashboard.tsx\`

The \`Widget\` component titled "Recent activity" renders a static message. Supabase has tables for \`posts\`, \`event_rsvps\`, and \`club_members\` that we can use to build a real activity timeline.

## ✅ Acceptance Criteria
- [ ] Add a \`useQuery\` hook to fetch the user's 5 most recent activities from \`posts\`, \`event_rsvps\`, and \`club_members\`.
- [ ] Merge results and sort them by \`created_at\` descending.
- [ ] Each activity row should show: an icon (e.g., \`Calendar\` for RSVP, \`MessageCircle\` for post), a human-readable description ("You RSVP'd to Hackathon 2024"), and a relative timestamp.
- [ ] If no activity, display an appropriate empty state message.
- [ ] Show a skeleton loader while data is fetching.

## 🗂️ Files to Modify
- \`src/routes/dashboard.tsx\`
- \`src/lib/supabase/client.ts\` — (optional: add a utility query)

## 💡 Hints
- Query \`event_rsvps\`, \`posts\`, and \`club_members\` separately and merge with \`[...a, ...b, ...c].sort()\`.
- Use \`Intl.RelativeTimeFormat\` for timestamps (already used in \`feed.tsx\`).`,
    labels: ["ECSoC26", "frontend", "good-issue", "enhancement"],
  },

  {
    title: "[Frontend] Add 'Quick Action' Buttons Row to Dashboard Hero Section",
    body: `## 📋 Summary
The Dashboard header currently only greets the user. We should add a row of quick-action buttons ("Browse Events", "Join a Club", "Post to Feed") below the greeting to improve onboarding flow and reduce navigation effort.

## 🎯 Background
File: \`src/routes/dashboard.tsx\`

New users who land on the dashboard don't have an obvious "what to do next" prompt. A quick-action bar addresses this pattern common in modern dashboards.

## ✅ Acceptance Criteria
- [ ] Add 3 quick-action buttons below the greeting in the hero section:
  1. "Browse Events" → links to \`/events\`
  2. "Find a Club" → links to \`/clubs\`
  3. "Post to Feed" → links to \`/feed\`
- [ ] Each button should have a relevant Lucide icon.
- [ ] On mobile, stack the buttons vertically. On desktop (\`md:\`), display them in a row.
- [ ] Use the existing \`neu-border\` and \`bg-lime\` styling palette.

## 🗂️ Files to Modify
- \`src/routes/dashboard.tsx\`

## 💡 Hints
- Use \`<Link>\` from \`react-router-dom\` for navigation.
- Consider a \`flex-wrap\` container with \`gap-3\` for the button row.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement"],
  },

  {
    title: "[Frontend] Add Confetti / Celebration Animation on First RSVP",
    body: `## 📋 Summary
When a user RSVPs to their very first event, we should trigger a celebration animation to delight them and reinforce positive engagement. This is a common gamification pattern in modern apps.

## 🎯 Background
File: \`src/routes/events.tsx\`, \`src/components/EventCard.tsx\`

The \`toggleRsvp\` mutation in \`events.tsx\` fires an \`onSuccess\` callback. We can hook into this to check if it's the user's first RSVP and trigger a confetti effect.

## ✅ Acceptance Criteria
- [ ] After a successful RSVP toggle (joining, not leaving), check if this is the user's first RSVP using a Supabase count query.
- [ ] If it is the first RSVP, trigger a brief CSS confetti animation or use a lightweight pure-JS confetti snippet (no heavy npm package).
- [ ] The animation should auto-dismiss after 3 seconds.
- [ ] Also show a special toast: "🎉 You RSVPd to your first event! See it in your Dashboard."

## 🗂️ Files to Modify
- \`src/routes/events.tsx\`
- \`src/styles.css\` — Add confetti keyframe animation

## 💡 Hints
- Query \`event_rsvps\` with \`.select('id', { count: 'exact' })\` to check RSVP count.
- A pure CSS confetti can be achieved with multiple \`<div>\` elements animated with \`@keyframes fall\`.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement"],
  },

  // ── Settings Page ─────────────────────────────────────────────────────────
  {
    title:
      "[Frontend] Replace Plain Checkboxes in Settings > Notifications with Radix Switch Toggle",
    body: `## 📋 Summary
The Settings page Notifications panel uses plain HTML \`<input type="checkbox">\` elements. These should be replaced with the already-installed Radix UI \`<Switch>\` component for a more premium, accessible experience.

## 🎯 Background
File: \`src/routes/settings.tsx\`

The \`Toggle\` component (defined at the bottom of \`settings.tsx\`) renders a raw \`<input type="checkbox" className="h-5 w-5 accent-black">\`. The \`Switch\` component exists at \`src/components/ui/switch.tsx\`.

## ✅ Acceptance Criteria
- [ ] Replace the \`<input type="checkbox">\` in the \`Toggle\` function with \`<Switch>\` from \`@/components/ui/switch\`.
- [ ] Connect the Switch to local React state (controlled component).
- [ ] Persist toggle state to Supabase \`profiles.notification_preferences\` (JSONB column) on change.
- [ ] Ensure keyboard navigation (Tab + Space) still works.
- [ ] Show a subtle \`sonner\` toast on save: "Notification preferences saved."

## 🗂️ Files to Modify
- \`src/routes/settings.tsx\`
- \`src/components/ui/switch.tsx\` — Review current implementation

## 💡 Hints
- \`Switch\` from \`@radix-ui/react-switch\` supports \`checked\`, \`onCheckedChange\` props.
- Debounce the Supabase update call by 500ms to avoid unnecessary writes.`,
    labels: ["ECSoC26", "frontend", "good-ui", "accessibility", "refactor"],
  },

  {
    title: "[Frontend] Add 'GitHub & Social Links' Section to Settings Profile Form",
    body: `## 📋 Summary
The Settings profile form currently allows users to enter LinkedIn and phone number. We should add GitHub profile URL and personal website URL fields to make student profiles more useful for recruiters.

## 🎯 Background
File: \`src/routes/settings.tsx\`

The \`profileSchema\` in \`src/lib/schemas.ts\` defines the form schema. We need to extend it with new optional fields.

## ✅ Acceptance Criteria
- [ ] Add two new optional fields to the profile form:
  - **GitHub URL** (with placeholder \`https://github.com/username\`)
  - **Personal Website** (with placeholder \`https://yoursite.com\`)
- [ ] Add Zod validation: must be valid URL or empty string.
- [ ] Wire the fields to \`react-hook-form\` using \`FormField\`.
- [ ] Update the \`profiles\` Supabase table update call to include \`github_url\` and \`website_url\`.
- [ ] Show appropriate icons (GitHub logo or \`Globe\` from Lucide) next to field labels.

## 🗂️ Files to Modify
- \`src/routes/settings.tsx\`
- \`src/lib/schemas.ts\` — Extend \`profileSchema\`

## 💡 Hints
- Use \`z.string().url().optional().or(z.literal(''))\` for URL validation.
- GitHub icon can be sourced from Lucide (\`Github\` icon is available in lucide-react).`,
    labels: ["ECSoC26", "frontend", "good-issue", "enhancement"],
  },

  {
    title: "[Frontend] Add Form Validation Feedback with Inline Error Messages on Settings Page",
    body: `## 📋 Summary
The Settings form currently uses \`<FormMessage>\` for error display, but validation errors (especially for Handle uniqueness) are not communicated clearly in real-time. We should improve the UX by adding real-time inline validation feedback.

## 🎯 Background
File: \`src/routes/settings.tsx\`

The \`handle\` field needs to be unique per user. Currently, uniqueness is only validated on form submit, causing a disruptive round-trip error. We should add async validation on-blur.

## ✅ Acceptance Criteria
- [ ] Add \`onBlur\` async validation for the \`handle\` field:
  - Query Supabase \`profiles\` table to check if handle is taken (excluding current user).
  - Show inline error "This handle is already taken" if not unique.
- [ ] Add a green checkmark (\`Check\` icon) next to the handle field when it's valid and available.
- [ ] Show a subtle loading spinner during the async check.
- [ ] The form submit button should be disabled if any field is in an invalid state.

## 🗂️ Files to Modify
- \`src/routes/settings.tsx\`
- \`src/lib/schemas.ts\`

## 💡 Hints
- Use \`react-hook-form\`'s \`validate\` option in \`FormField\` for async validation.
- Debounce the handle check by 500ms to avoid excessive Supabase queries.`,
    labels: ["ECSoC26", "frontend", "good-pr", "UI/UX"],
  },

  // ── Feed Page ─────────────────────────────────────────────────────────────
  {
    title: "[Frontend] Add Post Deletion Functionality with Confirmation Dialog for Feed Authors",
    body: `## 📋 Summary
Users who authored a post on the Feed page have no way to delete it from the UI. We need a delete button (visible only to the post author) that triggers a confirmation dialog before soft-deleting the post.

## 🎯 Background
File: \`src/routes/feed.tsx\`

The feed already soft-deletes posts via \`.is('deleted_at', null)\` filter. We need to expose the delete action to the post author in the UI.

## ✅ Acceptance Criteria
- [ ] Show a "Delete" icon button (\`Trash2\` from Lucide) on a post only if \`user?.id === author?.id\`.
- [ ] On click, open the existing \`<ConfirmModal>\` from \`@/components/ui/confirm-modal\`.
- [ ] On confirm, set \`deleted_at = new Date().toISOString()\` via a Supabase update.
- [ ] After deletion, optimistically remove the post from the UI without a full refetch.
- [ ] Show a \`sonner\` toast: "Post deleted successfully."

## 🗂️ Files to Modify
- \`src/routes/feed.tsx\`

## 💡 Hints
- Import and use \`ConfirmModal\` — it's already in \`src/components/ui/confirm-modal.tsx\`.
- Use \`useMutation\` with \`onSuccess: () => refetchPosts()\`.
- The RLS policy for DELETE must also allow authors to soft-delete — check Supabase policies.`,
    labels: ["ECSoC26", "frontend", "good-pr", "enhancement"],
  },

  {
    title: "[Frontend] Add Post Reactions (Like / Clap) System to Feed Posts",
    body: `## 📋 Summary
The Discussion Feed currently supports only text comments. Adding emoji reactions (👍 Like, 👏 Clap, 🔥 Fire) gives users a lightweight engagement mechanism without requiring them to write a full comment.

## 🎯 Background
File: \`src/routes/feed.tsx\`

This requires a new \`post_reactions\` table in Supabase (schema provided below) and a frontend reaction pill component.

## ✅ Acceptance Criteria
- [ ] Add a reaction bar below each post with at least 3 emoji options: 👍 👏 🔥.
- [ ] Clicking an emoji toggles the user's reaction (insert or delete from \`post_reactions\` table).
- [ ] Show the aggregate count next to each emoji (e.g., "👍 12").
- [ ] If the user has reacted, highlight the emoji with a \`bg-lime\` background pill.
- [ ] Real-time update counts using the existing Supabase channel subscription.

### Suggested DB Schema
\`\`\`sql
CREATE TABLE post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '👏', '🔥')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);
\`\`\`

## 🗂️ Files to Modify
- \`src/routes/feed.tsx\`
- \`supabase/migrations/\` — New migration for \`post_reactions\` table

## 💡 Hints
- Use \`useMutation\` with \`onSuccess: () => refetchPosts()\` for toggling.
- Group reactions by emoji using \`Array.reduce\` before rendering.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement"],
  },

  {
    title: "[Frontend] Add Character Counter and Preview Mode Toggle to Feed Post Editor",
    body: `## 📋 Summary
The Feed's Markdown post editor (\`MarkdownEditor\` component) lacks a character counter and a preview-before-submit mode. Contributors should be able to see how their Markdown will render before posting.

## 🎯 Background
File: \`src/components/MarkdownEditor.tsx\`, \`src/routes/feed.tsx\`

The \`MarkdownEditor\` component supports a Write tab internally. We need to expose a Preview tab and a character counter.

## ✅ Acceptance Criteria
- [ ] Add a character counter below the editor: "X / 2000 characters".
- [ ] When character count exceeds 2000, turn the counter red and disable the "Post" button.
- [ ] Add "Write" | "Preview" tab buttons above the editor.
- [ ] Preview mode renders the current markdown using \`<ReactMarkdown>\` with the same \`markdown-content\` class.
- [ ] Switching tabs should preserve the typed content.

## 🗂️ Files to Modify
- \`src/components/MarkdownEditor.tsx\`
- \`src/routes/feed.tsx\` — Adjust rendering if needed

## 💡 Hints
- Use \`value.length\` to compute the character count.
- The Tabs component is available at \`src/components/ui/tabs.tsx\`.`,
    labels: ["ECSoC26", "frontend", "good-pr", "UI/UX"],
  },

  // ── Clubs Pages ───────────────────────────────────────────────────────────
  {
    title: "[Frontend] Add Club Category Tags and Filter Chips to Club Directory",
    body: `## 📋 Summary
The Club Directory shows all clubs in a flat grid with no way to filter by category (e.g., "Tech", "Art", "Sports"). Adding category tags to each club card and filter chips at the top improves discoverability.

## 🎯 Background
File: \`src/routes/clubs.index.tsx\`

The current club card only shows name, member count, and a "View →" link. We should add a category badge and top-level filter chips.

## ✅ Acceptance Criteria
- [ ] Assume clubs have a \`category\` text field in the database (or add a migration if it doesn't exist).
- [ ] Display a category badge on each club card below the "Club" tag (e.g., \`bg-sky\` for Tech, \`bg-peach\` for Art).
- [ ] Add filter chip buttons above the grid for each category.
- [ ] Filtering should update the displayed clubs in real-time without re-fetching.
- [ ] Multiple categories can be active simultaneously (multi-select).

## 🗂️ Files to Modify
- \`src/routes/clubs.index.tsx\`
- \`src/routes/clubs.$slug.tsx\` — Show category on the detail page too

## 💡 Hints
- Maintain a \`Set<string>\` for selected categories in state.
- Filter: \`allClubs.filter(c => selectedCategories.size === 0 || selectedCategories.has(c.category))\`.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement"],
  },

  {
    title: "[Frontend] Add Club Member List with Role Badges on Club Detail Page",
    body: `## 📋 Summary
The Club detail page (\`clubs.$slug.tsx\`) shows club info but doesn't display the full member roster. Adding a members section with role badges (Admin, Organizer, Member) helps visitors understand club leadership and community size.

## 🎯 Background
File: \`src/routes/clubs.$slug.tsx\`

The Supabase query on this page can be extended to include club members and their roles from the \`club_members\` table.

## ✅ Acceptance Criteria
- [ ] Add a "Members" section below the club description.
- [ ] Display up to 10 members in a grid/list, each showing: Avatar initials circle, Full name, and Role badge (\`<RoleBadge>\` already exists at \`src/components/RoleBadge.tsx\`).
- [ ] Show "X members total" with a "View all" expansion if count > 10.
- [ ] The section should have a skeleton loader while fetching.
- [ ] Clicking a member could link to their profile (if profile page exists).

## 🗂️ Files to Modify
- \`src/routes/clubs.$slug.tsx\`

## 💡 Hints
- Extend the Supabase query: \`.select('*, club_members(role, profiles(full_name))')\`.
- Reuse the \`<RoleBadge>\` component from \`src/components/RoleBadge.tsx\`.`,
    labels: ["ECSoC26", "frontend", "good-pr", "enhancement"],
  },

  {
    title:
      "[Frontend] Add 'Join Club' Button with Pending State and Success Animation on Club Detail Page",
    body: `## 📋 Summary
The Club detail page needs a prominent "Join Club" button for non-members. The button should show a loading spinner during the join request and a success animation once approved.

## 🎯 Background
File: \`src/routes/clubs.$slug.tsx\`

Currently there is no join mechanism visible on the club detail page. The backend RLS already supports club membership.

## ✅ Acceptance Criteria
- [ ] Show a "Join Club" button if the current user is not a member.
- [ ] Show "Leave Club" if the user is already a member.
- [ ] On "Join", insert into \`club_members\` with \`status: 'pending'\` or \`'approved'\` depending on club settings.
- [ ] The button should show a \`Loader2\` spinner while the mutation is pending.
- [ ] On success, animate a checkmark (\`CheckCircle\` icon) for 2 seconds, then show "Member ✓".
- [ ] Show appropriate \`sonner\` toast messages.

## 🗂️ Files to Modify
- \`src/routes/clubs.$slug.tsx\`

## 💡 Hints
- Use \`useMutation\` with \`isPending\` for the loading state.
- Check membership status by querying \`club_members\` where \`user_id = user.id AND club_id = club.id\`.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement"],
  },

  // ── Certificates Page ─────────────────────────────────────────────────────
  {
    title: "[Frontend] Redesign Certificates Page with Gallery Grid and Preview Modal",
    body: `## 📋 Summary
The Certificates page (\`certificates.tsx\`) needs a visual overhaul. Instead of a plain list, we should display certificates in a gallery grid with thumbnail previews. Clicking a certificate opens a full preview modal.

## 🎯 Background
File: \`src/routes/certificates.tsx\`

Certificates are proof-of-work for students. They should be displayed prominently in a visually appealing gallery format.

## ✅ Acceptance Criteria
- [ ] Replace the current list layout with a 2-3 column responsive grid.
- [ ] Each certificate card should show: Event name, Issued date, Club name, and a "View" button.
- [ ] Clicking "View" opens a \`<Dialog>\` (from \`src/components/ui/dialog.tsx\`) with a full certificate preview and a "Download PDF" button.
- [ ] The empty state (no certificates yet) should show an encouraging message with a link to Browse Events.
- [ ] Add an entrance animation to each card using staggered CSS animation delay.

## 🗂️ Files to Modify
- \`src/routes/certificates.tsx\`

## 💡 Hints
- The \`<Dialog>\` component is at \`src/components/ui/dialog.tsx\`.
- For staggered animation, use \`style={{ animationDelay: \`\${index * 100}ms\` }}\` on each card.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement", "design"],
  },

  // ── Auth Page ─────────────────────────────────────────────────────────────
  {
    title: "[Frontend] Add 'Show/Hide Password' Toggle to Auth Page Password Fields",
    body: `## 📋 Summary
The Auth page (\`auth.tsx\`) has a password field, but users cannot toggle its visibility. The \`password-input.tsx\` component already exists but may not be used in the auth form. We should wire it up.

## 🎯 Background
File: \`src/routes/auth.tsx\`, \`src/components/ui/password-input.tsx\`

The \`password-input.tsx\` component already implements show/hide toggle logic. The Auth page should use this component instead of a raw \`<input type="password">\`.

## ✅ Acceptance Criteria
- [ ] Replace the plain password \`<input>\` in \`auth.tsx\` with \`<PasswordInput>\` from \`@/components/ui/password-input\`.
- [ ] The eye icon should toggle between showing/hiding the password text.
- [ ] Ensure the toggle button has \`aria-label="Show password"\` / \`"Hide password"\` for accessibility.
- [ ] The "Confirm Password" field (if present on sign-up) should also use \`PasswordInput\`.
- [ ] Verify no auto-complete or browser password manager conflicts.

## 🗂️ Files to Modify
- \`src/routes/auth.tsx\`
- \`src/components/ui/password-input.tsx\` — Review and update if needed

## 💡 Hints
- \`PasswordInput\` is at \`src/components/ui/password-input.tsx\`.
- Use \`autoComplete="current-password"\` or \`"new-password"\` per field.`,
    labels: ["ECSoC26", "frontend", "good-issue", "accessibility"],
  },

  {
    title: "[Frontend] Add Animated Transition Between Sign In and Sign Up Tabs on Auth Page",
    body: `## 📋 Summary
The Auth page (\`auth.tsx\`) switches between Sign In and Sign Up modes, but the transition is instantaneous. Adding a smooth animated transition between these two modes will improve the perceived polish of the app.

## 🎯 Background
File: \`src/routes/auth.tsx\`

The auth page likely uses conditional rendering or a tab state. We should add a CSS transition so the form content slides or fades when switching modes.

## ✅ Acceptance Criteria
- [ ] When switching between Sign In and Sign Up, animate the form content with a fade + slight slide animation.
- [ ] Use CSS classes and \`useState\` key trick or \`transition-opacity\` for the effect.
- [ ] The form heading should also animate to reflect the mode change.
- [ ] Animation duration should be ≤ 250ms to feel snappy.
- [ ] Works on both mobile and desktop.

## 🗂️ Files to Modify
- \`src/routes/auth.tsx\`
- \`src/styles.css\` — Add animation class if needed

## 💡 Hints
- Add a unique \`key={mode}\` to the form element to trigger React's unmount/remount animation.
- Or use \`tw-animate-css\` classes (already in dependencies): \`animate-in fade-in slide-in-from-top-2\`.`,
    labels: ["ECSoC26", "frontend", "good-ui", "design"],
  },

  // ── Global / Shared Components ─────────────────────────────────────────────
  {
    title: "[Frontend] Implement Global Toast Notification Placement and Styling Customization",
    body: `## 📋 Summary
The app uses \`sonner\` for toast notifications, but the toaster's position and visual style haven't been customized to match the project's neubrutalism design language. We should configure it globally.

## 🎯 Background
File: \`src/components/ui/sonner.tsx\`, \`src/main.tsx\` or layout file

Sonner's \`<Toaster>\` component accepts props like \`position\`, \`toastOptions\`, and \`theme\` that we haven't configured.

## ✅ Acceptance Criteria
- [ ] Set the Toaster \`position\` to \`"bottom-right"\` globally.
- [ ] Configure \`toastOptions\` to use the project's font (\`font-mono\`) and add a \`border-2 border-black\` (neubrutalism) class.
- [ ] Error toasts should have a \`bg-peach\` or red accent.
- [ ] Success toasts should have a \`bg-lime\` accent.
- [ ] Test on multiple pages (events RSVP, settings save) to confirm styling.

## 🗂️ Files to Modify
- \`src/components/ui/sonner.tsx\`
- \`src/App.tsx\` or \`src/main.tsx\`

## 💡 Hints
- \`<Toaster toastOptions={{ classNames: { toast: 'neu-border font-mono' } }}\` is the approach.
- Refer to the [Sonner docs](https://sonner.emilkowal.ski/toaster) for available props.`,
    labels: ["ECSoC26", "frontend", "good-issue", "UI/UX", "design"],
  },

  {
    title: "[Frontend] Add 'Back to Top' Button with Scroll-Progress Indicator",
    body: `## 📋 Summary
The app has a \`ScrollToTop\` component that auto-scrolls on route change, but there's no visible "Back to Top" button for long pages (Events, Feed, Clubs). We should add one with a scroll-progress ring indicator.

## 🎯 Background
File: \`src/components/ScrollToTop.tsx\`

The existing \`ScrollToTop\` only handles programmatic scrolling on route change. We need a user-visible sticky button.

## ✅ Acceptance Criteria
- [ ] Add a fixed "Back to Top" button (\`ArrowUp\` from Lucide) in the bottom-right corner.
- [ ] The button should only appear when the user has scrolled > 300px from top.
- [ ] Add a circular SVG progress indicator around the button that fills as the user scrolls.
- [ ] Clicking the button smoothly scrolls to the top (\`window.scrollTo({ top: 0, behavior: 'smooth' })\`).
- [ ] The button must have \`aria-label="Back to top"\` and not interfere with the Toaster.

## 🗂️ Files to Modify
- \`src/components/ScrollToTop.tsx\` — Or create \`src/components/BackToTop.tsx\`
- \`src/components/Layout.tsx\` — Mount the component globally

## 💡 Hints
- Use \`useEffect\` with a \`scroll\` event listener and \`window.scrollY\` for visibility.
- The SVG circle progress: \`stroke-dashoffset\` driven by scroll percentage.`,
    labels: ["ECSoC26", "frontend", "good-pr", "UI/UX", "accessibility"],
  },

  {
    title: "[Frontend] Implement Dark Mode Persistence Using localStorage and System Preference",
    body: `## 📋 Summary
The Navbar has a \`<ThemeToggle>\` component, but dark mode preference is not persisted across page reloads or browser sessions. We need to save the preference to \`localStorage\` and also respect the OS-level \`prefers-color-scheme\` on first visit.

## 🎯 Background
File: \`src/components/ThemeToggle.tsx\`

The ThemeToggle exists and likely sets a CSS class, but without localStorage persistence, the user's preference is lost on reload.

## ✅ Acceptance Criteria
- [ ] On first visit, read \`window.matchMedia('(prefers-color-scheme: dark)').matches\` and apply the \`dark\` class accordingly.
- [ ] When the user toggles the theme, save the preference: \`localStorage.setItem('cc-theme', 'dark'|'light')\`.
- [ ] On subsequent visits, read from \`localStorage\` first, then fall back to system preference.
- [ ] Apply the \`dark\` class to \`document.documentElement\` (not \`body\`).
- [ ] Ensure no Flash Of Unstyled Content (FOUC) on load — apply theme before React hydrates.

## 🗂️ Files to Modify
- \`src/components/ThemeToggle.tsx\`
- \`index.html\` — Add an inline script to set theme class before React loads

## 💡 Hints
- Add a \`<script>\` tag in \`index.html\` \`<head>\` that reads localStorage and applies \`dark\` class immediately.
- This prevents the white flash before React mounts.`,
    labels: ["ECSoC26", "frontend", "good-pr", "enhancement"],
  },

  {
    title: "[Frontend] Add Keyboard Navigation Support to Mobile Navigation Menu",
    body: `## 📋 Summary
The mobile navigation menu (\`mobileMenuOpen\`) is not keyboard-accessible. When opened via the hamburger button, users cannot navigate menu items with Tab/Enter/Escape keys. This is a critical accessibility gap.

## 🎯 Background
File: \`src/components/site/Navbar.tsx\`

The mobile nav renders conditionally when \`mobileMenuOpen === true\`. It lacks: focus trapping, Escape key close, and proper \`aria\` attributes.

## ✅ Acceptance Criteria
- [ ] When the mobile menu opens, focus moves to the first navigation link automatically.
- [ ] Pressing \`Escape\` closes the menu and returns focus to the hamburger button.
- [ ] Tab key navigates through menu items; Tab on the last item wraps to the close button.
- [ ] The hamburger button \`aria-controls\` attribute references the nav element by ID.
- [ ] The nav element has \`role="dialog"\` and \`aria-modal="true"\` when open.

## 🗂️ Files to Modify
- \`src/components/site/Navbar.tsx\`

## 💡 Hints
- Use a \`useEffect\` with a \`keydown\` event listener for Escape key handling.
- Focus trapping: capture Tab keydown and use \`firstFocusable.focus()\` / \`lastFocusable.focus()\`.`,
    labels: ["ECSoC26", "frontend", "good-pr", "accessibility"],
  },

  {
    title: "[Frontend] Add Responsive Breadcrumb Navigation to Nested Routes (Clubs, Events)",
    body: `## 📋 Summary
Deep pages like \`/clubs/tech-club\` or \`/events/abc123\` don't show the user where they are in the navigation hierarchy. Adding breadcrumb navigation improves orientation, especially on mobile.

## 🎯 Background
Files: \`src/routes/clubs.$slug.tsx\`, \`src/routes/events.$eventId.tsx\`

The \`breadcrumb.tsx\` UI component already exists at \`src/components/ui/breadcrumb.tsx\`. We just need to use it on the right pages.

## ✅ Acceptance Criteria
- [ ] Add breadcrumbs to \`clubs.$slug.tsx\`: Home > Clubs > {Club Name}
- [ ] Add breadcrumbs to \`events.$eventId.tsx\`: Home > Events > {Event Title}
- [ ] Each breadcrumb link should be clickable and route-correct.
- [ ] On mobile (\`< sm\`), show only the immediate parent (e.g., "← Clubs").
- [ ] The breadcrumb should have proper \`aria-label="Breadcrumb"\` and \`aria-current="page"\` on the last item.

## 🗂️ Files to Modify
- \`src/routes/clubs.$slug.tsx\`
- \`src/routes/events.$eventId.tsx\`
- \`src/components/ui/breadcrumb.tsx\` — Review existing implementation

## 💡 Hints
- \`<Breadcrumb>\`, \`<BreadcrumbItem>\`, \`<BreadcrumbLink>\` are all in the existing breadcrumb component.
- On mobile, use \`hidden sm:block\` to show/hide breadcrumb items conditionally.`,
    labels: ["ECSoC26", "frontend", "good-issue", "accessibility"],
  },

  {
    title: "[Frontend] Add Loading Progress Bar at Top of Page During Route Transitions",
    body: `## 📋 Summary
When navigating between routes (e.g., from Events to a specific Event detail), there's no visual loading indicator. Adding a thin progress bar at the top of the page (similar to YouTube/GitHub) gives feedback during navigation.

## 🎯 Background
File: \`src/components/Layout.tsx\`, \`src/App.tsx\`

React Router's navigation events can be listened to via \`useNavigation\` from \`react-router-dom\`. We can show/hide a top progress bar based on navigation state.

## ✅ Acceptance Criteria
- [ ] Create a \`<TopProgressBar>\` component that renders a fixed, thin (\`h-1\`) bar at the top of the page.
- [ ] The bar should animate from 0% to ~80% while navigation is in progress, then jump to 100% and fade out.
- [ ] Use \`useNavigation()\` from \`react-router-dom\` to detect \`navigation.state === 'loading'\`.
- [ ] Color should be the brand accent: \`bg-[#f5c66b]\`.
- [ ] The bar should be above the Navbar (\`z-50\`).

## 🗂️ Files to Modify
- \`src/components/Layout.tsx\`
- New file: \`src/components/TopProgressBar.tsx\`

## 💡 Hints
- \`useNavigation\` from \`react-router-dom\` gives \`navigation.state\` = \`'idle' | 'loading' | 'submitting'\`.
- Animate width with \`transition-[width]\` and control it via React state.`,
    labels: ["ECSoC26", "frontend", "good-pr", "UI/UX"],
  },

  {
    title: "[Frontend] Implement Infinite Scroll for Discussion Feed Posts",
    body: `## 📋 Summary
The Discussion Feed currently loads all posts at once, which will become a performance issue as the app grows. We should implement infinite scroll to load posts in batches of 10 as the user scrolls to the bottom.

## 🎯 Background
File: \`src/routes/feed.tsx\`

The Clubs directory (\`clubs.index.tsx\`) already uses \`useInfiniteQuery\` with a "Load More" button. We should apply infinite scroll (automatic triggering) to the Feed instead.

## ✅ Acceptance Criteria
- [ ] Switch the feed \`useQuery\` to \`useInfiniteQuery\` with \`POSTS_PER_PAGE = 10\`.
- [ ] Use an \`IntersectionObserver\` on a sentinel div at the bottom to trigger \`fetchNextPage()\`.
- [ ] Show a skeleton loader for the next batch of posts while fetching.
- [ ] Show "You're all caught up! 🎉" when no more posts are available.
- [ ] Maintain scroll position on data refetch.

## 🗂️ Files to Modify
- \`src/routes/feed.tsx\`
- \`src/hooks/useReactQueryReplacement.ts\` — Confirm \`useInfiniteQuery\` is exported

## 💡 Hints
- Sentinel div pattern: \`<div ref={sentinelRef} aria-hidden="true" />\`
- \`IntersectionObserver\` fires \`fetchNextPage()\` when sentinel enters viewport.
- Refer to the \`clubs.index.tsx\` implementation for the \`useInfiniteQuery\` pattern.`,
    labels: ["ECSoC26", "frontend", "good-pr", "enhancement"],
  },

  {
    title: "[Frontend] Add Event Detail Page Hero with Banner Image and RSVP Count",
    body: `## 📋 Summary
The Event detail page (\`events.$eventId.tsx\`) needs a visually rich hero section that displays the event's banner image (if available), a large RSVP count, and a prominent RSVP call-to-action button.

## 🎯 Background
File: \`src/routes/events.$eventId.tsx\`

The event data includes a \`banner_url\` field. The current detail page may not be using it prominently in the hero.

## ✅ Acceptance Criteria
- [ ] If \`event.banner_url\` exists, display it as a full-width hero image with a dark overlay for text readability.
- [ ] Show the event title, date, location, and organizer club name over the hero image.
- [ ] Display the RSVP count prominently (e.g., "47 people going").
- [ ] Add a large RSVP CTA button that is sticky on mobile (fixed bottom bar).
- [ ] If no banner image, fall back to a gradient background using the event's color slot.

## 🗂️ Files to Modify
- \`src/routes/events.$eventId.tsx\`

## 💡 Hints
- Use \`object-cover\` CSS class for the banner image to fill the hero area.
- A sticky RSVP bar on mobile: \`fixed bottom-0 left-0 right-0 z-30\` with padding.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement", "design"],
  },

  {
    title: "[Frontend] Add User Avatar Dropdown Menu in Navbar with Quick Links",
    body: `## 📋 Summary
The Navbar shows the user's initial in a circle that links to \`/dashboard\`. This should be converted into a dropdown menu with quick links to Dashboard, Settings, and Sign Out — following a standard app header pattern.

## 🎯 Background
File: \`src/components/site/Navbar.tsx\`

Currently clicking the avatar circle navigates to \`/dashboard\`. A dropdown gives users faster access to key pages without adding more links to the navbar.

## ✅ Acceptance Criteria
- [ ] Wrap the avatar circle in a \`<DropdownMenu>\` from \`@/components/ui/dropdown-menu\`.
- [ ] The dropdown should include: Dashboard (\`/dashboard\`), Settings (\`/settings\`), and Sign Out (calls \`supabase.auth.signOut()\`).
- [ ] Display the user's email at the top of the dropdown (non-clickable, informational).
- [ ] The dropdown should close when clicking outside or pressing Escape.
- [ ] Sign Out should navigate to \`/\` after the Supabase session is cleared.

## 🗂️ Files to Modify
- \`src/components/site/Navbar.tsx\`

## 💡 Hints
- \`<DropdownMenu>\`, \`<DropdownMenuTrigger>\`, \`<DropdownMenuContent>\`, \`<DropdownMenuItem>\` are at \`src/components/ui/dropdown-menu.tsx\`.
- After sign out: \`await supabase.auth.signOut(); navigate('/')\`.`,
    labels: ["ECSoC26", "frontend", "good-pr", "UI/UX"],
  },

  {
    title:
      "[Frontend] Add Skeleton Loaders for All Data-Fetching Pages (Feed, Clubs, Certificates)",
    body: `## 📋 Summary
While Events and Profile pages have skeleton loaders, the Discussion Feed, Club Directory load spinner, and Certificates page show bare loading states. We should add consistent skeleton UI across all data-fetching pages.

## 🎯 Background
Files: \`src/routes/feed.tsx\`, \`src/routes/clubs.index.tsx\`, \`src/routes/certificates.tsx\`

The \`<Skeleton>\` component is at \`src/components/ui/skeleton.tsx\` and is already used in \`EventCardSkeleton.tsx\`. We need similar skeleton patterns for other pages.

## ✅ Acceptance Criteria
- [ ] **Feed Page**: Add 3-5 post skeleton cards mimicking the article layout (avatar, author line, content block, reaction bar).
- [ ] **Club Directory**: The existing \`animate-pulse\` div skeletons look good — verify they render correctly during \`isLoading\`.
- [ ] **Certificates Page**: Add certificate card skeletons (image placeholder, title, date).
- [ ] All skeletons must use the \`<Skeleton>\` base component for consistency.
- [ ] Skeletons should be visually representative of the actual content layout.

## 🗂️ Files to Modify
- \`src/routes/feed.tsx\`
- \`src/routes/certificates.tsx\`
- New files: \`src/components/FeedPostSkeleton.tsx\`, \`src/components/CertificateCardSkeleton.tsx\`

## 💡 Hints
- \`<Skeleton className="h-4 w-3/4" />\` from \`src/components/ui/skeleton.tsx\`.
- Render \`Array.from({ length: N }).map((_, i) => <FeedPostSkeleton key={i} />)\` while \`isLoading\`.`,
    labels: ["ECSoC26", "frontend", "good-issue", "UI/UX"],
  },

  {
    title: "[Frontend] Add Notification Badge Counter on Navbar Bell Icon",
    body: `## 📋 Summary
The Navbar has a \`<NavbarNotificationDropdown>\` component but it doesn't show a badge counter for unread notifications. Adding a red badge with the unread count gives users immediate awareness of pending items.

## 🎯 Background
File: \`src/components/site/NavbarNotificationDropdown.tsx\`

The notification dropdown exists. We need to add a badge overlay on the bell icon showing the count of unread notifications.

## ✅ Acceptance Criteria
- [ ] Query unread notification count from Supabase (filter by \`read_at IS NULL\` and \`user_id\`).
- [ ] If count > 0, show a red badge on the bell icon: a small circle (\`h-4 w-4\`) with the count number.
- [ ] If count > 9, show "9+" instead of the actual number.
- [ ] The badge should update in real-time using Supabase channel subscription.
- [ ] When the dropdown is opened and notifications are read, the badge count should decrement.

## 🗂️ Files to Modify
- \`src/components/site/NavbarNotificationDropdown.tsx\`
- \`src/components/site/Navbar.tsx\` — Ensure badge is positioned correctly over the bell icon

## 💡 Hints
- Use \`position: absolute\` with \`-top-1 -right-1\` for badge positioning.
- A Supabase channel on the \`notifications\` table can push real-time count updates.`,
    labels: ["ECSoC26", "frontend", "good-ui", "enhancement"],
  },
];

// ─── 4. Main Creation Logic ────────────────────────────────────────────────────
async function createNewFrontendIssues() {
  console.log(`\n🚀 CampusConnect — Frontend Issues Creation Script`);
  console.log(`📦 Repository: ${GITHUB_REPO}`);
  console.log(`📝 Total issues to create: ${newFrontendIssues.length}\n`);

  // First fetch all existing issues (open + closed) to avoid duplicates
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

  for (let index = 0; index < newFrontendIssues.length; index++) {
    const issue = newFrontendIssues[index];
    const issueNum = String(index + 1).padStart(2, "0");

    if (existingTitles.has(issue.title)) {
      console.log(
        `⏩ [${issueNum}/${newFrontendIssues.length}] SKIP  — "${issue.title.slice(0, 70)}..."`,
      );
      skippedCount++;
      continue;
    }

    console.log(
      `➕ [${issueNum}/${newFrontendIssues.length}] CREATE — "${issue.title.slice(0, 70)}..."`,
    );

    const res = await githubRequest("/issues", "POST", issue);

    if (res) {
      createdCount++;
      console.log(`   ✅ Created: #${res.number} — ${res.html_url}`);
    } else {
      console.log(`   ❌ Failed to create this issue.`);
    }

    // Delay 1.5 seconds between requests to respect GitHub's secondary rate limits
    if (index < newFrontendIssues.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`🎉 Done!`);
  console.log(`   ✅ Created : ${createdCount} issues`);
  console.log(`   ⏩ Skipped : ${skippedCount} issues (already existed)`);
  console.log(`   📊 Total   : ${newFrontendIssues.length} issues processed`);
  console.log(`${"─".repeat(60)}\n`);
}

createNewFrontendIssues();
