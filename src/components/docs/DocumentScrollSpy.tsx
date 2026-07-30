import React, { useEffect, useState, useRef, useCallback } from "react";
import { List, ChevronDown, AlignLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HeadingItem {
  id: string;
  text: string;
  level: number; // 2 for h2, 3 for h3
}

export interface DocumentScrollSpyProps {
  /** Array of headings or container selector to observe */
  headings?: HeadingItem[];
  /** Container ref/selector where the markdown content resides */
  contentContainerRef?: React.RefObject<HTMLElement | null>;
  /** Optional title for the Table of Contents card */
  title?: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Extracts <h2> and <h3> heading elements from a DOM element container.
 */
export function extractHeadingsFromDOM(container: HTMLElement): HeadingItem[] {
  const elements = Array.from(container.querySelectorAll("h2, h3"));
  return elements.map((el, index) => {
    if (!el.id) {
      el.id = `heading-section-${index}-${el.textContent?.toLowerCase().replace(/\W+/g, "-") || "sec"}`;
    }
    return {
      id: el.id,
      text: el.textContent || `Section ${index + 1}`,
      level: el.tagName.toLowerCase() === "h2" ? 2 : 3,
    };
  });
}

/**
 * Dynamic Table of Contents (Scroll Spy) component (#1969).
 * Observes document headings using IntersectionObserver and mathematically determines
 * the heading closest to the top of the viewport to set active reading state.
 */
export const DocumentScrollSpy: React.FC<DocumentScrollSpyProps> = ({
  headings: initialHeadings,
  contentContainerRef,
  title = "Table of Contents",
  className = "",
}) => {
  const [headings, setHeadings] = useState<HeadingItem[]>(initialHeadings || []);
  const [activeId, setActiveId] = useState<string>("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Parse headings from DOM if contentContainerRef is passed
  useEffect(() => {
    if (contentContainerRef?.current) {
      const extracted = extractHeadingsFromDOM(contentContainerRef.current);
      setHeadings(extracted);
      if (extracted.length > 0) setActiveId(extracted[0].id);
    } else if (initialHeadings && initialHeadings.length > 0) {
      setHeadings(initialHeadings);
      setActiveId(initialHeadings[0].id);
    }
  }, [contentContainerRef, initialHeadings]);

  // Set up IntersectionObserver with scroll proximity math for short sections
  useEffect(() => {
    if (headings.length === 0) return;

    const visibleElements = new Map<string, number>();

    const handleIntersect: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleElements.set(entry.target.id, entry.boundingClientRect.top);
        } else {
          visibleElements.delete(entry.target.id);
        }
      });

      if (visibleElements.size > 0) {
        // Find section closest to top 20% of screen
        let closestId = "";
        let minDistance = Infinity;

        visibleElements.forEach((top, id) => {
          const distance = Math.abs(top - window.innerHeight * 0.15);
          if (distance < minDistance) {
            minDistance = distance;
            closestId = id;
          }
        });

        if (closestId) setActiveId(closestId);
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: "-10% 0px -70% 0px",
      threshold: [0, 0.25, 0.5, 1.0],
    });

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [headings]);

  const scrollToHeading = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
      setIsMobileOpen(false);
    }
  }, []);

  if (headings.length === 0) return null;

  return (
    <div className={cn("w-full lg:w-64 shrink-0", className)}>
      {/* Mobile Collapsible Dropdown */}
      <div className="block lg:hidden mb-4 border-2 border-black bg-cream dark:border-cream dark:bg-black rounded-lg p-3">
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="flex w-full items-center justify-between font-mono text-xs font-bold uppercase text-black dark:text-cream"
        >
          <span className="flex items-center gap-2">
            <AlignLeft className="h-4 w-4 text-blue-600" /> {title}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", isMobileOpen && "rotate-180")}
          />
        </button>

        {isMobileOpen && (
          <div className="mt-3 space-y-1.5 border-t border-black/20 pt-2.5 dark:border-white/20 font-mono text-xs">
            {headings.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => scrollToHeading(h.id)}
                className={cn(
                  "block w-full text-left py-1 px-2 rounded transition-colors truncate",
                  h.level === 3 ? "pl-5 text-[11px]" : "font-semibold",
                  activeId === h.id
                    ? "bg-lime text-black font-bold"
                    : "hover:bg-black/10 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300",
                )}
              >
                {h.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Sticky Sidebar */}
      <nav
        aria-label="Table of Contents"
        className="hidden lg:block sticky top-24 rounded-xl border-2 border-black bg-cream p-4 dark:border-cream dark:bg-black shadow-md"
      >
        <div className="flex items-center gap-2 border-b-2 border-black pb-2.5 mb-3 dark:border-cream">
          <List className="h-4 w-4 text-blue-600" />
          <h4 className="font-display text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
            {title}
          </h4>
        </div>

        <div className="space-y-1 font-mono text-xs max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
          {headings.map((h) => {
            const isActive = activeId === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => scrollToHeading(h.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left transition-all duration-200",
                  h.level === 3 ? "pl-6 text-[11px]" : "font-semibold",
                  isActive
                    ? "bg-lime text-black font-bold border-l-4 border-black dark:border-white translate-x-1"
                    : "text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5",
                )}
              >
                <span className="truncate">{h.text}</span>
                {isActive && <ArrowUpRight className="h-3 w-3 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
