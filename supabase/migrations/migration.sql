create or replace function inherit_parent_tags_trigger()
returns trigger as $$
declare
  current_pid uuid;
begin
  -- Fetch parent of the inserted tag
  select parent_id into current_pid from tag_ontology where id = new.tag_id;

  -- Recursively insert all ancestors up the tree hierarchy
  while current_pid is not null loop
    insert into event_tags (event_id, tag_id)
    values (new.event_id, current_pid)
    on conflict do nothing;

    select parent_id into current_pid from tag_ontology where id = current_pid;
  end loop;

  return new;
end;
$$ language plpgsql;

create trigger tr_inherit_ontology_tags
  after insert on event_tags
  for each row
  execute function inherit_parent_tags_trigger();
