-- Issue #2392: prepare posts for canonical rich-text JSONB storage.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS content_ast JSONB,
  ADD COLUMN IF NOT EXISTS plaintext_content TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_plaintext_fts
  ON public.posts USING GIN (to_tsvector('simple', coalesce(plaintext_content, '')));

ALTER TABLE public.posts
  ADD CONSTRAINT posts_content_ast_array
  CHECK (content_ast IS NULL OR jsonb_typeof(content_ast) = 'array');

COMMENT ON COLUMN public.posts.content_ast IS
  'Validated CampusConnect rich-text AST.';
COMMENT ON COLUMN public.posts.plaintext_content IS
  'Plain-text projection used for full-text search.';
