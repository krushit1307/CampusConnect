// =============================================================================
// Resolver: Comments (ltree implementation)
// Issue: #2388 - Implement Hierarchical Trees (ltree) for deeply nested comments
// Description: Fetches a comment and all infinite descendants in a single
// flat array using the ltree <@ operator, then reconstructs the tree in memory.
// =============================================================================

import { supabaseAdmin } from "../lib/supabaseAdmin";

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  path: string;
  parent_id: string | null;
  created_at: string;
  children?: Comment[];
}

/**
 * Fetches a root comment and all its deeply nested descendants using ltree.
 * This replaces horrifying recursive SQL CTE queries with a single index scan.
 *
 * @param rootCommentId The ID of the root comment to fetch descendants for
 * @returns A nested tree structure of comments
 */
export async function getCommentThread(rootCommentId: string): Promise<Comment | null> {
  // Strip hyphens from UUID to match ltree format stored in DB
  const ltreeRootId = rootCommentId.replace(/-/g, "_");

  // Execute the lightning-fast ltree fetch query
  // The <@ operator means "is descendant of or equal to"
  const { data: flatComments, error } = await supabaseAdmin
    .from("comments")
    .select("*")
    .lte("path", `${ltreeRootId}`) // Using ltree matching
    .order("path", { ascending: true });

  if (error) {
    console.error("Error fetching comment thread:", error);
    throw new Error("Failed to fetch comment thread");
  }

  if (!flatComments || flatComments.length === 0) {
    return null;
  }

  // Reconstruct the flat array into a nested tree UI based on the path strings
  return buildTree(flatComments as Comment[], rootCommentId);
}

/**
 * Reconstructs a flat array of comments with ltree paths into a nested tree structure.
 *
 * @param flatComments Array of comments fetched from DB with ltree paths
 * @param rootId The ID of the root comment
 * @returns Nested comment tree
 */
function buildTree(flatComments: Comment[], rootId: string): Comment {
  const commentMap = new Map<string, Comment>();
  let rootComment: Comment | null = null;

  // First pass: Initialize all comments with empty children array
  flatComments.forEach((comment) => {
    comment.children = [];
    commentMap.set(comment.id, comment);
  });

  // Second pass: Build the tree structure
  flatComments.forEach((comment) => {
    if (comment.id === rootId) {
      rootComment = comment;
    } else if (comment.parent_id) {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.children!.push(comment);
      }
    }
  });

  // Sort children by created_at to maintain chronological order within each level
  const sortChildren = (node: Comment) => {
    if (node.children && node.children.length > 0) {
      node.children.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      node.children.forEach(sortChildren);
    }
  };

  if (rootComment) {
    sortChildren(rootComment);
  }

  return rootComment!;
}

/**
 * GraphQL Resolver definition for Apollo Server / Mercurius
 */
export const commentsResolvers = {
  Query: {
    commentThread: async (_: any, { rootCommentId }: { rootCommentId: string }) => {
      return getCommentThread(rootCommentId);
    },
  },
  Comment: {
    // Resolver for nested children field
    children: (parent: Comment) => parent.children || [],
  },
};
