/**
 * Computes the new full text and desired cursor position for inserting a
 * multi-line Markdown block (like a table) at the current cursor/selection.
 *
 * Block-level Markdown elements (tables, headings, etc.) only render
 * correctly when they sit on their own line, separated from surrounding
 * text by a blank line. This adds exactly the newlines needed to guarantee
 * that — no more, no less — regardless of whether the cursor is at the very
 * start/end of the document, mid-paragraph, or already on a blank line.
 */
function gapNeededBefore(text: string): string {
  if (text.length === 0) return "";
  if (text.endsWith("\n\n")) return "";
  return text.endsWith("\n") ? "\n" : "\n\n";
}

function gapNeededAfter(text: string): string {
  if (text.length === 0) return "";
  if (text.startsWith("\n\n")) return "";
  return text.startsWith("\n") ? "\n" : "\n\n";
}

export function insertMarkdownBlock(
  fullText: string,
  selectionStart: number,
  selectionEnd: number,
  block: string,
): { nextValue: string; cursorPosition: number } {
  const before = fullText.slice(0, selectionStart);
  const after = fullText.slice(selectionEnd);

  const leadingGap = gapNeededBefore(before);
  const trailingGap = gapNeededAfter(after);

  const insertion = `${leadingGap}${block}${trailingGap}`;
  const nextValue = `${before}${insertion}${after}`;
  const cursorPosition = before.length + leadingGap.length + block.length + trailingGap.length;

  return { nextValue, cursorPosition };
}
