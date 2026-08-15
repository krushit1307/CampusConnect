// =============================================================================
// Component: DocumentDiffViewer
// Issue: #2793 - Implement Semantic Versioning and Automated Changelog
// Description: Fetches the raw text content of two document versions and
// renders a visual line - by - line diff using a custom diffing algorithm.
// =============================================================================

import React, { useEffect, useState } from "react";
import { DocumentVersion } from "../../hooks/useDocumentVersions";

interface DocumentDiffViewerProps {
  oldVersion: DocumentVersion;
  newVersion: DocumentVersion;
  onClose: () => void;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export const DocumentDiffViewer: React.FC<DocumentDiffViewerProps> = ({
  oldVersion,
  newVersion,
  onClose,
}) => {
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndDiff = async () => {
      setIsLoading(true);
      try {
        // Fetch raw text content from both URLs
        const [oldRes, newRes] = await Promise.all([
          fetch(oldVersion.file_url),
          fetch(newVersion.file_url),
        ]);

        const oldText = await oldRes.text();
        const newText = await newRes.text();

        // Simple line-by-line diffing algorithm (LCS based)
        const lines = computeLineDiff(oldText, newText);
        setDiffLines(lines);
      } catch (err: any) {
        setError(err.message || "Failed to compute diff");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndDiff();
  }, [oldVersion, newVersion]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Comparing v{oldVersion.version_number} → v{newVersion.version_number}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {oldVersion.change_summary} → {newVersion.change_summary}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto font-mono text-sm">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {error && (
            <div className="p-8 text-center text-red-600 dark:text-red-400">Error: {error}</div>
          )}

          {!isLoading && !error && (
            <table className="w-full border-collapse">
              <tbody>
                {diffLines.map((line, index) => (
                  <tr
                    key={index}
                    className={`
                      ${line.type === "added" ? "bg-green-50 dark:bg-green-900/20" : ""}
                      ${line.type === "removed" ? "bg-red-50 dark:bg-red-900/20" : ""}
                      hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                    `}
                  >
                    <td className="w-12 px-3 py-1 text-right text-gray-400 dark:text-gray-600 border-r border-gray-200 dark:border-gray-700 select-none">
                      {line.oldLineNum || ""}
                    </td>
                    <td className="w-12 px-3 py-1 text-right text-gray-400 dark:text-gray-600 border-r border-gray-200 dark:border-gray-700 select-none">
                      {line.newLineNum || ""}
                    </td>
                    <td className="w-8 px-3 py-1 text-center select-none">
                      {line.type === "added" && (
                        <span className="text-green-600 dark:text-green-400 font-bold">+</span>
                      )}
                      {line.type === "removed" && (
                        <span className="text-red-600 dark:text-red-400 font-bold">-</span>
                      )}
                    </td>
                    <td className="px-3 py-1 whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200">
                      {line.content}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Computes a simple line-by-line diff between two strings.
 * Returns an array of DiffLine objects indicating additions, deletions, and unchanged lines.
 */
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS (Longest Common Subsequence) approach for line diffing
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build the diff
  let i = m,
    j = n;
  const tempResult: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      tempResult.unshift({
        type: "unchanged",
        content: oldLines[i - 1],
        oldLineNum: i,
        newLineNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempResult.unshift({ type: "added", content: newLines[j - 1], newLineNum: j });
      j--;
    } else if (i > 0) {
      tempResult.unshift({ type: "removed", content: oldLines[i - 1], oldLineNum: i });
      i--;
    }
  }

  return tempResult;
}
