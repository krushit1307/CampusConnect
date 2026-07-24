-- Add parent reference for nested comments
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS parent_comment_id UUID
REFERENCES comments(id)
ON DELETE CASCADE;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id
ON comments(parent_comment_id);

-- Recursive threaded comments view
CREATE OR REPLACE VIEW comments_threaded AS
WITH RECURSIVE comment_tree AS (
    -- Root comments
    SELECT
        c.id,
        c.post_id,
        c.author_id,
        c.content,
        c.parent_comment_id,
        c.created_at,
        0 AS depth,
        ARRAY[c.id] AS path
    FROM comments c
    WHERE c.parent_comment_id IS NULL

    UNION ALL

    -- Child comments
    SELECT
        child.id,
        child.post_id,
        child.author_id,
        child.content,
        child.parent_comment_id,
        child.created_at,
        parent.depth + 1,
        parent.path || child.id
    FROM comments child
    INNER JOIN comment_tree parent
        ON child.parent_comment_id = parent.id
)
SELECT *
FROM comment_tree
ORDER BY path;
