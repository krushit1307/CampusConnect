import { useId } from "react";
import Star from "lucide-react/dist/esm/icons/star";
import { cn } from "@/lib/utils";

interface RadioStarRatingProps {
  /** Current rating (0 to `max`). Defaults to 0. */
  value: number;
  /** Called with the new value when the user picks a star. */
  onChange: (value: number) => void;
  /** Number of stars. Defaults to 5 (per issue #1900 spec). */
  max?: number;
  /** Accessible label for the radiogroup. Defaults to "Rate this event". */
  label?: string;
  /** Required for form-submission semantics. Defaults to true. */
  required?: boolean;
  /** Pixel size of each star icon. Defaults to 28. */
  size?: number;
  className?: string;
  /** Optional name to share across radios so they behave as one group. */
  name?: string;
}

/**
 * RadioStarRating — a keyboard- and screen-reader-accessible star rating
 * widget (issue #1900).
 *
 * Implementation follows the WAI-ARIA Authoring Practices "Radio Group"
 * pattern, NOT the WAI-ARIA "slider" pattern used by `StarRating`. We use
 * native `<input type="radio">` elements hidden via `sr-only` so that:
 *
 *   - Screen readers announce the group, the current selection, and the
 *     total star count correctly without any custom JS.
 *   - The browser's native arrow-key navigation between radios "just
 *     works" — focus moves, the input is :checked, and the visual state
 *     follows via the adjacent-sibling + `:checked` CSS combinator.
 *   - Form submission carries the selected value as a regular form field,
 *     with no extra state plumbing.
 *
 * The parent container has `role="radiogroup"` and an `aria-label`. Each
 * `<label>` wraps a hidden radio + an SVG star icon. The label has a
 * minimum 44x44 px tap target so it meets Apple/Google mobile a11y
 * guidelines (issue edge case).
 */
export function RadioStarRating({
  value,
  onChange,
  max = 5,
  label = "Rate this event",
  required = true,
  size = 28,
  className,
  name,
}: RadioStarRatingProps) {
  const groupName = useId();
  const fieldName = name ?? `radio-star-rating-${groupName}`;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-required={required}
      data-testid="radio-star-rating"
      className={cn("inline-flex items-center gap-1", className)}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((starIndex) => {
        // Unique id per radio so the wrapping <label htmlFor=...> is
        // keyboard-tabbable as a single accessible label per star.
        const inputId = `${groupName}-${starIndex}`;
        const isChecked = starIndex === value;
        // Stars 1..value are filled; the rest are outlined.
        const filled = starIndex <= value;

        return (
          <label
            key={starIndex}
            htmlFor={inputId}
            data-testid={`radio-star-${starIndex}`}
            className={cn(
              // min 44x44 tap target — issue edge case.
              "inline-flex cursor-pointer items-center justify-center rounded",
              "min-h-[44px] min-w-[44px]",
              "transition-transform hover:scale-105 active:scale-95",
              "focus-within:ring-2 focus-within:ring-brand-orange-base focus-within:ring-offset-2",
            )}
          >
            <input
              type="radio"
              id={inputId}
              name={fieldName}
              value={starIndex}
              checked={isChecked}
              required={required && starIndex === 1}
              onChange={() => onChange(starIndex)}
              // Hidden from sighted users; still focusable for keyboard nav.
              className="sr-only"
              aria-label={`${starIndex} out of ${max} stars`}
              data-testid={`radio-star-input-${starIndex}`}
            />
            <Star
              size={size}
              aria-hidden="true"
              className={cn(
                "transition-colors",
                filled ? "fill-brand-orange-base text-brand-orange-base" : "text-gray-300",
              )}
            />
          </label>
        );
      })}
    </div>
  );
}
