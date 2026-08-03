import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import Cropper from "react-easy-crop";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { createClient, getSupabaseUrl } from "@/lib/supabase/client";
import { uploadFileWithProgress } from "@/lib/supabase/uploadFileWithProgress";
import { getCroppedImg, type Area } from "@/utils/cropImage";
import { compressImage } from "@/utils/imageCompressor";
import { getExifOrientation, correctImageOrientation } from "@/utils/exifOrientation";import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface ImageCropUploadProps {
  /** Aspect ratio for the crop (e.g. 1 for square, 16/9 for banner). */
  aspect: number;
  /** Supabase Storage bucket name to upload into. */
  bucket: string;
  /** Existing image URL to show as the current value. */
  value?: string;
  /** Called with the final public URL after a successful upload. */
  onUploaded: (url: string) => void;
  /** Accepted MIME types for the file input. */
  accept?: string;
  /** Maximum file size in bytes (default 5 MB). */
  maxSizeBytes?: number;
  /** Descriptive label shown in the drop zone (e.g. "Profile picture"). */
  label?: string;
  /** Smaller hint text shown below the drop zone. */
  hint?: string;
  /** Hide the drop zone entirely and only expose the hidden file input via ref. */
  triggerOnly?: boolean;
  /** Optional external ref to trigger file picker. */
  triggerRef?: React.RefObject<HTMLInputElement | null>;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp";
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;

/**
 * Reusable drag-and-drop / click-to-browse image upload with crop + zoom.
 *
 * Combines the DnD pattern from `settings.tsx` with the crop dialog from
 * `CreateClubDialog.tsx` into a single self-contained component.
 */
export function ImageCropUpload({
  aspect,
  bucket,
  value,
  onUploaded,
  accept = DEFAULT_ACCEPT,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  label,
  hint,
  triggerOnly = false,
  triggerRef,
}: ImageCropUploadProps) {
  const supabase = useRef(createClient()).current;
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = triggerRef ?? internalInputRef;

  const [preview, setPreview] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const displayUrl = preview ?? value ?? null;

  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------
  function validateFile(file: File): boolean {
    const allowed = accept.split(",").map((t) => t.trim());
    if (!allowed.includes(file.type)) {
      toast.error("Only JPG, PNG and WEBP images are allowed.");
      return false;
    }
    if (file.size > maxSizeBytes) {
      toast.error(`Image must be under ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`);
      return false;
    }
    return true;
  }

  // ------------------------------------------------------------------
  // File selection → open crop dialog
  // ------------------------------------------------------------------
function openCropDialog(file: File) {
    if (!validateFile(file)) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      const rawDataUrl = reader.result as string;
      const orientation = await getExifOrientation(file);
      const correctedDataUrl =
        orientation > 1 ? await correctImageOrientation(rawDataUrl, orientation) : rawDataUrl;
      setCropImageSrc(correctedDataUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    });
    reader.readAsDataURL(file);
  }
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) openCropDialog(file);
    event.target.value = "";
  }

  // ------------------------------------------------------------------
  // Crop confirm → upload
  // ------------------------------------------------------------------
  async function handleCropConfirm() {
    if (!cropImageSrc || !croppedAreaPixels || !selectedFile) return;

    setUploading(true);
    setCropImageSrc(null);

    try {
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], "avatar.webp", {
        type: "image/webp",
      });

      const publicUrl = await uploadFile(croppedFile);
      if (publicUrl) {
        setPreview(publicUrl);
        toast.success("Image uploaded.");
        onUploaded(publicUrl);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to crop and upload image.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  // ------------------------------------------------------------------
  // Supabase Storage upload (reuses uploadFileWithProgress)
  // ------------------------------------------------------------------
  async function uploadFile(file: File): Promise<string | undefined> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in first.");
      return undefined;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Session expired. Please sign in again.");
      return undefined;
    }

    const supabaseUrl = getSupabaseUrl();
    const compressedFile = await compressImage(file, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.8,
    });
    const extension = compressedFile.name.split(".").pop()?.toLowerCase() ?? "webp";
    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

    await uploadFileWithProgress(
      supabaseUrl,
      session.access_token,
      bucket,
      filePath,
      compressedFile,
      setUploadProgress,
    );
    setUploadProgress(null);

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return publicUrl;
  }

  // ------------------------------------------------------------------
  // Drag-and-drop (native HTML5, matching settings.tsx pattern)
  // ------------------------------------------------------------------
  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (uploading) return;
    dragDepthRef.current += 1;
    if (event.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (uploading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) openCropDialog(file);
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const cropDialogTitle = aspect === 1 ? "Crop Image" : "Crop Banner";

  return (
    <>
      {/* Drop zone / preview */}
      <div className="relative mx-auto shrink-0">
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !uploading) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label={
            label
              ? `Upload ${label}. Click to browse, or drag and drop an image.`
              : "Upload image. Click to browse, or drag and drop an image."
          }
          className={`neu-border flex cursor-pointer flex-col items-center justify-center gap-1.5 border-2 border-dashed p-5 text-center transition-colors duration-150 ${
            uploading
              ? "cursor-not-allowed border-black bg-gray-100 opacity-70"
              : isDragging
                ? "border-black bg-lime/40 scale-[1.01]"
                : displayUrl
                  ? "border-black bg-white hover:bg-cream"
                  : "border-black bg-white hover:bg-cream"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : displayUrl ? (
            <img
              src={displayUrl}
              alt={label ?? "Uploaded image"}
              className="max-h-32 w-full object-cover"
            />
          ) : (
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          )}
          <p className="font-mono text-xs font-bold uppercase">
            {uploading
              ? "Uploading..."
              : isDragging
                ? "Drop to upload"
                : displayUrl
                  ? "Replace image"
                  : "Drag & drop or click to upload"}
          </p>
          {hint && <p className="font-mono text-[10px] text-muted-foreground">{hint}</p>}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Crop dialog */}
      <Dialog
        open={!!cropImageSrc}
        onOpenChange={(open) => {
          if (!open) {
            setCropImageSrc(null);
            setSelectedFile(null);
          }
        }}
      >
        <DialogContent className="neu-border neu-shadow bg-cream sm:max-w-md text-black max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-black">{cropDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="relative h-64 w-full bg-black/10 mt-2 overflow-hidden">
            {cropImageSrc && (
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(
                  _,
                  croppedPixels: {
                    width: number;
                    height: number;
                    x: number;
                    y: number;
                  },
                ) => setCroppedAreaPixels(croppedPixels)}
              />
            )}
          </div>
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs font-mono font-bold">
              <span>Zoom</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-black"
            />
          </div>
          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => {
                setCropImageSrc(null);
                setSelectedFile(null);
              }}
              className="neu-border bg-white text-black font-mono text-xs font-bold uppercase py-2 px-4 hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCropConfirm}
              className="neu-border bg-black text-cream font-mono text-xs font-bold uppercase py-2 px-4 hover:bg-lime hover:text-black"
            >
              Crop &amp; Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
