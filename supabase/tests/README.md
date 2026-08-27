# Supabase Database Tests (pgTAP)

This directory contains database-level tests written with [pgTAP](https://pgtap.org/).

pgTAP lets us test Postgres schema objects — triggers, RPC functions, views,
constraints and RLS policies — the same way we test application code.

## What is covered

| File                                 | Subject                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `member_count_trigger.test.sql`      | The `update_club_member_count` trigger (aka `on_member_added`) that keeps `clubs.member_count` in sync via `handle_club_member_change()`.   |
| `upcoming_events_feed_rpc.test.sql`  | The event discovery RPC `public.get_upcoming_events_feed(UUID)` (upcoming/canceled filtering, ordering, RSVP counts, saved/bookmark state). |
| `club_attendance_stats_rpc.test.sql` | The attendance aggregation RPC `public.get_club_attendance_stats(UUID)` (average & median RSVPs computed in Postgres, empty-club handling). |
| `event_feedback_metrics.test.sql` | The dynamic rating system (issue #3434): `event_feedback_metrics` table, `events.rating_metrics`, score CHECK/UNIQUE constraints, and `public.get_event_feedback_metrics_summary(UUID)` aggregation + organizer authorization. |

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) (v1.11.4 or newer)
- Docker (used by the local Supabase stack)

pgTAP is preconfigured in the Supabase local development environment, so no
extra installation is needed.

## Running the tests

First start the local Supabase stack (this applies all migrations):

```bash
supabase start
```

Then run the whole database test suite:

```bash
supabase test db
```

Or run only a specific test file (pass one or more paths):

```bash
supabase test db supabase/tests/upcoming_events_feed_rpc.test.sql
```

A convenience wrapper is also provided:

```bash
./scripts/run-pgtap-tests.sh                                  # all tests
./scripts/run-pgtap-tests.sh supabase/tests/upcoming_events_feed_rpc.test.sql
```

`supabase test db` executes each file with `pg_prove` in a container. Every
test file is wrapped in its own transaction (`BEGIN ... ROLLBACK`), so test
data is discarded automatically and the database is never polluted.

## Writing a new test

1. Create a file in this directory named `<something>.test.sql`.
2. Structure it with pgTAP:

   ```sql
   BEGIN;
   CREATE EXTENSION IF NOT EXISTS pgtap;  -- no-op when already loaded
   SELECT plan(N);                        -- N = number of assertions

   -- ... arrange mock data ...
   -- ... run pgTAP assertions (is, ok, results_eq, set_eq, has_function, ...) ...

   SELECT * FROM finish();
   ROLLBACK;
   ```

3. Run it locally as shown above.

## CI

The `db-tests` job in `.github/workflows/ci.yml` starts the local Supabase
stack and runs the pgTAP tests for the trigger and event-discovery RPC via
`scripts/run-pgtap-tests.sh`. Any failing assertion fails the pipeline.
