/**
 * Diff Utility for Rich-Text Version History & Diff Viewer (#1501)
 * Computes word-level and line-level differences between two document text strings.
 */

export interface DiffChange {
  value: string;
  type: "added" | "removed" | "unchanged";
}

export interface DiffResult {
  changes: DiffChange[];
  stats: {
    addedCount: number;
    removedCount: number;
    unchangedCount: number;
  };
}

/**
 * Split text into tokens (words including trailing space/punctuation)
 */
function tokenizeWords(text: string): string[] {
  if (!text) return [];
  // Tokenize by word boundaries or whitespace
  return text.match(/\S+|\s+/g) || [];
}

/**
 * Split text into lines
 */
function tokenizeLines(text: string): string[] {
  if (!text) return [];
  return text.split(/\r?\n/);
}

/**
 * Longest Common Subsequence (LCS) based diff algorithm
 */
function computeLcsDiff<T>(
  seq1: T[],
  seq2: T[],
  isEqual: (a: T, b: T) => boolean = (a, b) => a === b,
): { type: "added" | "removed" | "unchanged"; item: T }[] {
  const m = seq1.length;
  const n = seq2.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (isEqual(seq1[i - 1], seq2[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const rawDiff: { type: "added" | "removed" | "unchanged"; item: T }[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && isEqual(seq1[i - 1], seq2[j - 1])) {
      rawDiff.push({ type: "unchanged", item: seq1[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.push({ type: "added", item: seq2[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.push({ type: "removed", item: seq1[i - 1] });
      i--;
    }
  }

  return rawDiff.reverse();
}

/**
 * Computes word-level diff between oldText (version A) and newText (version B).
 */
export function computeWordDiff(oldText: string = "", newText: string = ""): DiffResult {
  const words1 = tokenizeWords(oldText);
  const words2 = tokenizeWords(newText);

  const rawDiff = computeLcsDiff(words1, words2);

  // Group consecutive changes of the same type
  const changes: DiffChange[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  for (const step of rawDiff) {
    if (step.type === "added") addedCount++;
    else if (step.type === "removed") removedCount++;
    else unchangedCount++;

    if (changes.length > 0 && changes[changes.length - 1].type === step.type) {
      changes[changes.length - 1].value += step.item;
    } else {
      changes.push({ value: step.item, type: step.type });
    }
  }

  return {
    changes,
    stats: {
      addedCount,
      removedCount,
      unchangedCount,
    },
  };
}

/**
 * Computes line-level diff between oldText and newText.
 */
export function computeLineDiff(oldText: string = "", newText: string = ""): DiffResult {
  const lines1 = tokenizeLines(oldText);
  const lines2 = tokenizeLines(newText);

  const rawDiff = computeLcsDiff(lines1, lines2);

  const changes: DiffChange[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  for (const step of rawDiff) {
    if (step.type === "added") addedCount++;
    else if (step.type === "removed") removedCount++;
    else unchangedCount++;

    changes.push({
      value: step.item,
      type: step.type,
    });
  }

  return {
    changes,
    stats: {
      addedCount,
      removedCount,
      unchangedCount,
    },
  };
}
