import { useEffect, useState } from "react";

/**
 * Custom hook that uses IntersectionObserver to track which heading
 * is currently in the top 20% of the viewport.
 * 
 * @param headingIds - Array of DOM element IDs to observe
 * @returns The ID of the currently active heading
 */
export function useActiveHeading(headingIds: string[]) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headingIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Filter to only entries currently intersecting
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        
        if (visibleEntries.length > 0) {
          // If multiple are visible, pick the one closest to the top of the viewport
          const topMost = visibleEntries.reduce((prev, curr) =>
            Math.abs(prev.boundingClientRect.top) < Math.abs(curr.boundingClientRect.top)
              ? prev
              : curr
          );
          setActiveId(topMost.target.id);
        } else {
          // Edge case: User scrolled past ALL headings
          const lastId = headingIds[headingIds.length - 1];
          const lastElement = document.getElementById(lastId);
          if (lastElement) {
            const rect = lastElement.getBoundingClientRect();
            // If the last heading is above the viewport, it's the active one
            if (rect.bottom < 0) {
              setActiveId(lastId);
            }
          }
        }
      },
      {
        // Observe the top 20% of the viewport
        rootMargin: "-20% 0px -80% 0px",
        threshold: 0,
      }
    );

    headingIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [headingIds]);

  return activeId;
}
