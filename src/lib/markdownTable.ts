/**
 * Utilities for the visual table builder: turning a 2D grid of cell strings
 * into a perfectly padded GitHub-Flavored-Markdown table.
 *
 * Kept dependency-free and framework-free so it's trivially unit-testable
 * and reusable by any editor surface (MarkdownEditor, MarkdownEditorWithMentions,
 * or future ones) without duplicating the conversion logic in each component.
 */

export type TableCells = string[][];

/** The visual builder is capped at 10x10 to avoid input-grid lag (see issue edge cases). */
export const MAX_TABLE_DIMENSION = 10;
/** A table always needs at least a 1x1 header cell. */
export const MIN_TABLE_DIMENSION = 1;

export function createEmptyTable(rows = 3, cols = 3): TableCells {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

/**
 * Prepares a single cell's raw input for embedding in a Markdown table cell.
 *
 * - Standard Markdown tables can't contain real line breaks inside a cell,
 *   so we convert them to `<br>` (safe, GFM-compatible) rather than silently
 *   dropping content the user typed.
 * - A literal `|` would otherwise be parsed as a new column boundary, so it's
 *   escaped.
 */
export function sanitizeCellForMarkdown(raw: string): string {
  return raw
    .replace(/\r\n|\r|\n/g, "<br>")
    .replace(/\|/g, "\\|")
    .trim();
}

/**
 * Converts a 2D grid of cell strings into a padded Markdown table string.
 * The first row is treated as the header row. Column widths are computed so
 * every `|` lines up visually in the raw text, not just in the rendered output.
 *
 * Returns an empty string for an empty or column-less grid.
 */
export function tableToMarkdown(cells: TableCells): string {
  if (cells.length === 0 || (cells[0]?.length ?? 0) === 0) return "";

  const sanitized = cells.map((row) => row.map(sanitizeCellForMarkdown));
  const columnCount = sanitized[0].length;

  const colWidths = Array.from({ length: columnCount }, (_, colIndex) =>
    Math.max(3, ...sanitized.map((row) => (row[colIndex] ?? "").length)),
  );

  const formatRow = (row: string[]) =>
    `| ${colWidths.map((width, i) => (row[i] ?? "").padEnd(width, " ")).join(" | ")} |`;

  const headerRow = formatRow(sanitized[0]);
  const separatorRow = `| ${colWidths.map((width) => "-".repeat(width)).join(" | ")} |`;
  const bodyRows = sanitized.slice(1).map(formatRow);

  return [headerRow, separatorRow, ...bodyRows].join("\n");
}
