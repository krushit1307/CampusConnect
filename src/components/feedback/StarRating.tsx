import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RatingValue } from "@/types/eventFeedback";
import { RATING_LABELS } from "@/types/eventFeedback";

interface StarRatingProps {
  value: RatingValue | 0;
  onChange?: (rating: RatingValue) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
  showLabel?: boolean;
}

export function StarRating({
  value,
  onChange,
  size = "md",
  readonly = false,
  showLabel = true,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<RatingValue | 0>(0);

  const sizeClasses = {
    sm: "text-lg gap-0.5",
    md: "text-2xl gap-1",
    lg: "text-3xl gap-1.5",
  };

  const displayValue = hovered || value;
  const label = displayValue > 0 ? RATING_LABELS[displayValue as RatingValue] : null;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn("flex items-center", sizeClasses[size])}
        onMouseLeave={() => !readonly && setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const rating = star as RatingValue;
          const isFilled = star <= displayValue;
          return (
            <button
              key={star}
              type="button"
              disabled={readonly}
              onClick={() => onChange?.(rating)}
              onMouseEnter={() => !readonly && setHovered(rating)}
              className={cn(
                "transition-all duration-150 select-none",
                readonly ? "cursor-default" : "cursor-pointer hover:scale-110",
                isFilled ? "opacity-100" : "opacity-30",
              )}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
            >
              ★
            </button>
          );
        })}
      </div>
      {showLabel && label && (
        <span
          className="text-sm font-semibold"
          style={{ color: RATING_LABELS[displayValue as RatingValue]?.color }}
        >
          {RATING_LABELS[displayValue as RatingValue]?.emoji} {label.label}
        </span>
      )}
    </div>
  );
}
