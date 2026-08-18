create table if not exists resource_transcripts (
  id uuid default gen_random_uuid() primary key,
  resource_id text not null unique,
  transcript_text text not null,
  vtt_url text not null,
  search_vector tsvector generated always as (to_tsvector('english', transcript_text)) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_resource_transcripts_search on resource_transcripts using gin(search_vector);
