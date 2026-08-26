// =============================================================================
// Component: UploadVersionModal
// Issue: #2793 - Implement Semantic Versioning and Automated Changelog
// Description: Modal form for club admins to upload a new document version.
// Requires selection of semantic version type(Major / Minor / Patch) and a
// mandatory change summary.
// =============================================================================

import React, { useState } from "react";
import { useDocumentVersions } from "../../hooks/useDocumentVersions";

interface UploadVersionModalProps {
  documentId: string;
  currentVersion: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadVersionModal: React.FC<UploadVersionModalProps> = ({
  documentId,
  currentVersion,
  onClose,
  onSuccess,
}) => {
  const { uploadNewVersion, isUploading } = useDocumentVersions(documentId);

  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState("");
  const [versionType, setVersionType] = useState<"major" | "minor" | "patch">("patch");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    if (!summary.trim()) {
      setError("Please provide a change summary describing what was updated.");
      return;
    }

    const success = await uploadNewVersion(file, summary, versionType);
    if (success) {
      onSuccess();
      onClose();
    }
  };

  // Calculate preview of the next version number
  const getNextVersionPreview = () => {
    const parts = currentVersion.split(".").map(Number);
    let major = parts[0] || 1;
    let minor = parts[1] || 0;
    let patch = parts[2] || 0;

    if (versionType === "major") {
      major += 1;
      minor = 0;
      patch = 0;
    } else if (versionType === "minor") {
      minor += 1;
      patch = 0;
    } else {
      patch += 1;
    }

    return `${major}.${minor}.${patch}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upload New Version</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Current version: <span className="font-mono font-bold">v{currentVersion}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Document File
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      accept=".pdf,.md,.txt,.doc,.docx"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {file ? file.name : "PDF, Markdown, or Text up to 50MB"}
                </p>
              </div>
            </div>
          </div>

          {/* Version Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Version Type (Semantic Versioning)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["patch", "minor", "major"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVersionType(type)}
                  className={`p-3 border rounded-lg text-center transition-all ${
                    versionType === type
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500"
                      : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <div
                    className={`text-xs font-bold uppercase mb-1 ${
                      type === "major"
                        ? "text-red-600 dark:text-red-400"
                        : type === "minor"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {type}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {type === "major" && "Breaking changes"}
                    {type === "minor" && "New features"}
                    {type === "patch" && "Bug fixes / Typos"}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
              Next version will be:{" "}
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                v{getNextVersionPreview()}
              </span>
            </p>
          </div>

          {/* Change Summary */}
          <div>
            <label
              htmlFor="summary"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Change Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              id="summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., Updated Section 3 regarding membership dues and added new refund policy."
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                "Publish Version"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
