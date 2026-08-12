# DB Version Tracking and Migration Verification

Issue #434 adds a `db_versions` table and a script to verify that every migration
inside `supabase/migrations` has a matching row in the database.

## Files

- `supabase/migrations/20260718000007_db_versioning.sql`
- `scripts/verify-migrations.ts`
- `scripts/verify-migrations.test.ts`

## Table

The migration creates `public.db_versions` with:

- `id`
- `migration_name`
- `executed_at`
- `checksum`
- `created_at`
- `updated_at`

`migration_name` is unique and should match the exact filename from
`supabase/migrations`, for example:

```text
20260718000007_db_versioning.sql
```

## Backfill behavior

When Supabase's internal `supabase_migrations.schema_migrations` table is
available, the migration backfills `public.db_versions` from it. This helps local
and CI verification start with the migrations already known to Supabase.

## Script

Run the verification script with a service-role key:

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
npx tsx scripts/verify-migrations.ts
```

The script:

1. Reads all `.sql` files from `supabase/migrations`.
2. Reads all `migration_name` values from `public.db_versions`.
3. Prints missing rows.
4. Exits with code `1` if any local migration is missing from the table.

## Manual testing

1. Apply the migration locally or remotely.
2. Confirm `public.db_versions` exists.
3. Confirm the table contains `20260718000007_db_versioning.sql`.
4. Run `npx tsx scripts/verify-migrations.ts` with Supabase env vars.
5. Temporarily remove one row from `db_versions` in a disposable local database.
6. Confirm the script reports the missing migration and exits non-zero.
