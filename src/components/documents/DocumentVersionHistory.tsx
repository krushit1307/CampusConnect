// =============================================================================
// Component: DocumentVersionHistory
// Issue: #2793 - Implement Semantic Versioning and Automated Changelog
// Description: Renders a vertical timeline sidebar displaying all historical
// versions of a document.Includes download buttons and triggers the diff
// viewer for text / markdown files.
// =============================================================================

import React, { useState } from "react";
import { DocumentVersion, useDocumentVersions } from "../../hooks/useDocumentVersions";
import { DocumentDiffViewer } from "./DocumentDiffViewer";

interface DocumentVersionHistoryProps {
  documentId: string;
}

export const DocumentVersionHistory: React.FC<DocumentVersionHistoryProps> = ({ documentId }) => {
  const { document, versions, isLoading, downloadVersion } = useDocumentVersions(documentId);
  const [selectedVersions, setSelectedVersions] = useState<{
    old: DocumentVersion | null;
    new: DocumentVersion | null;
  }>({
    old: null,
    new: null,
  });
  const [showDiff, setShowDiff] = useState(false);

  const handleCompare = (oldVer: DocumentVersion, newVer: DocumentVersion) => {
    setSelectedVersions({ old: oldVer, new: newVer });
    setShowDiff(true);
  };

  if (isLoading) {
    return (
      <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg
              className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Version History
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Current:{" "}
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              v{document?.current_version}
            </span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

            <div className="space-y-6">
              {versions.map((version, index) => (
                <div key={version.id} className="relative pl-10">
                  {/* Timeline Node */}
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 ${
                      index === 0
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {index === 0 ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold">
                        {version.version_number.split(".")[0]}
                      </span>
                    )}
                  </div>

                  {/* Version Card */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                        v{version.version_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          version.version_type === "major"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : version.version_type === "minor"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {version.version_type}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {version.change_summary}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500 mb-3">
                      <span>{new Date(version.created_at).toLocaleDateString()}</span>
                      <span className="truncate ml-2">
                        {version.uploader_profile?.full_name || "Unknown"}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadVersion(version)}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Download
                      </button>

                      {/* Only show compare button for text/markdown files and if not the latest */}
                      {["md", "txt"].includes(version.file_type) && index < versions.length - 1 && (
                        <button
                          onClick={() => handleCompare(versions[index + 1], version)}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                          Diff
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Diff Viewer Modal */}
      {showDiff && selectedVersions.old && selectedVersions.new && (
        <DocumentDiffViewer
          oldVersion={selectedVersions.old}
          newVersion={selectedVersions.new}
          onClose={() => setShowDiff(false)}
        />
      )}
    </>
  );
};
