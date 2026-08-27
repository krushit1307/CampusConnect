// src/components/lost-found/ImageAutoTagger.tsx
//
// Reusable image auto-tagging component for the Lost & Found form.
//
// Usage:
//   <ImageAutoTagger
//     onTagsChange={(tags) => setFormTags(tags)}
//     onPiiDetected={() => setPiiWarning(true)}
//   />
//
// The component handles:
//   - File upload (drag-drop + click).
//   - Image compression (WebP thumbnail).
//   - Calling the Edge Function.
//   - PII detection → blocks submission + shows warning.
//   - Tag review UI (chips the user can delete).
//   - Re-analyzing after the user edits the image.

import { useCallback, useRef, useState } from "react";
import Upload from "lucide-react/dist/esm/icons/upload";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import X from "lucide-react/dist/esm/icons/x";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import { createClient } from "@/lib/supabase/client";
import { autoTagImage, type AutoTagResult } from "@/lib/imageTagger";

interface ImageAutoTaggerProps {
  /** Called whenever the tag list changes (after analysis or user edit). */
  onTagsChange: (tags: string[], imageUrl?: string) => void;
  /** Called when PII is detected in the uploaded image. The parent
   *  form should block submission when this fires. */
  onPiiDetected?: (reason: string) => void;
  /** Called when the user clears the image / tags. */
  onClear?: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "analyzing" }
  | { kind: "success"; result: AutoTagResult; previewUrl: string }
  | { kind: "pii_rejected"; reason: string; previewUrl: string }
  | { kind: "error"; message: string };

export function ImageAutoTagger({ onTagsChange, onPiiDetected, onClear }: ImageAutoTaggerProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentFileRef = useRef<File | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Validate file type.
      if (!file.type.startsWith("image/")) {
        setStatus({
          kind: "error",
          message: "Please upload an image file (JPEG, PNG, or WebP).",
        });
        return;
      }

      // Validate file size (max 10 MB before compression).
      if (file.size > 10 * 1024 * 1024) {
        setStatus({
          kind: "error",
          message: "Image is too large. Maximum 10 MB before compression.",
        });
        return;
      }

      currentFileRef.current = file;
      setStatus({ kind: "analyzing" });

      const previewUrl = URL.createObjectURL(file);
      const result = await autoTagImage(file);

      if (!result.ok) {
        URL.revokeObjectURL(previewUrl);
        setStatus({
          kind: "error",
          message: result.error.error,
        });
        return;
      }

      if (result.result.hasPii) {
        setStatus({
          kind: "pii_rejected",
          reason: result.result.piiReason ?? "Sensitive information detected in the image.",
          previewUrl,
        });
        onPiiDetected?.(result.result.piiReason ?? "PII detected");
        onTagsChange([], "");
        return;
      }

      // Upload file to Supabase storage public bucket 'lost-found'
      try {
        const supabase = createClient();
        const fileExt = file.name.split(".").pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("lost-found")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("lost-found")
          .getPublicUrl(filePath);

        setStatus({
          kind: "success",
          result: result.result,
          previewUrl,
        });
        onTagsChange(result.result.tags, urlData.publicUrl);
      } catch (err: any) {
        URL.revokeObjectURL(previewUrl);
        setStatus({
          kind: "error",
          message: err.message || "Failed to upload image to storage.",
        });
      }
    },
    [onTagsChange, onPiiDetected],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset the input so selecting the same file again re-triggers.
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (status.kind !== "success") return;
    const newTags = status.result.tags.filter((t) => t !== tagToRemove);
    const newResult: AutoTagResult = { ...status.result, tags: newTags };
    setStatus({ kind: "success", result: newResult, previewUrl: status.previewUrl });
    onTagsChange(newTags);
  };

  const handleClear = () => {
    if (status.kind === "success" || status.kind === "pii_rejected") {
      URL.revokeObjectURL(status.previewUrl);
    }
    currentFileRef.current = null;
    setStatus({ kind: "idle" });
    onTagsChange([], "");
    onClear?.();
  };

  const handleRetry = () => {
    if (currentFileRef.current) {
      handleFile(currentFileRef.current);
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Upload zone (shown when idle or error) ─────────── */}
      {(status.kind === "idle" || status.kind === "error") && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-indigo-500 hover:bg-indigo-50 dark:border-slate-600 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/30"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          {status.kind === "error" ? (
            <>
              <AlertTriangle className="mb-2 h-8 w-8 text-red-500" aria-hidden="true" />
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{status.message}</p>
              <p className="mt-1 text-xs text-slate-400">Click to try again</p>
            </>
          ) : (
            <>
              <Upload className="mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Upload a photo of the item
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Drag &amp; drop or click • JPEG, PNG, WebP • max 10 MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload item image"
      />

      {/* ── Analyzing state ────────────────────────────────── */}
      {status.kind === "analyzing" && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-slate-200 p-8 dark:border-slate-700">
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-indigo-500" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Analyzing image…</p>
          <p className="mt-1 text-xs text-slate-400">
            Detecting tags and checking for sensitive information
          </p>
        </div>
      )}

      {/* ── PII rejected ───────────────────────────────────── */}
      {status.kind === "pii_rejected" && (
        <div
          role="alert"
          className="overflow-hidden rounded-lg border-2 border-red-300 dark:border-red-700"
        >
          <div className="flex items-start gap-3 bg-red-50 p-4 dark:bg-red-950/40">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" aria-hidden="true" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-700 dark:text-red-400">
                Sensitive Information Detected
              </h4>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{status.reason}</p>
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                Please blur or crop out the sensitive information and re-upload the image. Items
                containing personal data cannot be posted.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 bg-white p-3 dark:bg-slate-900">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Choose different image
            </button>
          </div>
        </div>
      )}

      {/* ── Success: preview + editable tags ───────────────── */}
      {status.kind === "success" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          {/* Image preview */}
          <div className="relative">
            <img
              src={status.previewUrl}
              alt="Uploaded item preview"
              className="h-48 w-full object-cover"
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tags */}
          <div className="p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Auto-Generated Tags
              </span>
              <span className="text-xs text-slate-400">({status.result.tags.length})</span>
            </div>

            {status.result.tags.length === 0 ? (
              <p className="text-sm text-slate-400">
                No tags were generated. You can add manual tags below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {status.result.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 text-indigo-400 hover:text-red-500"
                      aria-label={`Remove tag "${tag}"`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-400">
              Review the tags above. Click × to remove any incorrect tags before submitting.
            </p>

            <button
              type="button"
              onClick={handleRetry}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Re-analyze image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
