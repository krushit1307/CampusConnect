import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import "./FlipCard.css";

export interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  "data-testid"?: string;
}

/**
 * 3D flip card (issue #2324).
 *
 * The front face is shown by default; hovering rotates the card 180 degrees on
 * the Y-axis to reveal the back face. On touch devices `:hover` is unreliable,
 * so the flip is driven by an `onClick` state toggle instead — the CSS hover
 * is disabled entirely inside `@media (hover: none)`.
 */
export function FlipCard({
  front,
  back,
  className,
  ariaLabel = "Toggle card",
  "data-testid": dataTestId,
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const toggle = useCallback(() => setIsFlipped((flipped) => !flipped), []);

  return (
    <div
      className={cn("flip-card", isFlipped && "flip-card-is-flipped", className)}
      data-testid={dataTestId}
    >
      <button
        type="button"
        className="flip-card-trigger"
        onClick={toggle}
        aria-pressed={isFlipped}
        aria-label={ariaLabel}
      >
        <span className="flip-card-face flip-card-front">{front}</span>
        <span className="flip-card-face flip-card-back">{back}</span>
      </button>
    </div>
  );
}
