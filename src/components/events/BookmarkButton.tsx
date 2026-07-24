import { Bookmark } from "lucide-react";

interface BookmarkButtonProps {
  isSaved: boolean;
  isPending: boolean;
  onClick: () => void;
}

export function BookmarkButton({ isSaved, isPending, onClick }: BookmarkButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={isSaved ? "Unsave event" : "Save event"}
    >
      <Bookmark className="h-4 w-4" fill={isSaved ? "black" : "none"} />
    </button>
  );
}
