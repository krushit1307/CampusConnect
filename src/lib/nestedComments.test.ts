import { describe, it, expect } from "vitest";
import {
  buildNestedCommentTree,
  RECURSIVE_COMMENTS_CTE_QUERY,
  FlatComment,
} from "./nestedComments";

describe("Postgres Recursive CTE Nested Comments (#2099)", () => {
  it("reconstructs a 4-level deep nested comment tree (A -> B -> C -> D) without N+1 queries", () => {
    const flatComments: FlatComment[] = [
      {
        id: "comment-A",
        post_id: "post-1",
        author_id: "user-1",
        parent_id: null,
        content: "Root comment A",
        created_at: "2026-08-04T00:00:00Z",
        depth: 0,
      },
      {
        id: "comment-B",
        post_id: "post-1",
        author_id: "user-2",
        parent_id: "comment-A",
        content: "Child comment B",
        created_at: "2026-08-04T00:01:00Z",
        depth: 1,
      },
      {
        id: "comment-C",
        post_id: "post-1",
        author_id: "user-3",
        parent_id: "comment-B",
        content: "Grandchild comment C",
        created_at: "2026-08-04T00:02:00Z",
        depth: 2,
      },
      {
        id: "comment-D",
        post_id: "post-1",
        author_id: "user-4",
        parent_id: "comment-C",
        content: "Great-grandchild comment D",
        created_at: "2026-08-04T00:03:00Z",
        depth: 3,
      },
    ];

    const tree = buildNestedCommentTree(flatComments);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("comment-A");
    expect(tree[0].children).toHaveLength(1);

    const childB = tree[0].children[0];
    expect(childB.id).toBe("comment-B");
    expect(childB.children).toHaveLength(1);

    const childC = childB.children[0];
    expect(childC.id).toBe("comment-C");
    expect(childC.children).toHaveLength(1);

    const childD = childC.children[0];
    expect(childD.id).toBe("comment-D");
    expect(childD.children).toHaveLength(0);
  });

  it("strictly limits recursion to depth < 5 to prevent memory exhaustion", () => {
    const deepComments: FlatComment[] = [
      {
        id: "c0",
        post_id: "p1",
        author_id: "u1",
        parent_id: null,
        content: "L0",
        created_at: "",
        depth: 0,
      },
      {
        id: "c1",
        post_id: "p1",
        author_id: "u1",
        parent_id: "c0",
        content: "L1",
        created_at: "",
        depth: 1,
      },
      {
        id: "c2",
        post_id: "p1",
        author_id: "u1",
        parent_id: "c1",
        content: "L2",
        created_at: "",
        depth: 2,
      },
      {
        id: "c3",
        post_id: "p1",
        author_id: "u1",
        parent_id: "c2",
        content: "L3",
        created_at: "",
        depth: 3,
      },
      {
        id: "c4",
        post_id: "p1",
        author_id: "u1",
        parent_id: "c3",
        content: "L4",
        created_at: "",
        depth: 4,
      },
      {
        id: "c5",
        post_id: "p1",
        author_id: "u1",
        parent_id: "c4",
        content: "L5",
        created_at: "",
        depth: 5,
      },
    ];

    const tree = buildNestedCommentTree(deepComments, 5);

    // c5 should be excluded since depth 5 is >= 5 limit
    let current = tree[0];
    let depth = 0;
    while (current.children.length > 0) {
      current = current.children[0];
      depth++;
    }
    expect(depth).toBe(4);
    expect(current.id).toBe("c4");
  });

  it("contains valid WITH RECURSIVE SQL query structure with path sorting", () => {
    expect(RECURSIVE_COMMENTS_CTE_QUERY).toContain("WITH RECURSIVE comment_tree AS");
    expect(RECURSIVE_COMMENTS_CTE_QUERY).toContain("WHERE parent_id IS NULL AND post_id = $1");
    expect(RECURSIVE_COMMENTS_CTE_QUERY).toContain(
      "INNER JOIN comment_tree ct ON c.parent_id = ct.id",
    );
    expect(RECURSIVE_COMMENTS_CTE_QUERY).toContain("WHERE ct.depth < 5");
    expect(RECURSIVE_COMMENTS_CTE_QUERY).toContain("ORDER BY path");
  });
});
