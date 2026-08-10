-- Issue #434: Track applied migrations for automated parity checks.
-- This table mirrors migration filenames from supabase/migrations so CI and
-- local scripts can confirm that every checked-in migration was applied.

create table if not exists public.db_versions (
  id bigserial primary key,
  migration_name text not null unique,
  executed_at timestamptz not null default now(),
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint db_versions_migration_name_not_blank check (btrim(migration_name) <> ''),
  constraint db_versions_migration_name_sql_file check (migration_name like '%.sql')
);

comment on table public.db_versions is
  'Tracks applied Supabase migration filenames for schema parity verification.';

comment on column public.db_versions.migration_name is
  'Migration filename from supabase/migrations, for example 20260718000007_db_versioning.sql.';

comment on column public.db_versions.executed_at is
  'Timestamp when the migration was recorded as applied.';

create index if not exists db_versions_migration_name_idx
  on public.db_versions (migration_name);

create or replace function public.set_db_versions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_db_versions_updated_at on public.db_versions;

create trigger set_db_versions_updated_at
before update on public.db_versions
for each row
execute function public.set_db_versions_updated_at();

alter table public.db_versions enable row level security;

-- Service-role clients used by CI/admin scripts can read and maintain this table.
drop policy if exists "Service role can manage db_versions" on public.db_versions;
create policy "Service role can manage db_versions"
on public.db_versions
for all
to service_role
using (true)
with check (true);

-- Backfill from Supabase's internal migration ledger when it is available.
-- Supabase stores migrations as version + name, while this repo compares
-- against the filename form: <version>_<name>.sql.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
  ) then
    insert into public.db_versions (migration_name, executed_at)
    select
      case
        when coalesce(name, '') = '' then version || '.sql'
        else version || '_' || name || '.sql'
      end as migration_name,
      coalesce(inserted_at, now()) as executed_at
    from supabase_migrations.schema_migrations
    on conflict (migration_name) do update
      set executed_at = excluded.executed_at,
          updated_at = now();
  end if;
end;
$$;

insert into public.db_versions (migration_name, executed_at)
values ('20260718000007_db_versioning.sql', now())
on conflict (migration_name) do update
  set executed_at = excluded.executed_at,
      updated_at = now();
