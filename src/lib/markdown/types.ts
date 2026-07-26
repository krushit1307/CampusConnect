/**
 * AST node types for the custom Markdown parser.
 *
 * The parser produces a tree of these nodes. The React renderer walks the tree
 * and maps each node to a safe React element — no `dangerouslySetInnerHTML`
 * is ever used, so XSS by design is impossible.
 */

/** A single child can be either a leaf string or another AST node. */
export type MarkdownNodeChild = string | MarkdownNode;

/** Common fields every AST node has. */
export interface BaseNode {
  /** Discriminator for the node type. */
  type: MarkdownNodeType;
  /** Child nodes (for containers) or inline content. */
  children?: MarkdownNodeChild[];
}

/** Root of the AST — holds a list of block-level nodes. */
export interface RootNode extends BaseNode {
  type: "root";
  children: MarkdownNode[];
}

/** Heading: `# Title`, `## Subtitle`, etc. (depth 1–6). */
export interface HeadingNode extends BaseNode {
  type: "heading";
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  children: MarkdownNodeChild[];
}

/** Paragraph — a block of inline content. */
export interface ParagraphNode extends BaseNode {
  type: "paragraph";
  children: MarkdownNodeChild[];
}

/** Bold text: `**bold**` or `__bold__`. */
export interface BoldNode extends BaseNode {
  type: "bold";
  children: MarkdownNodeChild[];
}

/** Italic text: `*italic*` or `_italic_`. */
export interface ItalicNode extends BaseNode {
  type: "italic";
  children: MarkdownNodeChild[];
}

/** Strikethrough text: `~~text~~`. */
export interface StrikethroughNode extends BaseNode {
  type: "strikethrough";
  children: MarkdownNodeChild[];
}

/** Inline code: `` `code` ``. */
export interface InlineCodeNode extends BaseNode {
  type: "inlineCode";
  /** The raw code text (already escaped during render). */
  value: string;
}

/** Fenced code block: ```` ```lang\ncode\n``` ````. */
export interface CodeBlockNode extends BaseNode {
  type: "codeBlock";
  /** Language identifier (may be empty). */
  lang: string;
  /** The raw code text. */
  value: string;
}

/** Link: `[text](url)`. URL is sanitized during render. */
export interface LinkNode extends BaseNode {
  type: "link";
  href: string;
  title?: string;
  children: MarkdownNodeChild[];
}

/** Image: `![alt](url)`. URL is sanitized during render. */
export interface ImageNode extends BaseNode {
  type: "image";
  src: string;
  alt: string;
  title?: string;
}

/** Blockquote: `> quote`. */
export interface BlockquoteNode extends BaseNode {
  type: "blockquote";
  children: MarkdownNode[];
}

/** A single item inside an ordered or unordered list. */
export interface ListItemNode extends BaseNode {
  type: "listItem";
  /** True for ordered lists (`1.`), false for unordered (`-` or `*`). */
  ordered: boolean;
  /** For ordered lists, the number to display (default 1). */
  start?: number;
  /** True if the item is a task-list checkbox: `- [x]` or `- [ ]`. */
  task?: boolean;
  /** For task-list items, whether the checkbox is checked. */
  checked?: boolean;
  children: MarkdownNodeChild[];
}

/** Unordered list: `- item` or `* item`. */
export interface UnorderedListNode extends BaseNode {
  type: "unorderedList";
  children: ListItemNode[];
}

/** Ordered list: `1. item`. */
export interface OrderedListNode extends BaseNode {
  type: "orderedList";
  /** Starting number for the list (default 1). */
  start: number;
  children: ListItemNode[];
}

/** Horizontal rule: `---`, `***`, or `___`. */
export interface ThematicBreakNode extends BaseNode {
  type: "thematicBreak";
}

/** Plain text — the leaf of the inline tree. */
export interface TextNode extends BaseNode {
  type: "text";
  value: string;
}

/** Line break (two trailing spaces + newline, or a hard break). */
export interface LineBreakNode extends BaseNode {
  type: "lineBreak";
}

/** Soft break — a single newline within a paragraph (renders as a space). */
export interface SoftBreakNode extends BaseNode {
  type: "softBreak";
}

/** Union of all block-level node types. */
export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | CodeBlockNode
  | BlockquoteNode
  | UnorderedListNode
  | OrderedListNode
  | ThematicBreakNode;

/** Union of all inline node types. */
export type InlineNode =
  | TextNode
  | BoldNode
  | ItalicNode
  | StrikethroughNode
  | InlineCodeNode
  | LinkNode
  | ImageNode
  | LineBreakNode
  | SoftBreakNode;

/** Union of every possible AST node type. */
export type MarkdownNode = RootNode | BlockNode | InlineNode | ListItemNode;

/** String literal union of all node `type` values. */
export type MarkdownNodeType =
  | "root"
  | "heading"
  | "paragraph"
  | "bold"
  | "italic"
  | "strikethrough"
  | "inlineCode"
  | "codeBlock"
  | "link"
  | "image"
  | "blockquote"
  | "listItem"
  | "unorderedList"
  | "orderedList"
  | "thematicBreak"
  | "text"
  | "lineBreak"
  | "softBreak";
