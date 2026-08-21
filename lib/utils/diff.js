/**
 * Simple line-by-line diff generator highlighting additions and deletions.
 */
export function generateLineDiff(originalText = '', proposedText = '') {
  const originalLines = originalText.split('\n');
  const proposedLines = proposedText.split('\n');
  
  const diffResult = [];
  const maxLen = Math.max(originalLines.length, proposedLines.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = originalLines[i];
    const prop = proposedLines[i];

    if (orig === prop) {
      diffResult.push({ type: 'unchanged', text: orig });
    } else {
      if (orig !== undefined) {
        diffResult.push({ type: 'removed', text: orig });
      }
      if (prop !== undefined) {
        diffResult.push({ type: 'added', text: prop });
      }
    }
  }

  return diffResult;
}
