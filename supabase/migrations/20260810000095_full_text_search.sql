-- Migration for Full-Text Search in Forum Posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS posts_fts_idx ON public.posts USING GIN (fts);
