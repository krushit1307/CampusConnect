/**
 * Public API for the custom Markdown parser + renderer.
 *
 * Zero external dependencies. Safe by design (no `dangerouslySetInnerHTML`).
 *
 * @example
 *   import { parse, MarkdownRenderer } from "@/lib/markdown";
 *
 *   const ast = parse("# Hello **world**");
 *   // → { type: "root", children: [{ type: "heading", depth: 1, ... }] }
 *
 *   <MarkdownRenderer source={mdString} />
 *   // or:
 *   <MarkdownRenderer ast={ast} />
 */

export { parse, parseInline } from "./parser";
export { tokenizeBlocks, tokenizeInline } from "./lexer";
export type { BlockToken, InlineToken } from "./lexer";
export { sanitizeUrl, escapeHtml } from "./sanitize";
export { MarkdownRenderer } from "./MarkdownRenderer";
export type { MarkdownRendererProps } from "./MarkdownRenderer";
export type * from "./types";
