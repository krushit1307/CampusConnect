import { Bookmark } from "lucide-react";
import type { BookmarkType } from "@/lib/bookmarks";

interface BookmarkButtonProps {
  type: BookmarkType;
  targetId: string;
  isBookmarked: boolean;
  isPending: boolean;
  onClick: () => void;
  className?: string;
}

export function BookmarkButton({
  isBookmarked,
  isPending,
  onClick,
  className = "",
}: BookmarkButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={`neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      <Bookmark className="h-4 w-4" fill={isBookmarked ? "black" : "none"} />
    </button>
  );
}
