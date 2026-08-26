// =============================================================================
// Component: MarkdownRenderer
// Issue: #2819 - Implement Real - Time Polling Widget Embeddable in Markdown
// Description: Wraps react - markdown and integrates the custom remarkPollPlugin
// to parse and render interactive polls within forum posts.
// =============================================================================

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkPollPlugin } from "../../lib/markdown/remarkPollPlugin";
import { PollWidget } from "./PollWidget";

interface MarkdownRendererProps {
  content: string;
  postId?: string; // Used to link the poll to the database
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, postId }) => {
  // Custom component mapping for the 'poll' AST node
  const components = {
    poll: ({ node, options, rawSyntax, ...props }: any) => {
      // Parse the options JSON passed from the remark plugin
      let parsedOptions: string[] = [];
      try {
        parsedOptions = JSON.parse(options || "[]");
      } catch (e) {
        console.error("[MarkdownRenderer] Failed to parse poll options:", e);
        return <p className="text-red-500">Invalid poll syntax.</p>;
      }

      // Generate a deterministic poll ID based on the post ID and the raw syntax
      // This ensures the same poll in the same post always maps to the same DB record
      const pollId = postId ? `${postId}-${hashCode(rawSyntax)}` : null;

      return <PollWidget pollId={pollId} options={parsedOptions} />;
    },

    // Override standard elements for consistent styling
    p: ({ node, ...props }) => (
      <p className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed" {...props} />
    ),
    h1: ({ node, ...props }) => (
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 mt-6" {...props} />
    ),
    h2: ({ node, ...props }) => (
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 mt-5" {...props} />
    ),
    ul: ({ node, ...props }) => (
      <ul
        className="list-disc list-inside mb-4 text-gray-700 dark:text-gray-300 space-y-1"
        {...props}
      />
    ),
    ol: ({ node, ...props }) => (
      <ol
        className="list-decimal list-inside mb-4 text-gray-700 dark:text-gray-300 space-y-1"
        {...props}
      />
    ),
    a: ({ node, ...props }) => (
      <a
        className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
    blockquote: ({ node, ...props }) => (
      <blockquote
        className="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4 py-2 my-4 bg-gray-50 dark:bg-gray-800/50 italic text-gray-600 dark:text-gray-400"
        {...props}
      />
    ),
  };

  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkPollPlugin]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

/**
 * Simple string hash function to generate deterministic IDs for polls
 */
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
