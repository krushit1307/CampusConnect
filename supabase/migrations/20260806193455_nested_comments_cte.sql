-- Migration: add recursive CTE view for nested comments (#608)

ALTER TABLE comments
ADD COLUMN IF NOT EXISTS parent_comment_id UUID
REFERENCES comments(id)
ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id
ON comments(parent_comment_id);

CREATE OR REPLACE VIEW comment_threads AS
WITH RECURSIVE thread AS (
    -- Root comments
    SELECT
        c.id,
        c.post_id,
        c.parent_comment_id,
        c.author_id,
        c.content,
        c.created_at,
        0 AS depth,
        ARRAY[c.created_at::TEXT, c.id::TEXT] AS sort_path
    FROM comments c
    WHERE c.parent_comment_id IS NULL

    UNION ALL

    -- Replies
    SELECT
        c.id,
        c.post_id,
        c.parent_comment_id,
        c.author_id,
        c.content,
        c.created_at,
        t.depth + 1,
        t.sort_path || c.created_at::TEXT || c.id::TEXT
    FROM comments c
    JOIN thread t
      ON c.parent_comment_id = t.id
)
SELECT *
FROM thread
ORDER BY sort_path;
