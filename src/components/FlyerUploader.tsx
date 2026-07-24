import React from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { useOCR } from "@/hooks/useOCR";
import type { ParsedFlyer } from "@/lib/parser";

interface FlyerUploaderProps {
  onDataExtracted: (data: ParsedFlyer) => void;
}

export function FlyerUploader({ onDataExtracted }: FlyerUploaderProps) {
  const { isProcessing, processFlyer } = useOCR({ onSuccess: onDataExtracted });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFlyer(file);
      // Reset input value to allow uploading the same file again if needed
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1 mb-4">
      <label className="eyebrow font-bold text-sm">Autofill from Flyer</label>
      <div className="relative flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-black/20 bg-cream py-6 hover:bg-black/5 transition-colors">
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        <div className="flex flex-col items-center justify-center text-center">
          {isProcessing ? (
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          ) : (
            <UploadCloud className="h-8 w-8 text-black/60" />
          )}
          <p className="mt-2 text-sm font-bold text-black/80">
            {isProcessing ? "Processing image..." : "Upload Flyer"}
          </p>
          <p className="text-xs text-black/50 px-4">
            {isProcessing
              ? "Extracting details via OCR. This might take a few seconds."
              : "Drag & drop or click to upload a poster/flyer image"}
          </p>
        </div>
      </div>
    </div>
  );
}
