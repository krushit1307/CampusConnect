import { useState, useCallback } from "react";
import UploadCloud from "lucide-react/dist/esm/icons/upload-cloud";
import File from "lucide-react/dist/esm/icons/file";
import X from "lucide-react/dist/esm/icons/x";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { useDropzone } from "react-dropzone";
import { Button } from "../ui/button";
import { supabase } from "../../lib/supabase/client";

interface ResumeDropzoneProps {
  eventId: string;
  userId: string;
  onUploadSuccess: (storagePath: string) => void;
  onUploadError?: (error: string) => void;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export function ResumeDropzone({
  eventId,
  userId,
  onUploadSuccess,
  onUploadError,
}: ResumeDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setError(null);
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0].code === "file-invalid-type") {
        setError("Only PDF resumes are supported.");
      } else if (rejection.errors[0].code === "file-too-large") {
        setError("Resume must be 2MB or smaller.");
      } else {
        setError(rejection.errors[0].message);
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxSize: MAX_SIZE,
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const storagePath = `${eventId}/${userId}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      onUploadSuccess(storagePath);
    } catch (err: any) {
      console.error("Resume upload failed:", err);
      const msg = err.message || "Failed to upload resume";
      setError(msg);
      if (onUploadError) onUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
  };

  if (file) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between p-4 border rounded-md bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-md dark:bg-red-900/30 dark:text-red-400">
              <File className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium line-clamp-1">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          {!uploading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFile}
              className="h-8 w-8 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={clearFile} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {uploading ? "Uploading..." : "Submit Resume"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-primary bg-primary/5" : "border-slate-300 hover:border-primary/50 dark:border-slate-700"}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
          <UploadCloud className="w-10 h-10 mb-4 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {isDragActive ? "Drop your resume here" : "Drag & drop your resume here"}
          </p>
          <p className="text-xs">or click to browse from your device</p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <File className="w-3 h-3" /> PDF only
            </span>
            <span>Max 2MB</span>
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
