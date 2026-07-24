/**
 * Markdown Lexer / Tokenizer
 *
 * Scans a raw Markdown string into a flat list of tokens. The parser then
 * converts these tokens into a hierarchical AST.
 *
 * Design notes:
 *   - Block-level tokenization is line-oriented (CommonMark-style).
 *   - Inline tokenization is character-scanning with a small state machine.
 *   - The lexer is intentionally permissive: unrecognized syntax falls back
 *     to plain text so the renderer never crashes.
 *   - Zero dependencies — pure TypeScript.
 */

import type {
  HeadingNode,
  CodeBlockNode,
  BlockquoteNode,
  ListItemNode,
  ThematicBreakNode,
  ParagraphNode,
  TextNode,
  BoldNode,
  ItalicNode,
  StrikethroughNode,
  InlineCodeNode,
  LinkNode,
  ImageNode,
  LineBreakNode,
  SoftBreakNode,
  MarkdownNodeChild,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Block-level tokenization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A line that has been classified as belonging to a specific block construct.
 * The parser groups these into block nodes.
 */
export type BlockToken =
  | { kind: "heading"; depth: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { kind: "codeBlock"; lang: string; value: string }
  | { kind: "blockquote"; text: string }
  | { kind: "unorderedListItem"; text: string; marker: "-" | "*" | "+" }
  | { kind: "orderedListItem"; text: string; start: number }
  | { kind: "thematicBreak" }
  | { kind: "blank" }
  | { kind: "paragraph"; text: string };

/** Regex: ATX heading — 1–6 `#` followed by text. */
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

/** Regex: fenced code block opening — ```` ```lang ```` or ```` ~~~lang ````. */
const FENCE_OPEN_RE = /^(`{3,}|~{3,})\s*(.*)$/;

/** Regex: thematic break — `---`, `***`, `___` (3+ same chars, spaces ok). */
const THEMATIC_BREAK_RE = /^(?:\s*\*\s*){3,}$|^(?:\s*-\s*){3,}$|^(?:\s*_\s*){3,}$/;

/** Regex: blockquote marker — `>` optionally followed by a space. */
const BLOCKQUOTE_RE = /^>\s?(.*)$/;

/** Regex: unordered list item — `-`, `*`, or `+` followed by a space. */
const UNORDERED_LIST_RE = /^([-*+])\s+(.*)$/;

/** Regex: ordered list item — `1.` or `1)` followed by a space. */
const ORDERED_LIST_RE = /^(\d+)[.)]\s+(.*)$/;

/** Regex: task-list checkbox inside a list item — `[ ]` or `[x]`. */
const TASK_MARKER_RE = /^\[([ xX])\]\s+(.*)$/;

/**
 * Tokenize the input Markdown into block-level tokens.
 *
 * Block tokenization is line-oriented. We scan line-by-line, detect fenced
 * code blocks first (since their contents must not be re-parsed), then
 * classify each remaining line.
 */
export function tokenizeBlocks(input: string): BlockToken[] {
  const tokens: BlockToken[] = [];
  const lines = input.replace(/\r\n?/g, "\n").split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // ── Blank line ────────────────────────────────────────────────────────
    if (line.trim() === "") {
      tokens.push({ kind: "blank" });
      i++;
      continue;
    }

    // ── Fenced code block ─────────────────────────────────────────────────
    const fenceMatch = line.match(FENCE_OPEN_RE);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const lang = fenceMatch[2].trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        const closing = lines[i].match(new RegExp(`^${fence[0]}{${fence.length},}\\s*$`));
        if (closing) {
          i++;
          break;
        }
        codeLines.push(lines[i]);
        i++;
      }
      tokens.push({
        kind: "codeBlock",
        lang,
        value: codeLines.join("\n"),
      });
      continue;
    }

    // ── ATX heading ───────────────────────────────────────────────────────
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const depth = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const text = headingMatch[2].replace(/#+\s*$/, "").trim();
      tokens.push({ kind: "heading", depth, text });
      i++;
      continue;
    }

    // ── Thematic break ────────────────────────────────────────────────────
    if (THEMATIC_BREAK_RE.test(line.trim())) {
      tokens.push({ kind: "thematicBreak" });
      i++;
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────
    const blockquoteMatch = line.match(BLOCKQUOTE_RE);
    if (blockquoteMatch) {
      tokens.push({ kind: "blockquote", text: blockquoteMatch[1] });
      i++;
      continue;
    }

    // ── Ordered list item ─────────────────────────────────────────────────
    const orderedMatch = line.match(ORDERED_LIST_RE);
    if (orderedMatch) {
      const start = parseInt(orderedMatch[1], 10);
      let text = orderedMatch[2];
      const taskMatch = text.match(TASK_MARKER_RE);
      let checked: boolean | undefined;
      if (taskMatch) {
        checked = taskMatch[1].toLowerCase() === "x";
        text = taskMatch[2];
      }
      tokens.push({
        kind: "orderedListItem",
        text,
        start,
        // Attach checked via a side-channel since BlockToken doesn't carry it.
        // The parser reads it from a parallel map.
        ...({ checked, task: checked !== undefined } as Record<string, unknown>),
      } as BlockToken & { checked?: boolean; task?: boolean });
      i++;
      continue;
    }

    // ── Unordered list item ───────────────────────────────────────────────
    const unorderedMatch = line.match(UNORDERED_LIST_RE);
    if (unorderedMatch) {
      const marker = unorderedMatch[1] as "-" | "*" | "+";
      let text = unorderedMatch[2];
      const taskMatch = text.match(TASK_MARKER_RE);
      let checked: boolean | undefined;
      if (taskMatch) {
        checked = taskMatch[1].toLowerCase() === "x";
        text = taskMatch[2];
      }
      tokens.push({
        kind: "unorderedListItem",
        text,
        marker,
        ...({ checked, task: checked !== undefined } as Record<string, unknown>),
      } as BlockToken & { checked?: boolean; task?: boolean });
      i++;
      continue;
    }

    // ── Paragraph (default) ───────────────────────────────────────────────
    tokens.push({ kind: "paragraph", text: line });
    i++;
  }

  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline-level tokenization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inline tokens produced by the inline lexer. These are already typed to match
 * AST node shapes so the parser can lift them directly into the tree.
 */
export type InlineToken =
  | TextNode
  | BoldNode
  | ItalicNode
  | StrikethroughNode
  | InlineCodeNode
  | LinkNode
  | ImageNode
  | LineBreakNode
  | SoftBreakNode;

/**
 * Regex: image syntax — `![alt](url "title")`.
 * Captures: alt, url, optional title.
 */
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;

/**
 * Regex: link syntax — `[text](url "title")`.
 * Captures: text, url, optional title.
 */
const LINK_RE = /^\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;

/**
 * Tokenize a single line of inline Markdown content into inline tokens.
 *
 * Uses a cursor-based scanner. At each position it tries the longest-match
 * patterns first (image before link, code before bold, etc.) and falls back
 * to accumulating plain text when nothing matches.
 *
 * Newlines are not expected here (the block tokenizer splits on lines); a
 * soft break is emitted as a space by the text-accumulation path.
 */
export function tokenizeInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let textBuffer = "";
  let i = 0;

  const flushText = () => {
    if (textBuffer) {
      tokens.push({ type: "text", value: textBuffer });
      textBuffer = "";
    }
  };

  while (i < input.length) {
    const rest = input.slice(i);

    // ── Line break: two+ trailing spaces (rendered as <br/>) ─────────────
    if (
      input[i] === " " &&
      input[i + 1] === " " &&
      (input[i + 2] === "\n" || i + 2 === input.length)
    ) {
      flushText();
      tokens.push({ type: "lineBreak" });
      i += 2;
      continue;
    }

    // ── Soft break: a literal newline in the middle of inline content ────
    if (input[i] === "\n") {
      flushText();
      tokens.push({ type: "softBreak" });
      i++;
      continue;
    }

    // ── Inline code: `` `code` `` or `` ``code`` `` (double backticks) ───
    const codeMatch = rest.match(/^(`{1,})([^`]+?)\1(?!`)/);
    if (codeMatch) {
      flushText();
      tokens.push({ type: "inlineCode", value: codeMatch[2] });
      i += codeMatch[0].length;
      continue;
    }

    // ── Image: `![alt](url)` (must come before link) ─────────────────────
    const imageMatch = rest.match(IMAGE_RE);
    if (imageMatch) {
      flushText();
      tokens.push({
        type: "image",
        alt: imageMatch[1],
        src: imageMatch[2],
        title: imageMatch[3] || undefined,
      });
      i += imageMatch[0].length;
      continue;
    }

    // ── Link: `[text](url)` ──────────────────────────────────────────────
    const linkMatch = rest.match(LINK_RE);
    if (linkMatch) {
      flushText();
      // Recursively tokenize the link text so bold/italic inside links work.
      const linkChildren = tokenizeInline(linkMatch[1]);
      tokens.push({
        type: "link",
        href: linkMatch[2],
        title: linkMatch[3] || undefined,
        children: linkChildren as MarkdownNodeChild[],
      });
      i += linkMatch[0].length;
      continue;
    }

    // ── Strikethrough: `~~text~~` (must come before bold/italic) ─────────
    const strikeMatch = rest.match(/^~~(?=\S)(.+?)(?<=\S)~~/);
    if (strikeMatch) {
      flushText();
      tokens.push({
        type: "strikethrough",
        children: tokenizeInline(strikeMatch[1]) as MarkdownNodeChild[],
      });
      i += strikeMatch[0].length;
      continue;
    }

    // ── Bold: `**text**` or `__text__` ───────────────────────────────────
    const boldMatch =
      rest.match(/^\*\*(?=\S)(.+?)(?<=\S)\*\*(?!\*)/) || rest.match(/^__(?=\S)(.+?)(?<=\S)__(?!_)/);
    if (boldMatch) {
      flushText();
      tokens.push({
        type: "bold",
        children: tokenizeInline(boldMatch[1]) as MarkdownNodeChild[],
      });
      i += boldMatch[0].length;
      continue;
    }

    // ── Italic: `*text*` or `_text*` (after bold is ruled out) ───────────
    const italicMatch =
      rest.match(/^\*(?=\S)(.+?)(?<=\S)\*(?!\*)/) || rest.match(/^_(?=\S)(.+?)(?<=\S)_(?!_)/);
    if (italicMatch) {
      flushText();
      tokens.push({
        type: "italic",
        children: tokenizeInline(italicMatch[1]) as MarkdownNodeChild[],
      });
      i += italicMatch[0].length;
      continue;
    }

    // ── Default: accumulate as plain text ────────────────────────────────
    textBuffer += input[i];
    i++;
  }

  flushText();
  return tokens;
}
