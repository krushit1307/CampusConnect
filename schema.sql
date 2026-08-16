create table if not exists images_metadata (
  id uuid default gen_random_uuid() primary key,
  image_url text not null unique,
  generated_alt_text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) if needed
alter table images_metadata enable row level security;

create policy "Allow public read access on images_metadata"
  on images_metadata for select
  using (true);
