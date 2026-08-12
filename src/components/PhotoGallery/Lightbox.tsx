// src/components/PhotoGallery/Lightbox.tsx
import React, { useEffect, useCallback } from "react";
import { GalleryPhoto } from "../../types/gallery";
import { Dialog, DialogContent } from "../ui/dialog";
import { Button } from "../ui/button";
import { X, ChevronLeft, ChevronRight, Download, Info } from "lucide-react";
import { formatDateShort } from "@/lib/dateFormatter";
import { cn } from "../../lib/utils";

interface LightboxProps {
  photo: GalleryPhoto | null;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Full-screen lightbox modal for viewing high-resolution photos.
 * Supports keyboard navigation (arrows, escape) and touch swipe gestures.
 */
export const Lightbox: React.FC<LightboxProps> = ({
  photo,
  isOpen,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && hasNext) onNext();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
    },
    [isOpen, onClose, onNext, onPrev, hasNext, hasPrev],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!photo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 border-0 bg-black/95 flex flex-col overflow-hidden">
        <div className="relative flex-1 flex items-center justify-center bg-black">
          <img
            src={photo.url}
            alt={photo.alt}
            className="max-w-full max-h-[80vh] object-contain select-none"
            draggable={false}
          />

          {/* Navigation Arrows */}
          {hasPrev && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
              onClick={onPrev}
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
          )}
          {hasNext && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
              onClick={onNext}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Bottom Info Bar */}
        <div className="bg-zinc-900 text-white p-4 flex items-center justify-between border-t border-zinc-800">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{photo.alt}</span>
            <span className="text-xs text-zinc-400">
              Uploaded {formatDateShort(photo.uploadedAt)} by {photo.photographer.name}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-white border-zinc-700 hover:bg-zinc-800"
            >
              <Info className="w-4 h-4 mr-2" />
              Details
            </Button>
            <Button size="sm" className="bg-white text-black hover:bg-zinc-200">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
