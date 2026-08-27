// =============================================================================
// Component: ConstitutionDiffViewer
// Issue: #3536 - Implement 'Club Constitution Conflict Resolver'
// Description: Renders extracted constitution text alongside AI violations and
// plagiarism matches, highlighting exact duplicated paragraphs for reviewers.
// =============================================================================

import React, { useMemo } from "react";
import type {
  ConstitutionDocument,
  ConstitutionViolation,
} from "../../hooks/useConstitutionLinter";

interface ConstitutionDiffViewerProps {
  document: ConstitutionDocument;
}

export const ConstitutionDiffViewer: React.FC<ConstitutionDiffViewerProps> = ({ document }) => {
  // Sort violations by severity
  const sortedViolations = useMemo(() => {
    if (!document.violations) return [];
    return [...document.violations].sort((a, b) => {
      const severityOrder = { severe: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }, [document.violations]);

  const plagiarismParagraphs = useMemo(
    () => document.plagiarism_matches?.flatMap((match) => match.duplicateParagraphs || []) || [],
    [document.plagiarism_matches],
  );

  // Highlight plagiarism paragraphs and policy violation quotes in the raw text.
  const highlightedText = useMemo(() => {
    if (!document.raw_text) return "No text extracted.";

    let text = document.raw_text;
    // Escape HTML first to prevent XSS
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    plagiarismParagraphs.forEach((match, index) => {
      if (match.currentParagraph.length > 10) {
        const escapedParagraph = match.currentParagraph
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const replacement = `<mark class="bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100 px-1 rounded" title="Potential duplicate paragraph #${index + 1}">${escapedParagraph}</mark>`;
        text = text.replace(escapedParagraph, replacement);
      }
    });

    sortedViolations.forEach((v, index) => {
      if (v.quote && v.quote.length > 10) {
        const escapedQuote = v.quote
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const colorClass =
          v.severity === "severe"
            ? "bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100"
            : v.severity === "warning"
              ? "bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-100"
              : "bg-blue-200 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100";

        const replacement = `<mark class="${colorClass} px-1 rounded" title="Violation #${index + 1}">${escapedQuote}</mark>`;
        text = text.replace(escapedQuote, replacement);
      }
    });

    return text;
  }, [document.raw_text, plagiarismParagraphs, sortedViolations]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "severe":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400";
      case "warning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[600px]">
      {/* Text Viewer */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
            Document Text (Highlighted)
          </h3>
        </div>
        <div
          className="flex-1 p-4 overflow-y-auto text-sm text-gray-800 dark:text-gray-300 leading-relaxed whitespace-pre-wrap custom-scrollbar"
          dangerouslySetInnerHTML={{ __html: highlightedText }}
        />
      </div>

      {/* Violations List */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">Review Findings</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {document.plagiarism_review_required && (
            <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 dark:bg-red-950/30">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-red-800 dark:text-red-200">Plagiarism Warning</h4>
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {Math.round(document.plagiarism_score * 100)}% MATCH
                </span>
              </div>
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                This constitution is highly similar to {document.plagiarism_matches.length} active
                constitution(s). Review the highlighted paragraphs before approving it.
              </p>
              <div className="mt-3 space-y-2">
                {document.plagiarism_matches.map((match) => (
                  <details
                    key={match.sourceDocumentId}
                    className="rounded border border-red-200 bg-white/70 p-2 dark:border-red-800 dark:bg-black/20"
                  >
                    <summary className="cursor-pointer text-xs font-bold text-red-800 dark:text-red-200">
                      {match.sourceClubName || "Another club"} ·{" "}
                      {Math.round(match.similarity * 100)}% similarity
                    </summary>
                    <div className="mt-2 space-y-2 text-xs text-red-900 dark:text-red-100">
                      {match.duplicateParagraphs.map((paragraph, index) => (
                        <div
                          key={`${match.sourceDocumentId}-${index}`}
                          className="border-l-2 border-red-400 pl-2"
                        >
                          <p>
                            <strong>Uploaded paragraph:</strong> {paragraph.currentParagraph}
                          </p>
                          <p className="mt-1">
                            <strong>Existing paragraph:</strong> {paragraph.sourceParagraph}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
            Detected Policy Violations ({sortedViolations.length})
          </h4>
          {sortedViolations.length === 0 ? (
            <div className="text-center py-12 text-green-600 dark:text-green-400">
              <svg
                className="w-12 h-12 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="font-bold">No violations detected!</p>
              <p className="text-sm mt-1">This constitution appears fully compliant.</p>
            </div>
          ) : (
            sortedViolations.map((v, idx) => (
              <div
                key={v.id}
                className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    {v.clause_reference}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${getSeverityBadge(v.severity)}`}
                  >
                    {v.severity}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2 italic">
                  "{v.quote}"
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-bold">Reason:</span> {v.reason}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
