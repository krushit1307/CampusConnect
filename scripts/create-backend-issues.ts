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
  "User-Agent": "CampusConnect-Backend-Issues-Script",
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

// ─── 3. The 30 New Backend & Database Issues Payload ─────────────────────────
const newBackendIssues = [
  {
    title: "[Backend] Implement auto-updating updated_at trigger for all tables",
    body: `## 📋 Summary
Currently, our tables have \`updated_at\` columns, but they are not automatically updated when rows are modified. We should implement a reusable PostgreSQL trigger function that updates \`updated_at\` to the current timestamp on UPDATE.

## 🎯 Background
File: \`supabase/schema.sql\`

We have \`updated_at TIMESTAMPTZ DEFAULT NOW()\` on tables like \`profiles\`, \`clubs\`, \`events\`, \`posts\`, and \`comments\`. Without an UPDATE trigger, these columns remain static unless updated manually by the client application.

## ✅ Acceptance Criteria
- [ ] Create a reusable PostgreSQL function \`update_updated_at_column()\` that sets \`NEW.updated_at = NOW(); RETURN NEW;\`.
- [ ] Create triggers on tables: \`profiles\`, \`clubs\`, \`events\`, \`posts\`, and \`comments\`.
- [ ] Create a new migration file containing this function and its associated trigger setup.

## 🗂️ Files to Modify
- \`supabase/schema.sql\` (for future setups)
- New file: \`supabase/migrations/20260716000001_auto_updated_at.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "refactor"],
  },
  {
    title: "[Database] Add dynamic RSVP limits (max_attendees) column to events table",
    body: `## 📋 Summary
Currently, there is no way to restrict the number of RSVPs for an event. We need to add a \`max_attendees\` column to the \`events\` table to allow organizers to cap the attendance.

## 🎯 Background
File: \`supabase/schema.sql\`

The \`events\` table tracks the event details but lacks a constraint or storage for max capacity. 

## ✅ Acceptance Criteria
- [ ] Create a SQL migration to add \`max_attendees\` (nullable INTEGER, must be > 0) to the \`events\` table.
- [ ] Ensure that existing events default to \`NULL\` (unlimited capacity).
- [ ] Add check constraints to guarantee \`max_attendees\` cannot be negative or zero.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000002_add_max_attendees.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "enhancement"],
  },
  {
    title: "[Backend] Add PostgreSQL trigger to enforce event RSVP capacity limits",
    body: `## 📋 Summary
After adding the \`max_attendees\` column, we need backend validation to prevent new RSVPs from being created if the event has reached its maximum capacity.

## 🎯 Background
File: \`supabase/schema.sql\`

RLS and simple inserts don't block additional inserts once capacity is reached. A trigger function running \`BEFORE INSERT\` on \`event_rsvps\` is the most reliable way to enforce this in the database.

## ✅ Acceptance Criteria
- [ ] Create a PostgreSQL function \`check_event_capacity()\` that counts rows in \`event_rsvps\` for \`NEW.event_id\` and compares it with \`max_attendees\` of the event.
- [ ] If capacity is exceeded, raise an exception to abort the transaction.
- [ ] Bind this function as a \`BEFORE INSERT\` trigger on the \`event_rsvps\` table.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000003_enforce_rsvp_capacity.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Database] Add indexes on foreign keys to optimize query performance",
    body: `## 📋 Summary
To keep queries fast as database tables grow, we need indexes on frequently queried foreign key fields that are used for joins or where clauses.

## 🎯 Background
File: \`supabase/schema.sql\`

We have a custom index \`idx_events_category\`, but several foreign keys like \`club_members(club_id)\`, \`club_members(user_id)\`, \`posts(author_id)\`, and \`comments(post_id)\` do not have explicit indexes.

## ✅ Acceptance Criteria
- [ ] Write a migration script containing \`CREATE INDEX\` statements for:
  - \`club_members(club_id)\`
  - \`club_members(user_id)\`
  - \`event_rsvps(event_id)\`
  - \`event_rsvps(user_id)\`
  - \`posts(club_id)\`
  - \`comments(post_id)\`
- [ ] Run \`EXPLAIN ANALYZE\` or trace before/after query execution times to verify indexing benefits.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000004_add_fk_indexes.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "refactor"],
  },
  {
    title: "[Backend] Create trigger to auto-manage member_count in clubs table",
    body: `## 📋 Summary
Querying the \`club_members\` table recursively to get the number of members can become a bottleneck. We should denormalize this by adding a \`member_count\` column to \`clubs\` and updating it with database triggers.

## 🎯 Background
File: \`supabase/schema.sql\`

Currently, fetching clubs uses joining and counting members. A static integer is much faster to load on the index page.

## ✅ Acceptance Criteria
- [ ] Create a migration to add \`member_count\` (default 0, NOT NULL) to the \`clubs\` table.
- [ ] Create trigger functions on \`club_members\` to increment/decrement \`member_count\` in the respective row in \`clubs\` on insert, update (status change to 'approved'), or delete.
- [ ] Write a query in the migration to backfill existing member counts.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000005_club_member_count_trigger.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "refactor"],
  },
  {
    title: "[Backend] Implement database-level soft delete trigger for posts and comments",
    body: `## 📋 Summary
We need to ensure that when a post is soft-deleted, we don't fetch its comments, or we mark the comments as deleted too, depending on database referential integrity.

## 🎯 Background
File: \`supabase/schema.sql\`

The \`posts\` table has a \`deleted_at\` column for soft deletes, but comments lack soft delete support.

## ✅ Acceptance Criteria
- [ ] Add \`deleted_at\` (TIMESTAMPTZ) to \`comments\` table.
- [ ] Write a trigger on \`posts\` that updates \`comments\` set \`deleted_at = NEW.deleted_at\` when a post's \`deleted_at\` is changed.
- [ ] Ensure SELECT queries on comments filter out deleted comments.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000006_soft_delete_cascade.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "refactor"],
  },
  {
    title: "[Backend] Add postgres function to check club admin privileges for RLS policies",
    body: `## 📋 Summary
Several RLS policies duplicate the subquery check for whether a user is an approved admin of a club. We should extract this check into a security definer function for cleaner policy management and performance.

## 🎯 Background
File: \`supabase/schema.sql\`

Subqueries like \`EXISTS (SELECT 1 FROM club_members ...)\` are used across multiple tables (\`clubs\`, \`events\`, \`event_rsvps\`).

## ✅ Acceptance Criteria
- [ ] Create a function \`is_club_admin(club_id UUID, user_id UUID)\` returning \`BOOLEAN\` with \`SECURITY DEFINER\`.
- [ ] Update \`clubs\`, \`events\`, and \`event_rsvps\` RLS policies to use this function.
- [ ] Ensure function executes efficiently (indexed check).

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000007_helper_rls_functions.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Database] Add unique constraint on join requests to prevent duplicate applications",
    body: `## 📋 Summary
To prevent users from spamming the database with duplicate membership requests to the same club, we need a unique constraint at the database layer.

## 🎯 Background
File: \`supabase/schema.sql\`

The \`club_members\` table currently has a unique constraint: \`UNIQUE(club_id, user_id)\`. We must ensure this handles status updates and deleted records properly if they are soft deleted, or verify it strictly blocks duplicates.

## ✅ Acceptance Criteria
- [ ] Verify if \`UNIQUE(club_id, user_id)\` exists and covers all insert cases.
- [ ] If we need to support past members joining again, modify the constraint or add a partial unique index: \`CREATE UNIQUE INDEX ON club_members(club_id, user_id) WHERE status = 'pending' OR status = 'approved';\`
- [ ] Test that duplicate requests throw a handled Postgres exception.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000008_club_membership_uniqueness.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Backend] Create Edge Function to send weekly summary email digests using Resend",
    body: `## 📋 Summary
We want to notify users of active discussion posts and new events weekly. Create a Supabase Edge Function that acts as a cron trigger or callable webhook to dispatch weekly summary emails.

## 🎯 Background
File: \`supabase/functions/send-event-emails\`

We have a directory for \`send-event-emails\`, but we need a specific edge function pattern for recurring digests.

## ✅ Acceptance Criteria
- [ ] Implement a Deno edge function using \`@supabase/supabase-js\` to fetch active items from the past 7 days.
- [ ] Connect to the Resend API to dispatch templates to students.
- [ ] Secure the function using a secret token or Supabase authorization headers.

## 🗂️ Files to Modify
- New file/directory: \`supabase/functions/weekly-digest/index.ts\``,
    labels: ["ECSoC26", "backend", "good-backend", "enhancement"],
  },
  {
    title: "[Database] Implement audit log table and triggers for administrative club changes",
    body: `## 📋 Summary
To trace administrative actions (like changing roles or updating event details), we should build an audit logging system at the database layer.

## 🎯 Background
File: \`supabase/schema.sql\`

Currently, if an admin changes someone's role or deletes an event, there is no log showing who did it.

## ✅ Acceptance Criteria
- [ ] Create an \`audit_logs\` table mapping user, action, target table, and details (JSONB).
- [ ] Add trigger functions on \`clubs\`, \`events\`, and \`club_members\` to log insertions, updates, and deletions.
- [ ] Ensure RLS on \`audit_logs\` restricts read access to system admins.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000009_create_audit_logs.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title:
      "[Backend] Write database trigger to automatically issue event certificates upon check-in",
    body: `## 📋 Summary
When an organizer marks an attendee as checked-in (\`checked_in = TRUE\` in \`event_rsvps\`), we want to automatically insert a pending row in the \`certificates\` table.

## 🎯 Background
File: \`supabase/schema.sql\`

Currently, certificates are added manually or by an external flow. A trigger simplifies this.

## ✅ Acceptance Criteria
- [ ] Create a trigger function that fires \`AFTER UPDATE\` on \`event_rsvps\` when \`checked_in\` changes from \`FALSE\` to \`TRUE\`.
- [ ] The trigger should insert a row into \`certificates\` (with a temporarily empty url or placeholder).
- [ ] Ensure it doesn't create duplicate certificate rows.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000010_auto_issue_certs_trigger.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "enhancement"],
  },
  {
    title: "[Backend] Refactor RLS policies on event_rsvps to prevent unauthorized updates",
    body: `## 📋 Summary
The current RLS policy allows users to update RSVPs, but we must ensure they can only update their own records and cannot mark themselves as checked-in. Only event organizers should toggle \`checked_in\`.

## 🎯 Background
File: \`supabase/schema.sql\` (lines 146-157)

The policies for \`event_rsvps\` do not restrict column-level changes.

## ✅ Acceptance Criteria
- [ ] Split policies into \`UPDATE\` for user (toggling RSVP) and \`UPDATE\` for admin (toggling check-in).
- [ ] Restrict user's update permission to exclude modification of the \`checked_in\` column (using trigger check or conditional RLS).
- [ ] Verify with tests that students cannot check themselves in.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000011_secure_rsvp_rls.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Backend] Add rate limiting logic to supabase edge functions",
    body: `## 📋 Summary
We need to protect our edge functions (like \`toggle-rsvp\`) from abuse and spam. Implement a rate-limiting middleware in Deno using Upstash Redis or a database-backed token bucket.

## 🎯 Background
File: \`supabase/functions/toggle-rsvp/index.ts\`

Currently, any authorized user can request the endpoint repeatedly.

## ✅ Acceptance Criteria
- [ ] Write a middleware helper that parses the caller's IP or user ID.
- [ ] Track request frequency and reject requests exceeding 10 per minute with HTTP 429.
- [ ] Document setup steps in the function folder.

## 🗂️ Files to Modify
- \`supabase/functions/toggle-rsvp/index.ts\`
- New file: \`supabase/functions/shared/rate-limit.ts\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Database] Implement database schema versioning and migration verification guidelines",
    body: `## 📋 Summary
Contributors adding database migrations need a local verification checklist to verify database migrations cleanly apply and roll back.

## 🎯 Background
We run migrations locally but lack a CI validation step checking migration integrity.

## ✅ Acceptance Criteria
- [ ] Add a guide in \`supabase/README.md\` detailing Supabase CLI migration testing flow (\`supabase db reset\`).
- [ ] Include instructions for writing down-migrations (rollbacks).

## 🗂️ Files to Modify
- \`supabase/README.md\` (or create it)`,
    labels: ["ECSoC26", "backend", "good-issue", "docs"],
  },
  {
    title: "[Backend] Create Edge Function for bulk importing student CSV rosters to clubs",
    body: `## 📋 Summary
Club admins need a fast way to invite many members at once. Build an edge function that processes an uploaded CSV file containing email addresses and creates pending invitations in \`club_members\`.

## 🎯 Background
File: \`supabase/functions/\`

Organizers currently have to add members manually in the system.

## ✅ Acceptance Criteria
- [ ] Create a Deno Edge Function \`bulk-invite-members\`.
- [ ] The function should parse incoming multipart form-data (CSV file).
- [ ] For each valid email, resolve their profile ID and insert them into \`club_members\` as \`pending\`.
- [ ] Return summary of succeeded/failed matches.

## 🗂️ Files to Modify
- New file/directory: \`supabase/functions/bulk-invite-members/index.ts\``,
    labels: ["ECSoC26", "backend", "good-backend", "enhancement"],
  },
  {
    title: "[Database] Add event feedback ratings table and average rating computing triggers",
    body: `## 📋 Summary
To measure event success, we want attendees to rate events they checked into. Add a feedback table and database triggers to calculate average ratings on the event row.

## 🎯 Background
File: \`supabase/schema.sql\`

We do not store attendee event ratings in the database.

## ✅ Acceptance Criteria
- [ ] Create an \`event_feedbacks\` table: \`event_id\`, \`user_id\`, \`rating\` (INT 1-5), \`comment\` (TEXT).
- [ ] Add an RLS policy: only users checked into the event (\`checked_in = TRUE\` in \`event_rsvps\`) can leave feedback.
- [ ] Write a trigger on \`event_feedbacks\` to update \`average_rating\` on the \`events\` table.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000012_event_feedback_table.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "enhancement"],
  },
  {
    title: "[Backend] Implement tag/category management postgres functions for admin routes",
    body: `## 📋 Summary
To allow admins to create new event categories, we need helper PostgreSQL functions that securely check system admin privileges before updating \`event_categories\`.

## 🎯 Background
File: \`supabase/schema.sql\` (lines 40-45)

The table \`event_categories\` is read-only for public, and write is not configured.

## ✅ Acceptance Criteria
- [ ] Write RLS policies for \`event_categories\` to allow INSERT/UPDATE/DELETE if the user is a system admin.
- [ ] Create helper function to check system administrator role.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000013_event_categories_write_access.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Database] Add a notification preferences JSONB column and migration for profiles",
    body: `## 📋 Summary
To support granular notification options, add a \`notification_preferences\` JSONB column to the \`profiles\` table with default settings.

## 🎯 Background
File: \`supabase/schema.sql\`

The settings page saves checkboxes to local state, but we need a DB field to store these preferences permanently.

## ✅ Acceptance Criteria
- [ ] Add \`notification_preferences\` JSONB column to \`profiles\`.
- [ ] Set default value to \`'{"rsvps": true, "digest": true, "certs": true}'::jsonb\`.
- [ ] Add check constraints to ensure JSON structure remains valid.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000014_profile_notification_prefs.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "refactor"],
  },
  {
    title: "[Backend] Edge function validation: Verify JWT token authenticity and roles",
    body: `## 📋 Summary
Ensure all custom Edge Functions check the JWT authorization token correctly and extract user context securely.

## 🎯 Background
File: \`supabase/functions/shared/\`

Custom functions might parse headers manually or bypass proper validation.

## ✅ Acceptance Criteria
- [ ] Create a shared middleware function \`verifyAuth(req)\` that validates the Bearer token.
- [ ] Reject requests with invalid tokens with HTTP 401.
- [ ] Add tests or documentation explaining how functions should import and utilize this utility.

## 🗂️ Files to Modify
- New file: \`supabase/functions/shared/auth-middleware.ts\``,
    labels: ["ECSoC26", "backend", "good-issue", "security"],
  },
  {
    title: "[Database] Add tags array to events table and migration",
    body: `## 📋 Summary
Events need search terms or keywords. Add a \`tags\` column (text array \`TEXT[]\`) to the \`events\` table so organizers can tag events with relevant topics (e.g. \`{"react", "coding", "design"}\`).

## 🎯 Background
File: \`supabase/schema.sql\`

We have category filters, but freeform tagging will provide a much better search capability.

## ✅ Acceptance Criteria
- [ ] Create migration script adding \`tags TEXT[] DEFAULT '{}'::text[]\` column to \`events\`.
- [ ] Add a GIN index on \`tags\` to make array-overlap queries fast.
- [ ] Verify that empty array is populated if no tags are supplied.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000015_add_event_tags_column.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "enhancement"],
  },
  {
    title:
      "[Backend] Supabase Storage: Enforce max file size and type validation in bucket policies",
    body: `## 📋 Summary
Currently, our storage policies allow users to upload files to avatars/banners, but there's no constraint on maximum size or file type in the DB policies. We must enforce file type and size restrictions.

## 🎯 Background
File: \`supabase/schema.sql\` (lines 196-281)

We rely on client-side validation for file uploads, which can be bypassed.

## ✅ Acceptance Criteria
- [ ] Update \`storage.objects\` INSERT policies to restrict file extension types (e.g. allow only PNG, JPG, WEBP).
- [ ] Add checks in policies to restrict file size to ≤ 2MB.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000016_storage_size_type_restrictions.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Database] Add profiles handle history log table to track handle changes",
    body: `## 📋 Summary
To prevent users from repeatedly swapping handles or using handles that belonged to other users recently, we need to track profile handle change history.

## 🎯 Background
File: \`supabase/schema.sql\`

Currently, changing the handle in settings leaves no record of the old handle.

## ✅ Acceptance Criteria
- [ ] Create a \`handle_history\` table: \`profile_id\`, \`old_handle\`, \`changed_at\`.
- [ ] Create a trigger on \`profiles\` table to log row updates when \`handle\` changes.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000017_track_handle_history.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Backend] DB Function: Implement search query optimizer for clubs and events",
    body: `## 📋 Summary
Instead of simple \`LIKE\` or \`ILIKE\` queries, we should implement a PostgreSQL full-text search function or optimized similarity index for search bars.

## 🎯 Background
Files: \`src/routes/clubs.index.tsx\`, \`src/routes/events.tsx\`

We are filtering results client-side or using basic queries.

## ✅ Acceptance Criteria
- [ ] Create a postgres function \`search_clubs(query_text TEXT)\` returning clubs.
- [ ] Add a tsvector index or pg_trgm extension index to optimize the query.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000018_search_optimization.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "refactor"],
  },
  {
    title: "[Backend] Write clean-up cron trigger/edge function for expired temp records",
    body: `## 📋 Summary
Expired event records, pending join requests older than 3 months, or deleted posts should be automatically cleaned up or archived.

## 🎯 Background
Expired entries sit in tables indefinitely.

## ✅ Acceptance Criteria
- [ ] Write a PostgreSQL schedule script or Supabase Edge function executing a periodic cleanup task.
- [ ] Safely archive/remove orphaned rows.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000019_cleanup_routine.sql\``,
    labels: ["ECSoC26", "backend", "good-issue", "refactor"],
  },
  {
    title: "[Database] Add event location coordinates (latitude, longitude) for map integration",
    body: `## 📋 Summary
For geographical visualization, we should store numeric latitude and longitude coordinates for event locations.

## 🎯 Background
File: \`supabase/schema.sql\`

We only store a text-based \`location\` description.

## ✅ Acceptance Criteria
- [ ] Create SQL migration adding \`latitude\` and \`longitude\` columns to \`events\`.
- [ ] Add validation constraints (latitude must be between -90 and 90, longitude between -180 and 180).

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000020_add_location_coordinates.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "enhancement"],
  },
  {
    title:
      "[Backend] Enforce profile handle constraints (no special characters except underscores) in DB",
    body: `## 📋 Summary
Ensure student handles do not contain special characters, spaces, or uppercase letters, making them URL-friendly.

## 🎯 Background
Currently, the client handles validation, but the DB should have a check constraint.

## ✅ Acceptance Criteria
- [ ] Add check constraint on \`profiles.handle\`: \`CHECK (handle ~ '^[a-z0-9_]{3,15}$')\`.
- [ ] Verify that invalid handles are rejected with standard SQL error.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000021_handle_regex_constraint.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Database] Create view for club analytics (active members, event count, average RSVPs)",
    body: `## 📋 Summary
To support administrative dashboards, create a database view that aggregates metrics per club.

## 🎯 Background
Currently we calculate these metrics through multiple client-side loops.

## ✅ Acceptance Criteria
- [ ] Create a view \`club_analytics\` that queries count of members, count of events, and average RSVPs.
- [ ] Restrict read access to authorized roles.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000022_club_analytics_view.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "refactor"],
  },
  {
    title: "[Backend] Implement database validation to prevent past-date event creation",
    body: `## 📋 Summary
To prevent organizers from accidentally creating events in the past, add validation check constraints.

## 🎯 Background
Currently, any timestamp is accepted for \`event_date\`.

## ✅ Acceptance Criteria
- [ ] Add a validation trigger on \`events\` BEFORE INSERT: \`event_date\` must be greater than \`NOW()\`.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000023_validate_event_date.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "security"],
  },
  {
    title: "[Backend] Write automated DB unit tests using pgTAP or pg_subunit",
    body: `## 📋 Summary
We need automated database tests to guarantee RLS policies and triggers function as expected.

## 🎯 Background
We have TypeScript tests, but no native SQL database tests.

## ✅ Acceptance Criteria
- [ ] Add pgTAP test scripts validating:
  - Students cannot read other users' RSVPs.
  - Unapproved members cannot create posts.

## 🗂️ Files to Modify
- New file: \`supabase/tests/rls_verification.test.sql\``,
    labels: ["ECSoC26", "backend", "good-pr", "refactor"],
  },
  {
    title: "[Database] Create table for club invite codes with expiration timestamps",
    body: `## 📋 Summary
Instead of manual requests, allow clubs to generate unique invite codes that bypass approval.

## 🎯 Background
We only support manual member join requests currently.

## ✅ Acceptance Criteria
- [ ] Create table \`club_invite_codes\`: \`club_id\`, \`code\` (unique text), \`expires_at\`, \`max_uses\`.
- [ ] Secure with RLS.

## 🗂️ Files to Modify
- New file: \`supabase/migrations/20260716000024_club_invitation_codes.sql\``,
    labels: ["ECSoC26", "backend", "good-backend", "enhancement"],
  },
];

// ─── 4. Main Creation Logic ───────────────────────────────────────────────────
async function createNewBackendIssues() {
  console.log(`\n🚀 CampusConnect — Backend Issues Creation Script`);
  console.log(`📦 Repository: ${GITHUB_REPO}`);
  console.log(`📝 Total issues to create: ${newBackendIssues.length}\n`);

  // Fetch existing issues to avoid duplicates
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

  for (let index = 0; index < newBackendIssues.length; index++) {
    const issue = newBackendIssues[index];
    const issueNum = String(index + 1).padStart(2, "0");

    if (existingTitles.has(issue.title)) {
      console.log(
        `⏩ [${issueNum}/${newBackendIssues.length}] SKIP  — "${issue.title.slice(0, 70)}..."`,
      );
      skippedCount++;
      continue;
    }

    console.log(
      `➕ [${issueNum}/${newBackendIssues.length}] CREATE — "${issue.title.slice(0, 70)}..."`,
    );

    const res = await githubRequest("/issues", "POST", issue);

    if (res) {
      createdCount++;
      createdNumbers.push(res.number);
      console.log(`   ✅ Created: #${res.number} — ${res.html_url}`);
    } else {
      console.log(`   ❌ Failed to create this issue.`);
    }

    // Delay to respect GitHub's secondary rate limits
    if (index < newBackendIssues.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`🎉 Issue Creation Done!`);
  console.log(`   ✅ Created : ${createdCount} issues`);
  console.log(`   ⏩ Skipped : ${skippedCount} issues`);
  console.log(`${"─".repeat(60)}\n`);

  if (createdNumbers.length > 0) {
    console.log(`⏳ Waiting 45 seconds for GitHub Actions to trigger and auto-assign...`);
    console.log(`   (After the wait, we will automatically run the unassign cleanup loop)`);
    await new Promise((resolve) => setTimeout(resolve, 45000));

    console.log(`\n🧹 Starting unassign cleanup loop...`);
    for (const num of createdNumbers) {
      console.log(`🗑️  Unassigning from issue #${num}...`);
      const issue = await githubRequest(`/issues/${num}`);
      if (issue) {
        const assignees: string[] = (issue.assignees || []).map((a: { login: string }) => a.login);
        if (assignees.length > 0) {
          await githubRequest(`/issues/${num}/assignees`, "DELETE", { assignees });
          console.log(`   ✅ Successfully unassigned.`);
        } else {
          console.log(`   ✅ Already unassigned.`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(`\n🎉 All unassignment cleanups completed successfully!`);
  }
}

createNewBackendIssues();
