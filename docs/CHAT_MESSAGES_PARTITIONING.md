# Chat Messages Table Partitioning Strategy

## Overview
The `chat_messages` table is expected to grow rapidly as the user base increases. To maintain optimal query performance for recent messages and prevent index bloat, the table has been converted to a **Range-Partitioned Table** based on the `created_at` timestamp, with monthly partitions.

## Architecture
- **Parent Table**: `public.chat_messages` (Partitioned by `RANGE (created_at)`)
- **Partitions**: Named dynamically as `chat_messages_YYYY_MM` (e.g., `chat_messages_2026_08`).
- **Default Partition**: `chat_messages_default` catches any data that falls outside defined ranges (e.g., malformed dates), preventing insert failures.

## Automation
A `pg_cron` job is configured to automatically create the next month's partition on the **25th of every month at 2:00 AM UTC**. This ensures that the database is always prepared for the upcoming month's data without manual intervention.

## Benefits
1. **Query Performance**: Queries filtering by recent dates (e.g., "last 30 days") only scan the relevant monthly partition(s), drastically reducing I/O.
2. **Maintenance**: Old partitions can be detached and archived or dropped independently without locking the entire table.
3. **Index Efficiency**: Smaller indexes per partition improve cache hit rates and update speeds.

## Rollback Procedure
In the unlikely event that partitioning causes issues, the rollback procedure involves:
1. Disabling the `pg_cron` job: `SELECT cron.unschedule('create-chat-messages-partition-monthly');`
2. Creating a standard table, migrating data from all partitions, and dropping the partitioned table.
