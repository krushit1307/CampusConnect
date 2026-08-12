import { useId, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  /** Current rating value (0 to `max`). */
  value: number;
  /** Called with the new value when the user picks a rating. Omit for a read-only display. */
  onChange?: (value: number) => void;
  /** Number of stars to render. Defaults to 5. */
  max?: number;
  /** Whether hovering/clicking the left half of a star selects a X.5 value. Defaults to true. */
  allowHalf?: boolean;
  /** Force read-only mode even if `onChange` is passed. */
  readOnly?: boolean;
  /** Pixel size of each star. Defaults to 28. */
  size?: number;
  /** Accessible label read out for the interactive slider. */
  label?: string;
  className?: string;
}

/**
 * A custom, accessible star rating control.
 *
 * - Hovering fills stars up to the cursor position, supporting half-star
 *   precision (`allowHalf`) using clip-path over two stacked SVG stars.
 * - Clicking a star locks in that value.
 * - Fully keyboard accessible: focus the widget and use Left/Right (or
 *   Down/Up) arrow keys to decrease/increase the rating, Home/End to jump
 *   to the min/max.
 * - Exposes `role="slider"` with the appropriate aria-value* attributes
 *   when interactive, or `role="img"` with a text alternative when used
 *   as a read-only display.
 */
export function StarRating({
  value,
  onChange,
  max = 5,
  allowHalf = true,
  readOnly = false,
  size = 28,
  label = "Rating",
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const isInteractive = !readOnly && !!onChange;
  const displayValue = hoverValue ?? value;
  const step = allowHalf ? 0.5 : 1;
  const hintId = useId();

  function valueFromPointer(e: MouseEvent<HTMLSpanElement>, starIndex: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    const hoveredLeftHalf = e.clientX - rect.left < rect.width / 2;
    return allowHalf && hoveredLeftHalf ? starIndex - 0.5 : starIndex;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!isInteractive || !onChange) return;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        onChange(Math.min(max, value + step));
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        onChange(Math.max(0, value - step));
        break;
      case "Home":
        e.preventDefault();
        onChange(0);
        break;
      case "End":
        e.preventDefault();
        onChange(max);
        break;
    }
  }

  return (
    <div
      {...(isInteractive
        ? {
            role: "slider",
            "aria-label": label,
            "aria-valuemin": 0,
            "aria-valuemax": max,
            "aria-valuenow": value,
            "aria-valuetext": `${value} out of ${max} stars`,
            "aria-describedby": hintId,
            tabIndex: 0,
          }
        : {
            role: "img",
            "aria-label": `${value} out of ${max} stars`,
          })}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setHoverValue(null)}
      className={cn(
        "inline-flex gap-1 outline-none",
        isInteractive &&
          "cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-brand-orange-base focus-visible:ring-offset-2",
        className,
      )}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((starIndex) => {
        const fraction = Math.max(0, Math.min(1, displayValue - (starIndex - 1)));

        return (
          <span
            key={starIndex}
            className={cn(
              "relative inline-block",
              isInteractive && "transition-transform hover:scale-110",
            )}
            style={{ width: size, height: size }}
            onMouseMove={
              isInteractive ? (e) => setHoverValue(valueFromPointer(e, starIndex)) : undefined
            }
            onClick={isInteractive ? (e) => onChange?.(valueFromPointer(e, starIndex)) : undefined}
          >
            <Star size={size} className="absolute inset-0 text-gray-300" aria-hidden="true" />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${(1 - fraction) * 100}% 0 0)` }}
            >
              <Star
                size={size}
                className="text-brand-orange-base fill-brand-orange-base"
                aria-hidden="true"
              />
            </span>
          </span>
        );
      })}
      {isInteractive && (
        <span id={hintId} className="sr-only">
          Use the left and right arrow keys to change the rating.
        </span>
      )}
    </div>
  );
}
