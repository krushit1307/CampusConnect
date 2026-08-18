export interface FlatComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  parent_comment_id?: string | null;
  content: string;
  created_at: string;
  deleted_at?: string | null;
  depth?: number;
  path?: string[];
}

export interface NestedCommentNode extends FlatComment {
  children: NestedCommentNode[];
}

/**
 * Algorithmic pass to reconstruct a flattened array from a recursive CTE query
 * into a deeply nested JSON tree for rendering in the frontend UI.
 *
 * Runs in O(N) linear time using a hash map lookup without N+1 query loops.
 */
export function buildNestedCommentTree(comments: FlatComment[], maxDepth = 5): NestedCommentNode[] {
  const map = new Map<string, NestedCommentNode>();

  // Filter out any entries exceeding max recursion depth (< 5)
  const validComments = comments.filter((c) => c.depth === undefined || c.depth < maxDepth);

  // Initialize node entries with empty children array
  validComments.forEach((comment) => {
    map.set(comment.id, { ...comment, children: [] });
  });

  const roots: NestedCommentNode[] = [];

  // Wire children under their respective parents
  validComments.forEach((comment) => {
    const parentId = comment.parent_id || comment.parent_comment_id;
    const node = map.get(comment.id);

    if (!node) return;

    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Raw Recursive CTE SQL query string template for execution against Postgres
 */
export const RECURSIVE_COMMENTS_CTE_QUERY = `
WITH RECURSIVE comment_tree AS (
  SELECT
    id,
    post_id,
    author_id,
    parent_id,
    content,
    created_at,
    0 AS depth,
    ARRAY[id] AS path
  FROM comments
  WHERE parent_id IS NULL AND post_id = $1

  UNION ALL

  SELECT
    c.id,
    c.post_id,
    c.author_id,
    c.parent_id,
    c.content,
    c.created_at,
    ct.depth + 1 AS depth,
    ct.path || c.id AS path
  FROM comments c
  INNER JOIN comment_tree ct ON c.parent_id = ct.id
  WHERE ct.depth < 5
)
SELECT * FROM comment_tree ORDER BY path;
`;
