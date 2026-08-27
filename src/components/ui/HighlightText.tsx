import React from "react";
import { cn } from "@/lib/utils";

export interface HighlightTextProps {
  text: string;
  highlight: string;
  className?: string;
  highlightClassName?: string;
}

/**
 * Utility helper that safely escapes special regex characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * HighlightText component.
 * Case-insensitively splits text by search query and wraps matching substrings in a bold/highlighted tag.
 */
export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  highlight,
  className,
  highlightClassName = "bg-lime/40 text-black font-extrabold px-0.5 rounded",
}) => {
  if (!text) return null;
  const trimmedHighlight = highlight.trim();
  if (!trimmedHighlight) {
    return <span className={className}>{text}</span>;
  }

  const escaped = escapeRegex(trimmedHighlight);
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === trimmedHighlight.toLowerCase();
        if (isMatch) {
          return (
            <mark key={index} className={cn(highlightClassName)}>
              {part}
            </mark>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
};
