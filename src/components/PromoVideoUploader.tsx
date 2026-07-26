import { useState, useRef, useEffect } from "react";
import { createClient, getSupabaseUrl } from "@/lib/supabase/client";
import { uploadFileResumable } from "@/lib/supabase/resumableUpload";
import { toast } from "sonner";
import {
  Video,
  UploadCloud,
  Trash2,
  RefreshCw,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Play,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PromoVideoUploaderProps {
  clubId: string;
  initialVideoUrl?: string;
  onUploadComplete: (url: string | null) => void;
}

type UploaderStatus = "idle" | "transcoding" | "uploading" | "done" | "error";

export function PromoVideoUploader({
  clubId,
  initialVideoUrl = "",
  onUploadComplete,
}: PromoVideoUploaderProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [videoUrl, setVideoUrl] = useState<string>(initialVideoUrl);
  const [status, setStatus] = useState<UploaderStatus>("idle");
  const [transcodeProgress, setTranscodeProgress] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [isMultiThreaded, setIsMultiThreaded] = useState<boolean>(false);

  useEffect(() => {
    setIsMultiThreaded(typeof SharedArrayBuffer !== "undefined");
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const calculateReduction = (orig: number, comp: number) => {
    if (orig <= 0) return 0;
    const reduction = ((orig - comp) / orig) * 100;
    return Math.round(reduction);
  };

  const handleVideoFile = async (file: File) => {
    if (!file) return;

    // Validate size and format
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a valid video file (MP4 or MOV).");
      return;
    }

    setOriginalSize(file.size);
    setCompressedSize(null);
    setStatus("transcoding");
    setTranscodeProgress(0);
    setUploadProgress(0);
    setErrorMsg("");

    try {
      // 1. Initialize Web Worker for client-side transcoding
      const worker = new Worker(new URL("/workers/transcode.js", window.location.origin));

      // Read file to ArrayBuffer to send to worker
      const arrayBuffer = await file.arrayBuffer();

      worker.onmessage = async (event) => {
        const { type, progress, fileData, error } = event.data;

        if (type === "progress") {
          setTranscodeProgress(progress);
        } else if (type === "error") {
          setStatus("error");
          setErrorMsg(error || "Transcoding failed.");
          toast.error("Video compression failed.");
          worker.terminate();
        } else if (type === "done") {
          // Transcoding done, we have the compressed ArrayBuffer
          const compressedBuffer = fileData as ArrayBuffer;
          setCompressedSize(compressedBuffer.byteLength);
          setStatus("uploading");
          worker.terminate();

          // Proceed to upload the compressed video to Supabase
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!session) {
              throw new Error("No active session. Please log in again.");
            }

            const supabaseUrl = getSupabaseUrl();
            // Store promotional video inside: club-promotions/<clubId>/promo.mp4
            const objectPath = `${clubId}/promo_${crypto.randomUUID()}.mp4`;

            const publicUrl = await uploadFileResumable(
              supabaseUrl,
              session.access_token,
              "club-promotions",
              objectPath,
              compressedBuffer,
              "video/mp4",
              (progressPercent) => {
                setUploadProgress(progressPercent);
              },
            );

            setVideoUrl(publicUrl);
            setStatus("done");
            onUploadComplete(publicUrl);
            toast.success("Promotional video uploaded successfully!");
          } catch (uploadError: unknown) {
            console.error(uploadError);
            const message =
              uploadError instanceof Error ? uploadError.message : "Failed to upload video.";
            setStatus("error");
            setErrorMsg(message);
            toast.error(message);
          }
        }
      };

      // Start transcoding in Web Worker
      worker.postMessage(
        {
          type: "transcode",
          fileData: arrayBuffer,
          fileName: file.name,
        },
        [arrayBuffer],
      );
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to compress video.";
      setStatus("error");
      setErrorMsg(message);
      toast.error(message);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleVideoFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleVideoFile(e.target.files[0]);
    }
  };

  const handleDelete = () => {
    setVideoUrl("");
    setStatus("idle");
    setOriginalSize(null);
    setCompressedSize(null);
    onUploadComplete(null);
    toast.info("Promotional video removed. Remember to save settings.");
  };

  return (
    <div className="space-y-4">
      <label className="font-mono text-sm font-bold uppercase block text-black">
        Promotional Video
      </label>

      {/* Mode / CPU Info Badge */}
      <div className="flex items-center gap-2 font-mono text-xs text-gray-500 bg-gray-50 p-2 border border-black max-w-fit">
        <Cpu size={14} className={status === "transcoding" ? "animate-spin text-lime-600" : ""} />
        {isMultiThreaded ? (
          <span className="text-green-700 font-bold">
            Multi-threaded Mode Active (SharedArrayBuffer)
          </span>
        ) : (
          <span className="text-amber-700 font-bold">Single-threaded Fallback Active</span>
        )}
      </div>

      {videoUrl && status === "idle" && (
        <div className="neu-border bg-black aspect-video relative group overflow-hidden max-w-xl">
          <video
            src={videoUrl}
            controls
            className="w-full h-full object-cover"
            preload="metadata"
          />
          <button
            type="button"
            onClick={handleDelete}
            className="absolute top-2 right-2 neu-border p-2 bg-red-400 text-black hover:bg-red-500 transition-colors"
            title="Delete Video"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {status === "idle" && !videoUrl && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`neu-border border-dashed border-2 p-8 text-center cursor-pointer transition-all max-w-xl ${
            isDragActive ? "bg-lime/10 border-lime-600" : "bg-white border-black hover:bg-gray-50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/mp4,video/quicktime"
            className="hidden"
          />
          <UploadCloud className="h-10 w-10 mx-auto mb-3 text-gray-400" />
          <p className="font-mono text-sm font-bold text-black uppercase">
            Drag & drop video file or click to browse
          </p>
          <p className="font-mono text-xs text-gray-500 mt-2">
            MP4 or MOV formats supported (will be compressed by ~80% before upload)
          </p>
        </div>
      )}

      {status === "transcoding" && (
        <div className="neu-border bg-white p-6 max-w-xl space-y-4">
          <div className="flex items-center justify-between font-mono text-sm">
            <span className="font-bold uppercase flex items-center gap-2">
              <RefreshCw className="animate-spin text-blue-600" size={16} />
              Compressing Video...
            </span>
            <span>{transcodeProgress}%</span>
          </div>
          <Progress value={transcodeProgress} className="h-2" />
          <p className="font-mono text-xs text-gray-500">
            Compressing video client-side in the background. Your interface remains fully
            interactive.
          </p>
          {originalSize && (
            <p className="font-mono text-xs text-black">
              Original Size: <span className="font-bold">{formatSize(originalSize)}</span>
            </p>
          )}
        </div>
      )}

      {status === "uploading" && (
        <div className="neu-border bg-white p-6 max-w-xl space-y-4">
          <div className="flex items-center justify-between font-mono text-sm">
            <span className="font-bold uppercase flex items-center gap-2">
              <UploadCloud className="animate-bounce text-lime-600" size={16} />
              Streaming chunks to storage...
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
          <p className="font-mono text-xs text-gray-500">
            Streaming compressed chunks via resumable TUS protocol to Supabase.
          </p>
          {originalSize && compressedSize && (
            <div className="font-mono text-xs text-black space-y-1">
              <p>
                Original Size:{" "}
                <span className="line-through text-gray-400">{formatSize(originalSize)}</span>
              </p>
              <p>
                Compressed Size:{" "}
                <span className="font-bold text-green-600">{formatSize(compressedSize)}</span> (
                {calculateReduction(originalSize, compressedSize)}% size reduction!)
              </p>
            </div>
          )}
        </div>
      )}

      {status === "done" && (
        <div className="neu-border bg-white p-6 max-w-xl space-y-4">
          <div className="flex items-center gap-2 font-mono text-sm text-green-700 font-bold uppercase">
            <CheckCircle size={18} />
            Transcoding & Upload Complete!
          </div>
          <div className="neu-border bg-black aspect-video relative overflow-hidden">
            <video
              src={videoUrl}
              controls
              className="w-full h-full object-cover"
              preload="metadata"
            />
          </div>
          <div className="flex justify-between items-center">
            {originalSize && compressedSize && (
              <p className="font-mono text-xs text-gray-600">
                Compressed <span className="line-through">{formatSize(originalSize)}</span> to{" "}
                <span className="font-bold text-green-600">{formatSize(compressedSize)}</span> (
                {calculateReduction(originalSize, compressedSize)}% size reduction)
              </p>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="neu-border py-1 px-3 bg-red-300 text-xs font-mono font-bold uppercase hover:bg-red-400 transition-colors"
            >
              Replace Video
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="neu-border bg-red-50 p-6 max-w-xl space-y-4">
          <div className="flex items-center gap-2 font-mono text-sm text-red-700 font-bold uppercase">
            <AlertTriangle size={18} />
            Processing Failed
          </div>
          <p className="font-mono text-sm text-red-600">{errorMsg}</p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="neu-border py-2 px-4 bg-white text-sm font-mono font-bold uppercase hover:bg-gray-100"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
