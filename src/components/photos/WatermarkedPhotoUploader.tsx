import React, { useState } from "react";
import {
  ClubBrandingInfo,
  ProcessedPhotoAsset,
  WatermarkConfig,
} from "../../types/photoWatermarking";
import { photoWatermarkingPipelineService } from "../../services/photoWatermarkingPipelineService";

interface WatermarkedPhotoUploaderProps {
  eventId: string;
  clubId: string;
  uploaderId: string;
  clubBranding?: ClubBrandingInfo;
  onPhotoProcessed?: (asset: ProcessedPhotoAsset) => void;
}

export const WatermarkedPhotoUploader: React.FC<WatermarkedPhotoUploaderProps> = ({
  eventId,
  clubId,
  uploaderId,
  clubBranding,
  onPhotoProcessed,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedAsset, setProcessedAsset] = useState<ProcessedPhotoAsset | null>(null);
  const [opacity, setOpacity] = useState<number>(0.3);

  const branding = clubBranding || photoWatermarkingPipelineService.getClubBranding(clubId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setProcessedAsset(null);
    }
  };

  const handleProcessAndUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const config: Partial<WatermarkConfig> = {
        opacity,
        position: "BOTTOM_RIGHT",
        year: 2026,
      };

      const result = await photoWatermarkingPipelineService.processAndWatermarkPhoto({
        imageBuffer: buffer,
        mimeType: selectedFile.type,
        fileName: selectedFile.name,
        eventId,
        clubId,
        uploaderId,
        customWatermarkConfig: config,
      });

      setProcessedAsset(result.assetRecord);
      onPhotoProcessed?.(result.assetRecord);
    } catch (err) {
      console.error("Failed to process photo watermark:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Automated Copyright Watermarking Pipeline
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Club: <strong className="text-foreground">{branding.clubName}</strong> | Automated
            Watermark:{" "}
            <span className="font-mono text-foreground font-semibold">Logo + © 2026</span> at 30%
            opacity
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          🛡️ Copyright Protection Active
        </span>
      </div>

      {/* Upload Box */}
      <div className="space-y-4">
        <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <div className="text-3xl mb-2">📸</div>
          <span className="text-sm font-semibold text-foreground">
            {selectedFile ? selectedFile.name : "Select event photo to watermark"}
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            Supports high-res JPG, PNG, WEBP (Intercepts post-AI moderation)
          </span>
        </label>
      </div>

      {/* Live Preview Container with 30% Overlay */}
      {previewUrl && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Watermark Live Preview (Bottom-Right Compositing)</span>
            <div className="flex items-center gap-2">
              <span>Opacity:</span>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-24 accent-primary"
              />
              <span className="font-mono font-bold text-foreground">
                {Math.round(opacity * 100)}%
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-border bg-black/5 aspect-video max-h-96 flex items-center justify-center">
            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />

            {/* Simulated Watermark Compositing Overlay in Bottom Right */}
            <div
              className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-black/20 p-2 backdrop-blur-xs pointer-events-none transition-opacity select-none"
              style={{ opacity }}
            >
              <img
                src={branding.logoUrl}
                alt={branding.clubName}
                className="h-8 w-auto object-contain brightness-0 invert drop-shadow"
              />
              <span className="text-xs font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-sans">
                © 2026 {branding.clubName}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleProcessAndUpload}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {isProcessing
                ? "Burning Watermark & Dispatching to S3..."
                : "⚡ Burn Watermark & Save Dual Assets"}
            </button>
          </div>
        </div>
      )}

      {/* Dual Bucket Success Result */}
      {processedAsset && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ✓ Dual-Bucket Pipeline Execution Complete
            </span>
            <span className="text-xs font-mono text-muted-foreground">{processedAsset.id}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg border border-border bg-card p-3 space-y-1">
              <span className="font-bold text-foreground block">
                🌐 Public Watermarked Asset (S3):
              </span>
              <p className="text-muted-foreground font-mono truncate">
                {processedAsset.publicWatermarkedUrl}
              </p>
              <span className="text-[10px] text-emerald-600 font-medium">
                Applied Logo + © 2026 ({Math.round(processedAsset.watermarkMetadata.opacity * 100)}%
                Opacity)
              </span>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-1">
              <span className="font-bold text-foreground block">
                🔒 Private Archival Original (S3 Vault):
              </span>
              <p className="text-muted-foreground font-mono truncate">
                {processedAsset.privateArchiveUrl}
              </p>
              <span className="text-[10px] text-amber-600 font-medium">
                Pristine Unwatermarked Master (Club Officers Only)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
