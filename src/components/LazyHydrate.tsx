import React, { useState, useEffect, useRef } from "react";

interface LazyHydrateProps {
  children: React.ReactNode;
  height?: number | string;
  placeholder?: React.ReactNode;
  rootMargin?: string;
  threshold?: number | number[];
}

export default function LazyHydrate({
  children,
  height = "300px",
  placeholder,
  rootMargin = "200px", // Load slightly before entering viewport for smooth experience
  threshold = 0.01,
}: LazyHydrateProps) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If IntersectionObserver is not supported, render immediately
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  if (isIntersecting) {
    return <>{children}</>;
  }

  const defaultPlaceholder = (
    <div
      style={{ height }}
      className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/50 flex items-center justify-center font-mono text-xs text-gray-400"
    >
      Loading interactive widget...
    </div>
  );

  return (
    <div ref={containerRef} style={{ minHeight: height }} className="w-full">
      {placeholder ?? defaultPlaceholder}
    </div>
  );
}
