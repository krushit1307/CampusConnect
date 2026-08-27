import React, { useRef, useState, useEffect, ReactNode } from "react";
import { SnapNavigationDots } from "./SnapNavigationDots";
import { cn } from "@/lib/utils";

export interface SnapScrollContainerProps {
  children: ReactNode;
  sectionLabels?: string[];
  showDots?: boolean;
  className?: string;
}

export interface SnapSectionProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

/**
 * SnapSection Component (#1741)
 * Individual 100dvh snap target section with `scroll-snap-align: start`.
 */
export const SnapSection: React.FC<SnapSectionProps> = ({ children, id, className }) => {
  return (
    <section
      id={id}
      data-testid="snap-section"
      className={cn(
        "h-[100dvh] min-h-[100dvh] w-full snap-start snap-always relative flex flex-col justify-center overflow-hidden shrink-0",
        className,
      )}
    >
      {children}
    </section>
  );
};

/**
 * SnapScrollContainer Component (#1741)
 * Parent container applying CSS Scroll Snap properties (`scroll-snap-type: y proximity/mandatory`, `100dvh`).
 * Automatically tracks active index via IntersectionObserver and renders SnapNavigationDots.
 */
export const SnapScrollContainer: React.FC<SnapScrollContainerProps> = ({
  children,
  sectionLabels = [],
  showDots = true,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [totalSections, setTotalSections] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-testid='snap-section']"));
    setTotalSections(sections.length);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = sections.indexOf(entry.target as HTMLElement);
            if (index !== -1) {
              setActiveIndex(index);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.5,
      },
    );

    sections.forEach((sec) => observer.observe(sec));

    return () => {
      observer.disconnect();
    };
  }, [children]);

  const handleSelectSection = (index: number) => {
    const container = containerRef.current;
    if (!container) return;

    const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-testid='snap-section']"));
    if (sections[index]) {
      sections[index].scrollIntoView({ behavior: "smooth" });
      setActiveIndex(index);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden font-mono">
      <div
        ref={containerRef}
        data-testid="snap-scroll-container"
        className={cn(
          "h-[100dvh] w-full overflow-y-auto scroll-smooth snap-y snap-proximity md:snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {children}
      </div>

      {showDots && totalSections > 1 && (
        <SnapNavigationDots
          totalSections={totalSections}
          activeIndex={activeIndex}
          onSelectSection={handleSelectSection}
          sectionLabels={sectionLabels}
        />
      )}
    </div>
  );
};
