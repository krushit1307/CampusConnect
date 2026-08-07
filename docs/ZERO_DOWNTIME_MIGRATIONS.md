# Zero-Downtime Schema Migration Framework (Expand/Contract Pattern)

## Overview & Architecture

As **CampusConnect** scales to 24/7 high-concurrency usage, traditional DDL database migrations (such as `ALTER TABLE ... ALTER COLUMN` or `ALTER TABLE ... DROP COLUMN`) that acquire exclusive AccessExclusiveLocks cannot be applied directly without causing request timeouts or service interruption.

This framework enforces the **Expand and Contract** pattern (also known as Parallel Run or Parallel Schema Evolution). By executing multi-step schema transformations across distinct deployment phases, both old and new versions of the application can operate concurrently without dropping a single database write or locking critical tables.

---

## The 4-Phase Migration Pipeline

```
  Phase 1: EXPAND            Phase 2: DATA MIGRATE       Phase 3: CODE DEPLOY        Phase 4: CONTRACT
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ Add new table/cols   │───>│ Asynchronously       │───>│ Deploy app code      │───>│ Remove sync triggers │
│ Attach dual-write    │    │ backfill historical  │    │ reading & writing    │    │ Drop legacy columns/ │
│ PostgreSQL triggers  │    │ rows in chunks       │    │ exclusively to new   │    │ tables safely        │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

---

### Phase 1: Expand

- **Objective**: Add new tables, columns, or indexes without altering existing structures or locking reads/writes.
- **Rules**:
  - All new columns must be `NULLABLE` or have non-volatile `DEFAULT` values.
  - Create PostgreSQL trigger functions that automatically replicate `INSERT` and `UPDATE` operations from the old schema columns to the new schema columns in real-time.
  - Never run `ALTER TABLE ADD COLUMN ... NOT NULL` without a default value.
  - Create all new indexes using `CREATE INDEX CONCURRENTLY` to prevent table locking.

### Phase 2: Migrate Data & Backfill

- **Objective**: Populate the new schema columns with historical data generated before Phase 1.
- **Rules**:
  - Perform backfills asynchronously in small, bounded batches (e.g. 1,000 rows per transaction) using background workers or RPC functions.
  - Rely on the Phase 1 triggers to maintain real-time sync for active rows modified during the backfill window.
  - Set strict statement timeouts (`SET statement_timeout = '2s'`) during batch backfill execution.

### Phase 3: Update Application Code

- **Objective**: Switch application software to consume and write to the new schema.
- **Rules**:
  - App Version N writes to both schemas (or relies on triggers) and reads from the new schema.
  - Ensure feature flag gating or fallback reads if the new column is empty.
  - Monitor API error rates and query latencies before authorizing Phase 4.

### Phase 4: Contract & Cleanup

- **Objective**: Safely remove legacy database structures after 100% of application traffic has migrated.
- **Rules**:
  - Drop the synchronization triggers established in Phase 1.
  - Drop legacy columns or old tables (`ALTER TABLE ... DROP COLUMN ...`).
  - Perform cleanup during low-traffic maintenance windows or with non-blocking constraints.

---

## Real-World Example: Normalizing Event Venue Data

### Scenario

Refactoring `events.location` (plain string) into a structured `event_venues` normalized table (`venue_name`, `address`, `city`, `coordinates`) while serving live traffic.

### Migration Step 1: Expand (`20260727100000_expand_events_location.sql`)

Creates the new table and triggers real-time dual-writing from `events` to `event_venues`.

### Migration Step 2: Backfill (`20260727100001_backfill_and_sync_triggers.sql`)

Runs batch backfill for pre-existing event records.

### Migration Step 3: Contract (`20260727100002_contract_cleanup.sql`)

Removes trigger and legacy `events.location` column after application migration.

---

## PostgreSQL Guardrails & Best Practices

1. **Lock Timeouts**: Always specify `SET lock_timeout = '3s'` in migration scripts to prevent long query queues.
2. **Concurrent Indexing**: Always use `CREATE INDEX CONCURRENTLY` outside explicit transaction blocks.
3. **Trigger Overhead**: Keep trigger execution paths minimal (under 1ms) to preserve write performance.
