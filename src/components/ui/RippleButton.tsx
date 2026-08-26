import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useRipple, type Ripple } from "@/hooks/useRipple";

export interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Extra classes for each ripple circle (e.g. a custom color/opacity). */
  rippleClassName?: string;
}

interface RippleSpanProps {
  ripple: Ripple;
  className?: string;
  onComplete: () => void;
}

function RippleSpan({ ripple, className, onComplete }: RippleSpanProps) {
  return (
    <motion.span
      data-testid="ripple-effect"
      aria-hidden="true"
      className={cn("pointer-events-none absolute rounded-full bg-black/20", className)}
      style={{
        left: ripple.left,
        top: ripple.top,
        width: ripple.size,
        height: ripple.size,
      }}
      initial={{ scale: 0, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onAnimationComplete={onComplete}
    />
  );
}

/**
 * Button wrapper that spawns a Material-style ripple at the exact point the
 * user presses, animated with Framer Motion (#2395).
 *
 * - Pointer presses ripple from the cursor position.
 * - Keyboard activation (Enter / Space) has no coordinates, so the ripple
 *   safely spawns from the center of the button.
 * - Ripples are removed from the DOM once their animation completes.
 */
export const RippleButton = React.forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ className, rippleClassName, children, onMouseDown, onKeyDown, ...props }, ref) => {
    const { ripples, addRipple, removeRipple } = useRipple();

    return (
      <button
        ref={ref}
        className={cn("relative isolate overflow-hidden", className)}
        onMouseDown={(event) => {
          onMouseDown?.(event);
          addRipple(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "Enter" || event.key === " ") {
            // Keyboard activation carries no pointer coordinates; spawn the
            // ripple from the center of the button.
            addRipple({ clientX: 0, clientY: 0, currentTarget: event.currentTarget });
          }
        }}
        {...props}
      >
        {children}
        {ripples.map((ripple) => (
          <RippleSpan
            key={ripple.id}
            ripple={ripple}
            className={rippleClassName}
            onComplete={() => removeRipple(ripple.id)}
          />
        ))}
      </button>
    );
  },
);
RippleButton.displayName = "RippleButton";
