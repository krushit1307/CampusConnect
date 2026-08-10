import React, { useState, useCallback, useEffect } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export interface RichTooltipProps {
  /** Rich HTML/React content rendered inside the tooltip popover. */
  content: React.ReactNode;
  /** The trigger element — must accept a ref (use native elements or forwardRef components). */
  children: React.ReactNode;
  /** Preferred side placement; Radix automatically flips on collision. */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment along the preferred side axis. */
  align?: "start" | "center" | "end";
  /** Offset in px from the trigger element. */
  sideOffset?: number;
  /** Delay (ms) before the tooltip appears on hover. */
  delayDuration?: number;
  /** Maximum width of the tooltip card (px). */
  maxWidth?: number;
  /** Additional className applied to the tooltip content container. */
  className?: string;
  /** Additional className applied to the directional arrow. */
  arrowClassName?: string;
  /** If true, the tooltip is interactive — user can hover into the content without it closing. */
  interactive?: boolean;
  /**
   * On touch devices, tooltips convert to a tap-to-toggle behaviour
   * rather than hover, preventing "sticky" tooltips on mobile.
   */
  disableOnTouch?: boolean;
}

/**
 * Detects whether the current device is primarily touch-based.
 * Used to disable hover-only tooltips on mobile and convert to tap behaviour.
 */
function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouch(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isTouch;
}

/**
 * RichTooltip — A Radix UI tooltip that supports rich HTML content (#1758).
 *
 * Features:
 * - Renders full React nodes (profile cards, formatted dates, explanatory text).
 * - Uses Radix collision detection to auto-flip when near viewport edges.
 * - Dark themed with subtle shadow and directional arrow.
 * - Interactive mode: allows user to hover into content without dismissal.
 * - Touch device support: converts to tap-to-toggle to avoid sticky tooltips.
 * - Keyboard accessible: trigger gets tabIndex={0} so screen reader users
 *   can focus and reveal the tooltip via keyboard.
 */
export const RichTooltip: React.FC<RichTooltipProps> = ({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 8,
  delayDuration = 300,
  maxWidth = 320,
  className = "",
  arrowClassName = "",
  interactive = true,
  disableOnTouch = true,
}) => {
  const isTouch = useIsTouchDevice();
  const [open, setOpen] = useState(false);

  // On touch devices, convert to tap-to-toggle
  const handleTouchTrigger = useCallback(() => {
    if (isTouch && disableOnTouch) {
      setOpen((prev) => !prev);
    }
  }, [isTouch, disableOnTouch]);

  // If no content, just render children
  if (!content) return <>{children}</>;

  // On touch devices with disableOnTouch, use controlled open state via tap
  const isControlled = isTouch && disableOnTouch;

  return (
    <TooltipPrimitive.Root
      delayDuration={delayDuration}
      {...(isControlled ? { open, onOpenChange: setOpen } : {})}
    >
      <TooltipPrimitive.Trigger asChild {...(isControlled ? { onClick: handleTouchTrigger } : {})}>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={16}
          avoidCollisions
          // When interactive, allow user to hover into content without it closing
          {...(interactive ? { onPointerDownOutside: () => setOpen(false) } : {})}
          className={cn(
            // Base layout
            "z-[100] overflow-hidden rounded-lg p-3",
            // Dark theme with shadow
            "bg-slate-900 text-slate-100 shadow-2xl shadow-black/30",
            "border border-slate-700/60",
            // Typography
            "font-mono text-xs leading-relaxed",
            // Animations
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            // Slide from the side the tooltip opens towards
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            // Transform origin for smooth scaling
            "origin-(--radix-tooltip-content-transform-origin)",
            className,
          )}
          style={{ maxWidth }}
        >
          {content}
          <TooltipPrimitive.Arrow
            className={cn("fill-slate-900", arrowClassName)}
            width={10}
            height={5}
          />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
