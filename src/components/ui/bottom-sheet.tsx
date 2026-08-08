import React, { useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Math to determine if user swiped down fast enough or far enough
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Intercept drag events when scrolling down internal content
    if (scrollRef.current && scrollRef.current.scrollTop > 0) {
      e.stopPropagation();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Bottom Sheet Drawer */}
          <motion.div
            role="dialog"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className={cn(
              "relative w-full bg-background rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden",
              className,
            )}
            style={{ width: "100vw", bottom: 0 }}
          >
            {/* Drag Handle Indicator */}
            <div className="w-full flex justify-center py-3 shrink-0">
              <div className="w-12 h-1.5 bg-muted rounded-full" />
            </div>

            {/* Header (optional) */}
            {(title || description) && (
              <div className="px-6 pb-4 border-b shrink-0 flex justify-between items-start">
                <div>
                  {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
                  {description && (
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            )}

            {/* Scrollable Content Area */}
            <div
              ref={scrollRef}
              onPointerDown={handlePointerDown}
              className="flex-1 overflow-y-auto p-6"
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
