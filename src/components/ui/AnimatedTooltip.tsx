import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export interface AnimatedTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  delayDuration?: number;
  className?: string;
  arrowClassName?: string;
}

/**
 * Animated Radix UI Tooltip Component (#1295).
 * Replaces generic native browser tooltips with fast, animated, accessible tooltips featuring arrow pointers and collision handling.
 */
export const AnimatedTooltip: React.FC<AnimatedTooltipProps> = ({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 6,
  delayDuration = 150,
  className = "",
  arrowClassName = "",
}) => {
  if (!content) return <>{children}</>;

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            className={cn(
              "z-50 overflow-hidden rounded-md bg-slate-900 px-3 py-1.5 font-mono text-xs font-semibold text-slate-100 shadow-xl border border-slate-700/80 transition-all duration-200",
              "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              className,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow
              className={cn("fill-slate-900 stroke-slate-700/80", arrowClassName)}
              width={8}
              height={4}
            />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
};
