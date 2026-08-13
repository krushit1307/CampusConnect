import React, { useState } from "react";
import { LazyMotion, m, PanInfo, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { loadDomMax } from "@/lib/motionFeatures";
import { cn } from "@/lib/utils";

export interface DragToDismissLightboxProps {
  src: string | null;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const DISMISS_OFFSET_THRESHOLD = 100;
export const DISMISS_VELOCITY_THRESHOLD = 500;

/**
 * Image Lightbox with Complex Drag-to-Dismiss Gesture (#1751).
 * Allows swiping/flicking image downwards to close the modal.
 * Disables drag-to-dismiss when image is zoomed in (scale > 1) to allow panning.
 */
export const DragToDismissLightbox: React.FC<DragToDismissLightboxProps> = ({
  src,
  alt = "Full screen photo",
  isOpen,
  onClose,
  className,
}) => {
  const [scale, setScale] = useState(1);
  const [dragY, setDragY] = useState(0);

  if (!isOpen || !src) return null;

  const handleDrag = (_: unknown, info: PanInfo) => {
    // Track vertical drag displacement for background opacity adjustment
    if (scale === 1) {
      setDragY(info.offset.y);
    }
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // Conflict check: if zoomed in (scale > 1), ignore drag-to-dismiss (#1751)
    if (scale > 1) return;

    const { offset, velocity } = info;
    const isDismissable =
      offset.y > DISMISS_OFFSET_THRESHOLD || velocity.y > DISMISS_VELOCITY_THRESHOLD;

    if (isDismissable) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  const toggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => (prev === 1 ? 2.5 : 1));
  };

  // Calculate dynamic background opacity based on drag distance
  const backdropOpacity = Math.max(0.2, 0.95 - Math.abs(dragY) / 400);

  return (
    <LazyMotion features={loadDomMax}>
      <AnimatePresence>
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label="Image Lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center select-none font-mono"
        >
          {/* Backdrop with dynamic opacity fade during drag */}
          <div
            data-testid="lightbox-backdrop"
            onClick={onClose}
            className="absolute inset-0 bg-black transition-opacity duration-150"
            style={{ opacity: backdropOpacity }}
          />

          {/* Close & Zoom Controls */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleZoom}
              aria-label={scale > 1 ? "Zoom out" : "Zoom in"}
              className="p-2.5 neu-border bg-white text-black hover:bg-cream rounded-full transition-transform hover:scale-110 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {scale > 1 ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close lightbox"
              className="p-2.5 neu-border bg-white text-black hover:bg-cream rounded-full transition-transform hover:scale-110 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drag-to-Dismiss Image Container (#1751) */}
          <m.div
            data-testid="drag-lightbox-container"
            drag={scale > 1 ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.7}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            animate={{ scale, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={cn("relative z-10 max-w-[92vw] max-h-[88vh] cursor-grab active:cursor-grabbing", className)}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              onClick={toggleZoom}
              className="max-w-full max-h-[85vh] object-contain neu-border border-2 border-black rounded-xl shadow-2xl transition-transform duration-200"
            />
          </m.div>

          {/* Drag hint notice */}
          {scale === 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[11px] font-bold uppercase tracking-wider text-white/70 bg-black/60 px-3 py-1.5 rounded-full border border-white/20 pointer-events-none">
              Swipe down to dismiss
            </div>
          )}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
};
