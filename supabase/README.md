# Supabase Database Migrations

This document describes how contributors should verify database migrations before submitting a Pull Request.

## Migration Testing Workflow

Whenever a new migration is added, verify that it applies cleanly from a fresh database state.

### Reset the Local Database

Run:

```bash
supabase db reset
```

This command:

- Drops the local database
- Recreates the database
- Applies all migrations from scratch
- Helps identify migration ordering issues
- Verifies schema consistency

### Create a New Migration

Generate a migration file using:

```bash
supabase migration new migration_name
```

Place migration files inside:

```text
supabase/migrations/
```

### Verify Migration Integrity

After creating or modifying migrations:

```bash
supabase db reset
```

Ensure:

- All migrations execute successfully
- No SQL errors occur
- Foreign key constraints work correctly
- RLS policies are applied successfully
- The schema is created as expected

## Rollback (Down-Migration) Guidelines

When creating migrations, contributors should consider how changes can be reverted.

Examples:

### Dropping a Table

```sql
DROP TABLE IF EXISTS example_table;
```

### Removing a Column

```sql
ALTER TABLE users
DROP COLUMN example_column;
```

### Removing an Index

```sql
DROP INDEX IF EXISTS index_name;
```

Document rollback considerations in the Pull Request whenever applicable.

## Contributor Checklist

Before opening a Pull Request:

- [ ] Migration file created in `supabase/migrations`
- [ ] `supabase db reset` completed successfully
- [ ] Schema changes verified
- [ ] Foreign keys tested
- [ ] RLS policies reviewed
- [ ] Rollback strategy considered
