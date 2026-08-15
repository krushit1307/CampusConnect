import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import X from "lucide-react/dist/esm/icons/x";
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
  const scrollRef = React.useRef<HTMLDivElement>(null);
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
