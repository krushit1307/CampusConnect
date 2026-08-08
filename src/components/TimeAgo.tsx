import React, { useEffect, useRef, memo } from "react";
import { formatTimeAgo, formatStaticDate } from "@/lib/formatTimeAgo";
import { registerTimeAgo } from "@/lib/timeAgoRegistry";

export interface TimeAgoProps extends React.HTMLAttributes<HTMLSpanElement> {
  date: string | Date | number;
  /**
   * If true, suppresses initial dynamic hydration format until mount completes
   */
  fallbackStatic?: boolean;
}

export const TimeAgo = memo(function TimeAgo({
  date,
  fallbackStatic = false,
  className = "",
  children,
  ...props
}: TimeAgoProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el || !date) return;

    // Directly set current time-ago text to avoid hydration mismatch while updating instantly
    const initialText = formatTimeAgo(date);
    if (el.textContent !== initialText) {
      el.textContent = initialText;
    }

    // Register DOM element with global zero-rerender timer registry
    const unregister = registerTimeAgo(el, date);

    return () => {
      unregister();
    };
  }, [date]);

  return (
    <span ref={spanRef} className={className} {...props}>
      {children || formatStaticDate(date)}
    </span>
  );
});
