import { type ReactNode } from "react";
import { useInView, type UseInViewOptions } from "@/hooks/useInView";

export interface LazyComponentProps extends UseInViewOptions {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  as?: "div" | "span";
}

/**
 * Renders its children only when the wrapper is within the shared 200px
 * preloading window.
 */
export function LazyComponent({
  children,
  fallback = null,
  className,
  as = "div",
  ...options
}: LazyComponentProps) {
  const { ref, hasIntersected } = useInView<HTMLDivElement>(options);

  const content = hasIntersected ? children : fallback;

  if (as === "span") {
    return (
      <span ref={ref as unknown as React.RefCallback<HTMLSpanElement>} className={className}>
        {content}
      </span>
    );
  }

  return (
    <div ref={ref} className={className}>
      {content}
    </div>
  );
}
