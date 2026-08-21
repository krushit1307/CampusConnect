import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn } from "@/lib/utils";

export interface HoldToConfirmButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onConfirm"
> {
  /**
   * Function triggered when the user holds down the button for holdDuration ms
   * or confirms via the keyboard fallback modal.
   */
  onConfirm: () => void | Promise<void>;

  /**
   * Hold duration in milliseconds (default: 3000ms).
   */
  holdDuration?: number;

  /**
   * Title for the keyboard accessibility fallback modal.
   */
  confirmTitle?: string;

  /**
   * Description text for the keyboard accessibility fallback modal.
   */
  confirmDescription?: string;

  /**
   * Text for the confirm button inside the modal.
   */
  confirmText?: string;

  /**
   * Text for the cancel button inside the modal.
   */
  cancelText?: string;

  /**
   * Visual variant of the button.
   */
  variant?: ButtonProps["variant"];

  /**
   * Button size.
   */
  size?: ButtonProps["size"];

  /**
   * Additional CSS classes.
   */
  className?: string;

  /**
   * Button text/content.
   */
  children?: React.ReactNode;
}

const RADIUS = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~75.398

export const HoldToConfirmButton = React.forwardRef<HTMLButtonElement, HoldToConfirmButtonProps>(
  (
    {
      onConfirm,
      holdDuration = 3000,
      confirmTitle = "Are you sure?",
      confirmDescription = "This action cannot be undone. Are you sure you want to proceed?",
      confirmText = "Confirm",
      cancelText = "Cancel",
      variant = "destructive",
      size = "md",
      className,
      children = "Hold to Confirm",
      disabled = false,
      onMouseDown,
      onMouseUp,
      onMouseLeave,
      onTouchStart,
      onTouchEnd,
      onTouchCancel,
      onKeyDown,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [isHolding, setIsHolding] = React.useState(false);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);
    const isKeyboardEventRef = React.useRef(false);
    const prefersReducedMotion = useReducedMotion();

    const clearHoldTimer = React.useCallback(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsHolding(false);
    }, []);

    const startHold = React.useCallback(
      (e: React.SyntheticEvent) => {
        if (disabled) return;
        if ("button" in e && (e as React.MouseEvent).button !== 0) return;

        isKeyboardEventRef.current = false;
        setIsHolding(true);
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
          setIsHolding(false);
          timerRef.current = null;
          onConfirm();
        }, holdDuration);
      },
      [disabled, holdDuration, onConfirm],
    );

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      startHold(e);
      onMouseDown?.(e);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
      clearHoldTimer();
      onMouseUp?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      clearHoldTimer();
      onMouseLeave?.(e);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
      startHold(e);
      onTouchStart?.(e);
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
      clearHoldTimer();
      onTouchEnd?.(e);
    };

    const handleTouchCancel = (e: React.TouchEvent<HTMLButtonElement>) => {
      clearHoldTimer();
      onTouchCancel?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        isKeyboardEventRef.current = true;
        e.preventDefault();
        setIsModalOpen(true);
      }
      onKeyDown?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isKeyboardEventRef.current && !disabled) {
        setIsModalOpen(true);
        isKeyboardEventRef.current = false;
      }
      onClick?.(e);
    };

    React.useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    const buttonLabel = typeof children === "string" ? children : "Hold to confirm action";

    return (
      <>
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          className={cn(
            buttonVariants({ variant, size }),
            "relative select-none overflow-hidden flex items-center justify-center gap-2 cursor-pointer",
            isHolding && "ring-2 ring-destructive ring-offset-2",
            className,
          )}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          aria-label={props["aria-label"] || buttonLabel}
          {...props}
        >
          {/* Circular Progress Ring */}
          <svg
            className="w-5 h-5 shrink-0"
            viewBox="0 0 32 32"
            aria-hidden="true"
            data-testid="hold-progress-svg"
          >
            {/* Background track circle */}
            <circle
              cx="16"
              cy="16"
              r={RADIUS}
              className="stroke-current opacity-30"
              strokeWidth="3"
              fill="none"
            />
            {/* Animated filling circle */}
            <motion.circle
              cx="16"
              cy="16"
              r={RADIUS}
              className="stroke-current"
              strokeWidth="3"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeLinecap="round"
              style={{
                transformOrigin: "center",
                transform: "rotate(-90deg)",
              }}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{
                strokeDashoffset: isHolding ? 0 : CIRCUMFERENCE,
              }}
              transition={
                isHolding
                  ? {
                      duration: prefersReducedMotion ? 0.01 : holdDuration / 1000,
                      ease: "linear",
                    }
                  : { duration: 0.15, ease: "easeOut" }
              }
              data-testid="hold-progress-circle"
            />
          </svg>

          <span>{children}</span>
        </button>

        {isModalOpen && (
          <ConfirmModal
            open={isModalOpen}
            title={confirmTitle}
            description={confirmDescription}
            confirmText={confirmText}
            cancelText={cancelText}
            confirmVariant={variant}
            onConfirm={() => {
              setIsModalOpen(false);
              onConfirm();
            }}
            onCancel={() => setIsModalOpen(false)}
          />
        )}
      </>
    );
  },
);

HoldToConfirmButton.displayName = "HoldToConfirmButton";
