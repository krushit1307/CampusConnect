import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface ViewportTooltipProps {
  /** Tooltip text or rich node content */
  content: React.ReactNode;
  /** Trigger element */
  children: React.ReactNode;
  /** Preferred placement before collision check */
  preferredPlacement?: TooltipPlacement;
  /** Space in px between trigger and tooltip box */
  offset?: number;
  /** Additional container class */
  className?: string;
  /** Hover delay in ms */
  delay?: number;
}

/**
 * Intelligent viewport-aware Tooltip component (#1962).
 * Dynamically computes bounding client rects and flips placement (top/bottom/left/right)
 * if rendering would breach viewport edges.
 */
export const ViewportTooltip: React.FC<ViewportTooltipProps> = ({
  content,
  children,
  preferredPlacement = "top",
  offset = 8,
  className = "",
  delay = 150,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPlacement, setActualPlacement] = useState<TooltipPlacement>(preferredPlacement);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let placement = preferredPlacement;

    // Viewport collision checks
    if (placement === "top" && triggerRect.top - tooltipRect.height - offset < 0) {
      placement = "bottom";
    } else if (
      placement === "bottom" &&
      triggerRect.bottom + tooltipRect.height + offset > viewportHeight
    ) {
      placement = "top";
    } else if (placement === "left" && triggerRect.left - tooltipRect.width - offset < 0) {
      placement = "right";
    } else if (
      placement === "right" &&
      triggerRect.right + tooltipRect.width + offset > viewportWidth
    ) {
      placement = "left";
    }

    let top = 0;
    let left = 0;

    switch (placement) {
      case "top":
        top = triggerRect.top - tooltipRect.height - offset;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        break;
      case "bottom":
        top = triggerRect.bottom + offset;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        break;
      case "left":
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.left - tooltipRect.width - offset;
        break;
      case "right":
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.right + offset;
        break;
    }

    // Clamp horizontal boundary
    left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));
    // Clamp vertical boundary
    top = Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8));

    setActualPlacement(placement);
    setCoords({ top, left });
  }, [preferredPlacement, offset]);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      let rAfId: number | null = null;
      const scheduledCalculate = () => {
        if (rAfId !== null) cancelAnimationFrame(rAfId);
        rAfId = window.requestAnimationFrame(calculatePosition);
      };

      scheduledCalculate();
      window.addEventListener("scroll", scheduledCalculate, { passive: true });
      window.addEventListener("resize", scheduledCalculate, { passive: true });
      return () => {
        if (rAfId !== null) cancelAnimationFrame(rAfId);
        window.removeEventListener("scroll", scheduledCalculate);
        window.removeEventListener("resize", scheduledCalculate);
      };
    }
  }, [isVisible, calculatePosition]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      className="inline-block"
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          className={cn(
            "fixed z-[80] rounded-md border-2 border-black bg-black px-3 py-1.5 font-mono text-xs text-cream shadow-md dark:border-cream dark:bg-cream dark:text-black animate-in fade-in-0 zoom-in-95 pointer-events-none",
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};
