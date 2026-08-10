export interface DiffChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/**
 * Computes word-level differences between two strings using dynamic programming (LCS).
 * Words deleted in newStr are marked as removed (red); words added are marked as added (green).
 */
export function diffWords(oldStr: string, newStr: string): DiffChange[] {
  const oldWords = (oldStr || "").split(/(\s+)/);
  const newWords = (newStr || "").split(/(\s+)/);

  const dp: number[][] = Array(oldWords.length + 1)
    .fill(null)
    .map(() => Array(newWords.length + 1).fill(0));

  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffChange[] = [];
  let i = oldWords.length;
  let j = newWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ value: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ value: newWords[j - 1], added: true });
      j--;
    } else {
      result.unshift({ value: oldWords[i - 1], removed: true });
      i--;
    }
  }

  // Combine consecutive items of same type to optimize rendering
  const optimized: DiffChange[] = [];
  for (const change of result) {
    const last = optimized[optimized.length - 1];
    if (
      last &&
      ((last.added && change.added) ||
        (last.removed && change.removed) ||
        (!last.added && !last.removed && !change.added && !change.removed))
    ) {
      last.value += change.value;
    } else {
      optimized.push(change);
    }
  }

  return optimized;
}
