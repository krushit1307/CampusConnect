// =============================================================================
// Module: Text Differ & HTML Sanitizer
// Issue: #2439 - Sophisticated RichTextDiffViewer for auditing Constitution changes
// Description: Handles the core diffing logic. Strips HTML tags to prevent
// catastrophic diffing of angle brackets, converts to plaintext, and runs
// word-level diffing using the `diff` library pattern.
// =============================================================================

/**
 * Represents a single chunk of the diffed text.
 */
export interface DiffChunk {
  value: string;
  added?: boolean;
  removed?: boolean;
  type: "added" | "removed" | "neutral";
}

/**
 * Strips all HTML tags from a string, leaving only plaintext.
 * This is CRITICAL because diffing raw HTML like `<b>Hello</b>` -> `<i>Hello</i>`
 * would highlight the literal `<` and `b` characters as changes, breaking the UI.
 *
 * @param html - The raw HTML string
 * @returns Clean plaintext string
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";

  // Replace block-level elements with newlines to preserve paragraph structure
  let text = html.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n");

  // Replace <br> tags with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace (collapse multiple spaces into one)
  text = text.replace(/[ \t]+/g, " ");

  return text.trim();
}

/**
 * Computes the word-level difference between two strings.
 * This is a custom implementation of the Myers diff algorithm tailored for
 * word-level granularity, avoiding the need for external dependencies if restricted.
 *
 * @param oldText - The original plaintext
 * @param newText - The modified plaintext
 * @returns Array of DiffChunks representing the changes
 */
export function diffWords(oldText: string, newText: string): DiffChunk[] {
  // Tokenize by words and spaces
  const tokenize = (str: string): string[] => {
    return str.match(/\S+|\s+/g) || [];
  };

  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  // Simple LCS (Longest Common Subsequence) based diff
  // For production, a library like `diff` is preferred, but this ensures
  // zero-dependency compliance while maintaining word-level accuracy.
  const lcs = computeLCS(oldTokens, newTokens);

  const chunks: DiffChunk[] = [];
  let i = 0,
    j = 0,
    k = 0;

  while (i < oldTokens.length || j < newTokens.length) {
    if (
      i < oldTokens.length &&
      j < newTokens.length &&
      oldTokens[i] === newTokens[j] &&
      oldTokens[i] === lcs[k]
    ) {
      // Neutral (Unchanged)
      chunks.push({ value: oldTokens[i], type: "neutral" });
      i++;
      j++;
      k++;
    } else if (j < newTokens.length && (i >= oldTokens.length || newTokens[j] !== lcs[k])) {
      // Added
      chunks.push({ value: newTokens[j], added: true, type: "added" });
      j++;
    } else if (i < oldTokens.length && (j >= newTokens.length || oldTokens[i] !== lcs[k])) {
      // Removed
      chunks.push({ value: oldTokens[i], removed: true, type: "removed" });
      i++;
    }
  }

  return mergeAdjacentChunks(chunks);
}

/**
 * Computes the Longest Common Subsequence of two arrays.
 */
function computeLCS(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length;
  const n = arr2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the sequence
  const lcs: string[] = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Merges adjacent chunks of the same type to reduce DOM node count.
 * e.g., [ {value: "a", added: true}, {value: "b", added: true} ] -> [ {value: "ab", added: true} ]
 */
function mergeAdjacentChunks(chunks: DiffChunk[]): DiffChunk[] {
  if (chunks.length === 0) return [];

  const merged: DiffChunk[] = [chunks[0]];

  for (let i = 1; i < chunks.length; i++) {
    const current = chunks[i];
    const last = merged[merged.length - 1];

    if (current.type === last.type) {
      last.value += current.value;
    } else {
      merged.push(current);
    }
  }

  return merged;
}
