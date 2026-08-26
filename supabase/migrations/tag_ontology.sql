-- 1. Create the hierarchical tag ontology table
create table if not exists tag_ontology (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  parent_id uuid references tag_ontology(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable trigram extension for fuzzy string matching on legacy tags
create extension if not exists pg_trgm;

-- 2. Seed example ontology tree
insert into tag_ontology (id, name, parent_id) values
  ('00000000-0000-0000-0000-000000000001', 'Technology', null),
  ('00000000-0000-0000-0000-000000000002', 'Software Engineering', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', 'React', '00000000-0000-0000-0000-000000000002')
on conflict (name) do nothing;

-- 3. Migration function to map legacy flat event tags to ontology IDs
-- (Assuming your events table has a text array or string column 'legacy_tags')
create or replace function migrate_legacy_tags()
returns void as $$
declare
  r record;
  matched_tag_id uuid;
begin
  for r in select id, legacy_tag from events_legacy_flat loop
    -- Find best matching ontology tag using similarity
    select id into matched_tag_id
    from tag_ontology
    order by similarity(name, r.legacy_tag) desc
    limit 1;

    if matched_tag_id is not null then
      insert into event_tags (event_id, tag_id)
      values (r.id, matched_tag_id)
      on conflict do nothing;
    end if;
  end loop;
end;
$$ language plpgsql;
