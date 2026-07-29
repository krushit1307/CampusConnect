import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ReadMoreProps {
  text: string;
  className?: string;
}

export function ReadMore({ text, className }: ReadMoreProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    setIsOverflowing(el.scrollHeight > el.clientHeight);
  }, [text]);

  return (
    <div className={className}>
      <p
        ref={textRef}
        className={cn(
          "text-sm leading-6 text-gray-800 transition-all duration-300 ease-in-out",
          !isExpanded && "line-clamp-4",
        )}
      >
        {text}
      </p>

      {isOverflowing && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-1 font-semibold text-violet-700 hover:text-violet-900 transition-colors"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
