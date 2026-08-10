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
import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomSheetProps {
  isOpen?: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  snapPoints?: (number | string)[];
  activeSnapPoint?: number | string | null;
  setActiveSnapPoint?: (snapPoint: number | string | null) => void;
  showHandle?: boolean;
  showCloseButton?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  shouldScaleBackground?: boolean;
  fadeFromIndex?: number;
}

/**
 * Responsive BottomSheet drawer component built on `vaul` with natural swipe physics.
 * Supports snap points (e.g. [0.5, 1] or ["50%", "100%"]), scroll arbitration,
 * keyboard avoidance, and mobile-optimized drag-to-dismiss interactions.
 */
export function BottomSheet({
  isOpen = true,
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
  snapPoints = [0.5, 1],
  activeSnapPoint,
  setActiveSnapPoint,
  showHandle = true,
  showCloseButton = true,
  className,
  headerClassName,
  contentClassName,
  shouldScaleBackground = false,
  fadeFromIndex = 0,
}: BottomSheetProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open && onClose) {
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
  return (
    <DrawerPrimitive.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      snapPoints={snapPoints}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
      fadeFromIndex={fadeFromIndex}
      shouldScaleBackground={shouldScaleBackground}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          onClick={onClose}
        />
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex h-full max-h-[96vh] flex-col rounded-t-[24px] bg-background border-t-4 border-black shadow-2xl transition-transform duration-300 focus:outline-none",
            className,
          )}
        >
          {showHandle && (
            <div
              className="flex w-full items-center justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
              aria-label="Drag handle"
            >
              <div className="h-1.5 w-14 rounded-full bg-muted-foreground/30 border border-black/20" />
            </div>
          )}

          {(title || description || showCloseButton) && (
            <div
              className={cn(
                "flex items-start justify-between px-6 pt-3 pb-3 border-b-2 border-black shrink-0",
                headerClassName,
              )}
            >
              <div className="space-y-1 pr-4">
                {title && (
                  <DrawerPrimitive.Title className="text-lg font-bold font-display tracking-tight text-foreground">
                    {title}
                  </DrawerPrimitive.Title>
                )}
                {description && (
                  <DrawerPrimitive.Description className="text-sm font-mono text-muted-foreground">
                    {description}
                  </DrawerPrimitive.Description>
                )}
              </div>
              {showCloseButton && onClose && (
                <DrawerPrimitive.Close
                  className="rounded-full neu-border p-1.5 bg-white text-black hover:bg-cream transition-colors cursor-pointer shrink-0"
                  aria-label="Close drawer"
                >
                  <X className="h-4 w-4" />
                </DrawerPrimitive.Close>
              )}
            </div>
          )}

          <div
            className={cn(
              "flex-1 overflow-y-auto p-6 overscroll-contain focus:outline-none font-mono",
              contentClassName,
            )}
          >
            {children}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
