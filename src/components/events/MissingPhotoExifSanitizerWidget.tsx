import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  FileImage,
  MapPin,
  Camera,
  CheckCircle2,
  RefreshCw,
  Zap,
  Lock,
  Trash2,
  Sparkles,
  UploadCloud,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExifStrippingResult,
  ExifTagMetadata,
  MissingPhotoUploadInspection,
} from "@/types/missingPhotoExifStripping";
import { missingPhotoExifStrippingService } from "@/services/missingPhotoExifStrippingService";

interface MissingPhotoExifSanitizerWidgetProps {
  photoTaskId?: string;
  eventId?: string;
  eventTitle?: string;
  onPhotoSanitized?: (result: ExifStrippingResult) => void;
}

export function MissingPhotoExifSanitizerWidget({
  photoTaskId = "task-photo-101",
  eventId = "evt-robotics-showcase",
  eventTitle = "Annual Robotics Showcase",
  onPhotoSanitized,
}: MissingPhotoExifSanitizerWidgetProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedExif, setDetectedExif] = useState<ExifTagMetadata | null>(null);
  const [strippingResult, setStrippingResult] = useState<ExifStrippingResult | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setStrippingResult(null);
    setNoticeMessage(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const exif = await missingPhotoExifStrippingService.inspectExifMetadata(file);
    setDetectedExif(exif);
  };

  const handleExecuteStripping = async () => {
    if (!selectedFile) return;

    setProcessing(true);
    try {
      const { strippingResult: result } =
        await missingPhotoExifStrippingService.processMissingPhotoUpload(
          selectedFile,
          photoTaskId,
          eventId,
          eventTitle,
        );

      setStrippingResult(result);
      setNoticeMessage(
        `EXIF Metadata Stripped: Purged ${result.tagsRemovedCount} sensitive tags (GPS geolocation, hardware info). Image privacy protected!`,
      );

      if (onPhotoSanitized) onPhotoSanitized(result);
    } catch (err: any) {
      setNoticeMessage(`Error: ${err.message || "Failed to sanitize image metadata"}`);
    } finally {
      setProcessing(false);
    }
  };

  const getPrivacyBadge = () => {
    if (strippingResult?.isPrivacyProtected) {
      return (
        <Badge className="bg-emerald-600 text-white font-mono uppercase flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Privacy Protected (Clean)
        </Badge>
      );
    }
    if (detectedExif?.gpsLatitude) {
      return (
        <Badge className="bg-red-600 text-white font-mono uppercase flex items-center gap-1 animate-pulse">
          <ShieldAlert className="w-3 h-3" /> Sensitive GPS Geolocation Exposed
        </Badge>
      );
    }
    if (detectedExif?.cameraModel) {
      return (
        <Badge className="bg-amber-600 text-white font-mono uppercase flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" /> Moderate Metadata (Device/Time)
        </Badge>
      );
    }
    return <Badge className="bg-slate-700 text-slate-300 font-mono uppercase">Ready for Inspection</Badge>;
  };

  return (
    <div
      data-testid="missing-photo-exif-sanitizer"
      className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-indigo-900/40 text-slate-100 shadow-2xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-950/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            <h3 className="text-xl md:text-2xl font-bold font-display tracking-tight text-white">
              Automated Missing Photo EXIF Stripper
            </h3>
            {getPrivacyBadge()}
          </div>
          <p className="text-xs md:text-sm text-slate-400 font-mono mt-1">
            Privacy sanitization pipeline removing GPS & PII metadata before gallery publication for:{" "}
            <span className="text-indigo-300 font-semibold">{eventTitle}</span>
          </p>
        </div>
      </div>

      {/* Notice Bar */}
      {noticeMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-between text-xs font-mono text-emerald-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{noticeMessage}</span>
          </div>
          <button onClick={() => setNoticeMessage(null)} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* Upload Dropzone & Image Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Box */}
        <div className="p-6 rounded-xl bg-slate-900/80 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 flex flex-col items-center justify-center text-center space-y-3 transition group cursor-pointer relative">
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileSelect}
            className="absolute inset-0 opacity-0 cursor-pointer"
            data-testid="exif-file-input"
          />
          <UploadCloud className="w-10 h-10 text-indigo-400 group-hover:scale-110 transition-transform" />
          <div>
            <span className="font-bold text-sm text-slate-200 block">
              {selectedFile ? selectedFile.name : "Select or Drop Missing Event Photo"}
            </span>
            <span className="text-xs text-slate-400 font-mono block mt-1">
              Supports JPEG / PNG (Metadata will be inspected)
            </span>
          </div>
          {selectedFile && (
            <Badge variant="outline" className="font-mono text-xs border-indigo-700 text-indigo-300">
              Size: {(selectedFile.size / 1024).toFixed(1)} KB
            </Badge>
          )}
        </div>

        {/* Image Preview & Detected Metadata */}
        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <span className="text-xs font-mono uppercase text-slate-400 font-bold block">
              Metadata Inspection Status
            </span>

            {previewUrl ? (
              <div className="flex items-start gap-4">
                <img
                  src={strippingResult?.sanitizedDataUrl || previewUrl}
                  alt="Missing Photo Preview"
                  className="w-24 h-24 object-cover rounded-lg border border-slate-700"
                />
                <div className="space-y-1.5 text-xs font-mono text-slate-300">
                  {detectedExif?.gpsLatitude ? (
                    <div className="flex items-center gap-1.5 text-red-400 font-bold">
                      <MapPin className="w-3.5 h-3.5" /> GPS: {detectedExif.gpsLatitude}° N, {detectedExif.gpsLongitude}° W
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <MapPin className="w-3.5 h-3.5" /> GPS Geolocation: None Detected
                    </div>
                  )}

                  {detectedExif?.cameraModel && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Camera className="w-3.5 h-3.5 text-indigo-400" /> Device: {detectedExif.cameraMake} {detectedExif.cameraModel}
                    </div>
                  )}

                  {detectedExif?.dateTimeOriginal && (
                    <div className="text-[11px] text-slate-400">
                      Captured: {detectedExif.dateTimeOriginal}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-500 italic py-6 text-center">
                No photo selected yet. Upload a photo to run EXIF metadata inspection.
              </div>
            )}
          </div>

          {/* Action Trigger */}
          {selectedFile && !strippingResult && (
            <Button
              onClick={handleExecuteStripping}
              disabled={processing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs uppercase py-2.5 font-bold shadow-lg transition"
              data-testid="strip-exif-btn"
            >
              <Zap className="w-4 h-4 mr-2" />
              {processing ? "Sanitizing Metadata..." : "Strip EXIF Metadata & Protect Privacy"}
            </Button>
          )}
        </div>
      </div>

      {/* Stripping Audit Breakdown */}
      {strippingResult && (
        <div className="p-5 rounded-xl bg-slate-900/90 border border-emerald-900/40 space-y-3" data-testid="stripping-audit-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-300 font-mono font-bold text-xs uppercase">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Sanitization Completed ({strippingResult.tagsRemovedCount} Tags Removed)</span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Sanitized Size: {(strippingResult.sanitizedSizeBytes / 1024).toFixed(1)} KB
            </span>
          </div>

          <div className="space-y-1 text-xs font-mono text-slate-300">
            <span className="text-slate-500 uppercase font-bold text-[10px] block">Purged EXIF Tags:</span>
            <ul className="space-y-1 bg-slate-950 p-3 rounded border border-slate-800">
              {strippingResult.removedTagsSummary.map((tag, idx) => (
                <li key={idx} className="flex items-center gap-2 text-emerald-400">
                  <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>Removed: {tag}</span>
                </li>
              ))}
              {strippingResult.removedTagsSummary.length === 0 && (
                <li className="text-slate-400 italic">No sensitive EXIF tags present. File is clean.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
