/**
 * Markdown Parser
 *
 * Converts the flat token stream from the lexer into a hierarchical AST.
 *
 * Architecture:
 *   1. `parse(input)` → tokenizes blocks, then groups block tokens into
 *      block-level AST nodes (headings, paragraphs, lists, etc.).
 *   2. Each block's inline text is tokenized + parsed into inline AST nodes
 *      (bold, italic, links, code, etc.) by `parseInline`.
 *   3. The result is a single `RootNode` whose `children` are block nodes.
 *
 * The parser is permissive: any unrecognized syntax becomes plain text,
 * so the renderer never throws.
 */

import { tokenizeBlocks, tokenizeInline, type BlockToken, type InlineToken } from "./lexer";
import type {
  RootNode,
  MarkdownNode,
  MarkdownNodeChild,
  HeadingNode,
  ParagraphNode,
  CodeBlockNode,
  BlockquoteNode,
  ListItemNode,
  UnorderedListNode,
  OrderedListNode,
  ThematicBreakNode,
} from "./types";

/**
 * Parse a raw Markdown string into an AST.
 *
 * @example
 *   const ast = parse("# Hello **world**");
 *   // → { type: "root", children: [{ type: "heading", depth: 1, children: [...] }] }
 */
export function parse(input: string): RootNode {
  const tokens = tokenizeBlocks(input);
  const children: MarkdownNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    switch (token.kind) {
      case "blank":
        // Skip blank lines — they're just separators.
        i++;
        break;

      case "heading": {
        children.push(parseHeading(token));
        i++;
        break;
      }

      case "codeBlock": {
        children.push(parseCodeBlock(token));
        i++;
        break;
      }

      case "thematicBreak": {
        children.push(parseThematicBreak());
        i++;
        break;
      }

      case "blockquote": {
        // Consume consecutive blockquote lines into one blockquote node.
        const lines: string[] = [];
        while (i < tokens.length && tokens[i].kind === "blockquote") {
          lines.push((tokens[i] as { text: string }).text);
          i++;
        }
        children.push(parseBlockquote(lines));
        break;
      }

      case "unorderedListItem":
      case "orderedListItem": {
        // Consume consecutive list items of the same kind into one list.
        const isOrdered = token.kind === "orderedListItem";
        const items: BlockToken[] = [];
        while (
          i < tokens.length &&
          (tokens[i].kind === "unorderedListItem" || tokens[i].kind === "orderedListItem")
        ) {
          // Only group same-type items together (don't merge ordered + unordered).
          if (tokens[i].kind !== token.kind) break;
          items.push(tokens[i]);
          i++;
        }
        children.push(parseList(items, isOrdered));
        break;
      }

      case "paragraph": {
        // Consume consecutive paragraph lines into one paragraph.
        const lines: string[] = [];
        while (i < tokens.length && tokens[i].kind === "paragraph") {
          lines.push((tokens[i] as { text: string }).text);
          i++;
        }
        children.push(parseParagraph(lines));
        break;
      }

      default:
        // Unknown token kind — skip to avoid infinite loops.
        i++;
        break;
    }
  }

  return { type: "root", children };
}

// ─────────────────────────────────────────────────────────────────────────────
// Block-level parsers
// ─────────────────────────────────────────────────────────────────────────────

function parseHeading(token: BlockToken & { kind: "heading" }): HeadingNode {
  return {
    type: "heading",
    depth: token.depth,
    children: parseInline(token.text),
  };
}

function parseCodeBlock(token: BlockToken & { kind: "codeBlock" }): CodeBlockNode {
  return {
    type: "codeBlock",
    lang: token.lang,
    value: token.value,
  };
}

function parseThematicBreak(): ThematicBreakNode {
  return { type: "thematicBreak" };
}

function parseBlockquote(lines: string[]): BlockquoteNode {
  // Recursively parse the blockquote content as nested Markdown.
  const inner = parse(lines.join("\n"));
  return {
    type: "blockquote",
    children: inner.children,
  };
}

function parseParagraph(lines: string[]): ParagraphNode {
  // Join lines with soft breaks (a single newline inside a paragraph
  // is a soft break, not a hard <br/>).
  const joined = lines.join("\n");
  return {
    type: "paragraph",
    children: parseInline(joined),
  };
}

function parseList(items: BlockToken[], ordered: boolean): UnorderedListNode | OrderedListNode {
  const listItems: ListItemNode[] = items.map((item, idx) => {
    const token = item as BlockToken & {
      text: string;
      start?: number;
      checked?: boolean;
      task?: boolean;
    };
    return {
      type: "listItem",
      ordered,
      start: ordered ? (token.start ?? idx + 1) : undefined,
      task: token.task,
      checked: token.checked,
      children: parseInline(token.text),
    };
  });

  if (ordered) {
    const start = (items[0] as { start?: number })?.start ?? 1;
    return {
      type: "orderedList",
      start,
      children: listItems,
    };
  }

  return {
    type: "unorderedList",
    children: listItems,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline-level parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a string of inline Markdown into a list of inline AST node children.
 *
 * Delegates to the lexer's `tokenizeInline` — the inline tokens already
 * carry their final AST shape, so we just pass them through as children.
 */
export function parseInline(input: string): MarkdownNodeChild[] {
  const tokens: InlineToken[] = tokenizeInline(input);
  // The inline tokens are already shaped as AST nodes; cast them to children.
  return tokens as unknown as MarkdownNodeChild[];
}
