/**
 * MarkdownRenderer — a safe, zero-dependency React renderer for the custom
 * Markdown AST.
 *
 * Security model:
 *   - The renderer walks the AST and maps each node to a React element.
 *   - It NEVER uses `dangerouslySetInnerHTML`.
 *   - All text content is rendered as React text children (React escapes it
 *     automatically), so `<script>` tags in the source become inert text.
 *   - All URLs pass through `sanitizeUrl()` before being placed in `href`/`src`.
 *   - Code block language classes are validated against an allowlist.
 *
 * Usage:
 *   <MarkdownRenderer source={"# Hello **world**"} />
 *   // or pass a pre-parsed AST:
 *   <MarkdownRenderer ast={parse(md)} />
 */

import { useMemo, type ReactNode } from "react";
import { parse } from "./parser";
import { sanitizeUrl, escapeHtml } from "./sanitize";
import type {
  RootNode,
  MarkdownNode,
  MarkdownNodeChild,
  HeadingNode,
  ParagraphNode,
  BoldNode,
  ItalicNode,
  StrikethroughNode,
  InlineCodeNode,
  CodeBlockNode,
  LinkNode,
  ImageNode,
  BlockquoteNode,
  ListItemNode,
  UnorderedListNode,
  OrderedListNode,
  ThematicBreakNode,
  TextNode,
  LineBreakNode,
  SoftBreakNode,
} from "./types";

/** Allowlist of code-block language classes (lowercase). */
const ALLOWED_LANGS = new Set([
  "ts",
  "tsx",
  "typescript",
  "js",
  "jsx",
  "javascript",
  "py",
  "python",
  "rb",
  "ruby",
  "go",
  "rs",
  "rust",
  "java",
  "kt",
  "kotlin",
  "swift",
  "c",
  "cpp",
  "csharp",
  "cs",
  "php",
  "sh",
  "bash",
  "zsh",
  "sql",
  "html",
  "css",
  "scss",
  "json",
  "yaml",
  "yml",
  "toml",
  "xml",
  "md",
  "markdown",
  "dockerfile",
  "text",
  "plain",
]);

/** Normalize a language string for use as a CSS class. */
function safeLangClass(lang: string): string | undefined {
  if (!lang) return undefined;
  const normalized = lang.trim().toLowerCase();
  if (ALLOWED_LANGS.has(normalized)) {
    return `language-${normalized}`;
  }
  return undefined;
}

export interface MarkdownRendererProps {
  /** Raw Markdown string to parse and render. */
  source?: string;
  /** A pre-parsed AST (takes precedence over `source`). */
  ast?: RootNode;
  /** Optional className for the root container. */
  className?: string;
}

/**
 * Render Markdown safely to React nodes.
 */
export function MarkdownRenderer({ source, ast, className }: MarkdownRendererProps) {
  const tree = useMemo(() => {
    if (ast) return ast;
    return parse(source ?? "");
  }, [ast, source]);

  return <div className={className}>{renderChildren(tree.children)}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node renderers
// ─────────────────────────────────────────────────────────────────────────────

/** Render a list of AST nodes (or strings) into React nodes. */
function renderChildren(children?: MarkdownNodeChild[]): ReactNode[] {
  if (!children) return [];
  return children.map((child, idx) => {
    if (typeof child === "string") {
      return <span key={idx}>{child}</span>;
    }
    return renderNode(child, idx);
  });
}

/** Render a single AST node. */
function renderNode(node: MarkdownNode, key: number): ReactNode {
  switch (node.type) {
    case "root":
      return <div key={key}>{renderChildren(node.children)}</div>;

    case "heading":
      return renderHeading(node, key);

    case "paragraph":
      return <p key={key}>{renderChildren(node.children)}</p>;

    case "bold":
      return <strong key={key}>{renderChildren(node.children)}</strong>;

    case "italic":
      return <em key={key}>{renderChildren(node.children)}</em>;

    case "strikethrough":
      return (
        <del key={key} aria-hidden={false}>
          {renderChildren(node.children)}
        </del>
      );

    case "inlineCode":
      return (
        <code key={key} className="md-inline-code">
          {node.value}
        </code>
      );

    case "codeBlock":
      return renderCodeBlock(node, key);

    case "link":
      return renderLink(node, key);

    case "image":
      return renderImage(node, key);

    case "blockquote":
      return (
        <blockquote key={key} className="md-blockquote">
          {renderChildren(node.children)}
        </blockquote>
      );

    case "unorderedList":
      return (
        <ul key={key} className="md-list md-list-unordered">
          {node.children.map((item, idx) => renderListItem(item, idx))}
        </ul>
      );

    case "orderedList":
      return (
        <ol key={key} className="md-list md-list-ordered" start={node.start}>
          {node.children.map((item, idx) => renderListItem(item, idx))}
        </ol>
      );

    case "thematicBreak":
      return <hr key={key} className="md-thematic-break" />;

    case "text":
      return <span key={key}>{node.value}</span>;

    case "lineBreak":
      return <br key={key} />;

    case "softBreak":
      return <span key={key}> </span>;

    default:
      // Unknown node type — render nothing rather than crashing.
      return null;
  }
}

function renderHeading(node: HeadingNode, key: number): ReactNode {
  const Tag = `h${node.depth}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return <Tag key={key}>{renderChildren(node.children)}</Tag>;
}

function renderCodeBlock(node: CodeBlockNode, key: number): ReactNode {
  const langClass = safeLangClass(node.lang);
  return (
    <pre key={key} className="md-code-block">
      <code className={langClass}>{node.value}</code>
    </pre>
  );
}

function renderLink(node: LinkNode, key: number): ReactNode {
  const href = sanitizeUrl(node.href);
  const title = node.title ? escapeHtml(node.title) : undefined;
  return (
    <a
      key={key}
      href={href}
      title={title}
      target="_blank"
      rel="noopener noreferrer"
      className="md-link"
    >
      {renderChildren(node.children)}
    </a>
  );
}

function renderImage(node: ImageNode, key: number): ReactNode {
  const src = sanitizeUrl(node.src);
  const alt = node.alt;
  const title = node.title || undefined;
  return <img key={key} src={src} alt={alt} title={title} className="md-image" loading="lazy" />;
}

function renderListItem(node: ListItemNode, key: number): ReactNode {
  // Task-list item: render a disabled checkbox + content.
  if (node.task) {
    return (
      <li key={key} className="md-list-item md-task-item">
        <input type="checkbox" checked={node.checked} readOnly disabled />
        <span className={node.checked ? "md-task-checked" : ""}>
          {renderChildren(node.children)}
        </span>
      </li>
    );
  }
  return (
    <li key={key} className="md-list-item">
      {renderChildren(node.children)}
    </li>
  );
}

// Re-export for external consumers that want to render a typed text node directly.
export type {
  RootNode,
  HeadingNode,
  ParagraphNode,
  BoldNode,
  ItalicNode,
  StrikethroughNode,
  InlineCodeNode,
  CodeBlockNode,
  LinkNode,
  ImageNode,
  BlockquoteNode,
  ListItemNode,
  UnorderedListNode,
  OrderedListNode,
  ThematicBreakNode,
  TextNode,
  LineBreakNode,
  SoftBreakNode,
};
