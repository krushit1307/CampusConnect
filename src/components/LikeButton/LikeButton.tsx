import { LikeIcon } from "./LikeIcon";
import type React from "react";
import { AudioEngine } from "@/lib/audio/audioEngine";

interface LikeButtonProps {
  liked: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

export function LikeButton({ liked, onClick, className = "" }: LikeButtonProps) {
  const handleClick = (event: React.MouseEvent) => {
    if (liked) {
      AudioEngine.playToggle();
    } else {
      AudioEngine.playLike();
    }
    onClick(event);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center justify-center cursor-pointer focus:outline-none ${className}`}
      aria-label={liked ? "Unlike post" : "Like post"}
      aria-pressed={liked}
    >
      <LikeIcon liked={liked} />
    </button>
  );
}
