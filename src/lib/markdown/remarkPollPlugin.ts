// =============================================================================
// Utility: Remark Poll Plugin (AST Parser)
// Issue: #2819 - Implement Real - Time Polling Widget Embeddable in Markdown
// Description: A custom remark plugin that parses the`[poll: "A", "B", "C"]`
// syntax within markdown text and transforms it into a custom AST node type
// that react - markdown can render as an interactive React component.
// =============================================================================

import { visit } from "unist-util-visit";

/**
 * Regex to match the poll syntax: [poll: "Option 1", "Option 2", ...]
 * Captures the inner comma-separated string of options.
 */
const POLL_REGEX = /\[poll:\s*([^\]]+)\]/g;

/**
 * The custom remark plugin function.
 * It walks the Markdown AST, finds text nodes matching the regex,
 * and replaces them with a custom 'poll' node type.
 */
export function remarkPollPlugin() {
  return (tree: any) => {
    visit(tree, "text", (node: any, index: number, parent: any) => {
      if (!parent || typeof index !== "number") return;

      const value = node.value as string;
      let match;
      const newNodes: any[] = [];
      let lastIndex = 0;

      // Reset regex state
      POLL_REGEX.lastIndex = 0;

      while ((match = POLL_REGEX.exec(value)) !== null) {
        const fullMatch = match[0];
        const optionsString = match[1];
        const startIndex = match.index;

        // 1. Add any text before the match as a standard text node
        if (startIndex > lastIndex) {
          newNodes.push({
            type: "text",
            value: value.slice(lastIndex, startIndex),
          });
        }

        // 2. Parse the options string into an array
        // We use a simple regex to extract quoted strings to handle commas inside options
        const options: string[] = [];
        const optionRegex = /"([^"]*)"/g;
        let optMatch;
        while ((optMatch = optionRegex.exec(optionsString)) !== null) {
          options.push(optMatch[1].trim());
        }

        // Fallback if no quotes were used (comma separated)
        if (options.length === 0) {
          optionsString.split(",").forEach((opt) => {
            const trimmed = opt.trim();
            if (trimmed) options.push(trimmed);
          });
        }

        // 3. Create the custom 'poll' AST node
        if (options.length >= 2) {
          // Polls need at least 2 options
          newNodes.push({
            type: "poll",
            data: {
              hName: "poll", // Maps to a React component named 'poll'
              hProperties: {
                options: JSON.stringify(options),
                rawSyntax: fullMatch,
              },
            },
            children: [],
          });
        } else {
          // If invalid syntax, just render as plain text
          newNodes.push({
            type: "text",
            value: fullMatch,
          });
        }

        lastIndex = startIndex + fullMatch.length;
      }

      // 4. Add any remaining text after the last match
      if (lastIndex < value.length) {
        newNodes.push({
          type: "text",
          value: value.slice(lastIndex),
        });
      }

      // 5. Replace the original text node with the new nodes
      if (newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes);
        return index + newNodes.length; // Skip the newly inserted nodes
      }
    });
  };
}
