// =============================================================================
// Component: CommentTree
// Issue: #2388 - Implement Hierarchical Trees (ltree) for deeply nested comments
// Description: Recursively renders the nested comment tree UI with proper
// indentation, dark mode support, and responsive design.
// =============================================================================

import React from "react";

interface Comment {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  children?: Comment[];
}

interface CommentTreeProps {
  comment: Comment;
  depth?: number;
}

export const CommentTree: React.FC<CommentTreeProps> = ({ comment, depth = 0 }) => {
  // Maximum indentation level to prevent UI breaking on extreme nesting
  const MAX_DEPTH = 10;
  const currentDepth = Math.min(depth, MAX_DEPTH);

  // Calculate indentation based on depth (Tailwind spacing)
  const getIndentClass = (d: number) => {
    const spacing = [
      "ml-0",
      "ml-4",
      "ml-8",
      "ml-12",
      "ml-16",
      "ml-20",
      "ml-24",
      "ml-28",
      "ml-32",
      "ml-36",
      "ml-40",
    ];
    return spacing[d] || "ml-40";
  };

  // Border color cycling for visual hierarchy in dark/light mode
  const getBorderColor = (d: number) => {
    const colors = [
      "border-indigo-500 dark:border-indigo-400",
      "border-purple-500 dark:border-purple-400",
      "border-pink-500 dark:border-pink-400",
      "border-blue-500 dark:border-blue-400",
      "border-teal-500 dark:border-teal-400",
    ];
    return colors[d % colors.length];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`${getIndentClass(currentDepth)} mt-3`}>
      <div className={`border-l-2 ${getBorderColor(currentDepth)} pl-4 py-2 transition-colors`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-gray-900 dark:text-white">
            User_{comment.author_id.substring(0, 4)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(comment.created_at)}
          </span>
        </div>

        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
          {comment.content}
        </p>

        <div className="mt-2 flex gap-4">
          <button className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Reply
          </button>
          <button className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Share
          </button>
        </div>
      </div>

      {/* Recursive rendering for children */}
      {comment.children && comment.children.length > 0 && (
        <div className="mt-2">
          {comment.children.map((child) => (
            <CommentTree key={child.id} comment={child} depth={currentDepth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

interface CommentThreadProps {
  rootComment: Comment | null;
}

export const CommentThread: React.FC<CommentThreadProps> = ({ rootComment }) => {
  if (!rootComment) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        No comments yet. Be the first to start the discussion!
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Discussion Thread</h2>
      <CommentTree comment={rootComment} depth={0} />
    </div>
  );
};
