import React from "react";
import { cn } from "@/lib/utils";

export interface SnapNavigationDotsProps {
  totalSections: number;
  activeIndex: number;
  onSelectSection: (index: number) => void;
  sectionLabels?: string[];
  className?: string;
}

/**
 * Vertical Dot Navigation Indicator for Snap Scroll pages (#1741).
 * Displays clickable dot indicators on the right edge of the screen,
 * highlighting the active snap section and smoothly scrolling on click.
 */
export const SnapNavigationDots: React.FC<SnapNavigationDotsProps> = ({
  totalSections,
  activeIndex,
  onSelectSection,
  sectionLabels = [],
  className,
}) => {
  if (totalSections <= 1) return null;

  return (
    <nav
      aria-label="Snap scroll sections"
      className={cn(
        "fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3.5 p-2 bg-black/40 backdrop-blur-md neu-border border-white/20 rounded-full shadow-2xl transition-all font-mono",
        className,
      )}
    >
      {Array.from({ length: totalSections }).map((_, index) => {
        const isActive = index === activeIndex;
        const label = sectionLabels[index] || `Section ${index + 1}`;

        return (
          <button
            key={`snap-dot-${index}`}
            type="button"
            onClick={() => onSelectSection(index)}
            aria-label={`Scroll to ${label}`}
            aria-current={isActive ? "step" : undefined}
            title={label}
            className={cn(
              "group relative w-3 h-3 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-lime",
              isActive
                ? "bg-lime scale-125 ring-2 ring-lime/50 shadow-[0_0_12px_#a3e635]"
                : "bg-white/40 hover:bg-white hover:scale-110",
            )}
          >
            {/* Tooltip on hover */}
            <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded neu-border whitespace-nowrap shadow-md">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
