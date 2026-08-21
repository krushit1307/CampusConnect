import React from "react";
import { cn } from "@/lib/utils";

/**
 * StickyActionBar
 *
 * Pins its children (typically "Save"/"Cancel"/"Next" style buttons) to the
 * bottom of the viewport on small screens so they stay reachable while the
 * user scrolls through a long form. On larger screens it falls back to a
 * normal, in-flow toolbar since desktop forms don't suffer from the same
 * "buried submit button" problem.
 *
 * Usage:
 *   <form>
 *     ...lots of fields...
 *     <StickyActionBar>
 *       <button onClick={onCancel}>Cancel</button>
 *       <button onClick={onSave}>Save</button>
 *     </StickyActionBar>
 *   </form>
 *
 * Notes:
 * - Uses `fixed` positioning (rather than `sticky`) so it reliably pins to
 *   the viewport even when an ancestor has `overflow` set or lacks a
 *   well-defined scroll height, which is common with nested layouts.
 * - Accounts for the iOS "home indicator" via `env(safe-area-inset-bottom)`
 *   so the bar (and its buttons) never sit underneath it.
 * - Renders an invisible spacer of the same height so page/form content
 *   doesn't end up hidden behind the fixed bar. Pair with `barRef` if you
 *   need the exact measured height elsewhere.
 */
export function StickyActionBar({
  children,
  className,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = React.useState(0);

  React.useLayoutEffect(() => {
    const node = barRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setBarHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Spacer: reserves space so the last form fields aren't hidden
          underneath the fixed bar. Only needed on mobile (where the bar is
          fixed); collapses to 0 on sm+ where the bar is back in normal flow. */}
      <div className="sm:hidden" style={{ height: barHeight }} aria-hidden="true" />

      <div
        ref={barRef}
        className={cn(
          // Mobile: pinned to the bottom of the viewport, above everything else.
          "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background shadow-[0_-4px_12px_rgba(0,0,0,0.08)]",
          // Respect the iOS home-indicator safe area so buttons aren't covered.
          "pb-[env(safe-area-inset-bottom)]",
          // Desktop/tablet: back in normal document flow, no floating chrome.
          "sm:static sm:inset-auto sm:z-auto sm:border-t sm:shadow-none sm:bg-transparent sm:pb-0",
          className,
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-0 sm:py-0",
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
