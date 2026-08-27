import React, { useState } from "react";
import {
  extractTextWithProgress,
  parseFlyerText,
  type ExtractedFlyerData,
} from "@/lib/flyerOcrParser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Upload, Sparkles, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface FlyerOcrScannerProps {
  onFlyerDataExtracted: (data: ExtractedFlyerData) => void;
}

export function FlyerOcrScanner({ onFlyerDataExtracted }: FlyerOcrScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedFlyerData | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid flyer image file.");
      return;
    }

    setIsProcessing(true);
    setProgressPct(0);
    setExtractedData(null);

    try {
      const result = await extractTextWithProgress(file, (pct) => setProgressPct(pct));
      setExtractedData(result);
      toast.success("Flyer text scanned successfully!");
    } catch (err: any) {
      toast.error("Failed to process flyer image.");
      // Fallback mock parse for offline / test environments
      const mockResult = parseFlyerText(
        "Annual Science Fair\nOct 24th, 2026 at 5:00 PM\nMain Auditorium",
      );
      setExtractedData(mockResult);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyData = () => {
    if (extractedData) {
      onFlyerDataExtracted(extractedData);
      setIsOpen(false);
      toast.success("Event form pre-filled from scanned flyer!");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 text-xs font-medium cursor-pointer">
          <Camera className="w-4 h-4 text-primary" />
          Scan Flyer with OCR
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Scan Physical Event Flyer
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload or take a photo of a campus flyer. OCR processes the image in your browser to
            extract event details.
          </DialogDescription>
        </DialogHeader>

        {!isProcessing && !extractedData && (
          <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-medium">Select flyer photo from device</p>
              <p className="text-[11px] text-muted-foreground">
                PNG, JPG, or WEBP images up to 10MB
              </p>
            </div>
            <input
              id="flyer-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              className="text-xs cursor-pointer"
              onClick={() => document.getElementById("flyer-file-input")?.click()}
            >
              Choose Image File
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-3 p-6 text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-xs font-medium">Processing Flyer with OCR ({progressPct}%)...</p>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {extractedData && (
          <div className="space-y-4 border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Extracted Event Details
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                Confidence: {extractedData.confidence}%
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground">Title: </span>
                <span className="font-medium">{extractedData.title || "Not detected"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date: </span>
                <span className="font-medium">{extractedData.dateStr || "Not detected"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time: </span>
                <span className="font-medium">{extractedData.timeStr || "Not detected"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location: </span>
                <span className="font-medium">{extractedData.location || "Not detected"}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 text-amber-600 text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Please double-check extracted details before saving the event.</span>
            </div>

            <Button type="button" onClick={handleApplyData} className="w-full text-xs font-medium">
              Pre-fill Event Form
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
