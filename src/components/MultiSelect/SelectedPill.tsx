import React from "react";
import { X } from "lucide-react";
import { Tag } from "./types";
import { cn } from "../../lib/utils";

interface SelectedPillProps {
  tag: Tag;
  onRemove: (tag: Tag) => void;
  disabled?: boolean;
}

export function SelectedPill({ tag, onRemove, disabled }: SelectedPillProps) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 px-2 py-1 text-sm rounded-md bg-secondary text-secondary-foreground",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className="truncate max-w-[200px]">{tag.label}</span>
      <button
        type="button"
        disabled={disabled}
        className="rounded-full outline-none hover:bg-muted p-0.5"
        aria-label={`Remove tag ${tag.label}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(tag);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onRemove(tag);
          }
        }}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
