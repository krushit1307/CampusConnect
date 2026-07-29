import { LikeIcon } from "./LikeIcon";
import type React from "react";

interface LikeButtonProps {
  liked: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

export function LikeButton({ liked, onClick, className = "" }: LikeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center cursor-pointer focus:outline-none ${className}`}
      aria-label={liked ? "Unlike post" : "Like post"}
      aria-pressed={liked}
    >
      <LikeIcon liked={liked} />
    </button>
  );
}
