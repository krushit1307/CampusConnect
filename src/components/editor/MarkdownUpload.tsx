/**
 * MarkdownUpload Component
 *
 * Provides a clean UI for users to upload existing Markdown files,
 * which are then parsed into Tiptap JSON and loaded into the editor.
 */

import * as React from "react";
import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { parseMarkdownToTiptap } from "../../lib/tiptap/markdown-parser";
import { Progress } from "@/components/ui/progress";

interface MarkdownUploadProps {
  onContentLoaded: (jsonContent: Record<string, any>) => void;
}

export const MarkdownUpload: React.FC<MarkdownUploadProps> = ({
  onContentLoaded,
}: MarkdownUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    setUploadProgress(0);

    try {
      const result = await parseMarkdownToTiptap(file, setUploadProgress);

      if (result.success && result.data) {
        setSuccess(`Successfully parsed "${result.fileName}"`);
        onContentLoaded(result.data);
      } else {
        setError(result.error || "Failed to parse the Markdown file.");
      }
    } catch (err) {
      setError("An unexpected error occurred while uploading.");
    } finally {
      setIsLoading(false);
      setUploadProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200 ease-in-out
          ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-800"
          }
          ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          accept=".md,text/markdown"
          className="hidden"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          {isLoading ? (
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400"></div>
          ) : (
            <FileText className="h-10 w-10 text-gray-400 dark:text-gray-500" />
          )}

          <div className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-blue-600 dark:text-blue-400">Click to upload</span>{" "}
            or drag and drop
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Markdown files only (.md)</p>

          {uploadProgress !== null && isLoading && (
            <div className="w-full mt-4">
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400 mb-1 block">
                Uploading {uploadProgress}%
              </span>
              <Progress value={uploadProgress} className="h-1.5" />
            </div>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mt-4 flex items-center p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300 rounded-md">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 flex items-center p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-300 rounded-md">
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}
    </div>
  );
};
