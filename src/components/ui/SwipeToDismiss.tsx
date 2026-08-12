import React, { useState } from "react";
import { LazyMotion, m, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { loadDomMax } from "@/lib/motionFeatures";

// How far (px) the card must travel before we treat it as a deliberate dismiss.
const DISTANCE_THRESHOLD = 96;
// How fast (px/s) the card must be flicked to dismiss even on a short drag.
const VELOCITY_THRESHOLD = 500;
// How far off-screen the card flies once a dismiss is confirmed.
const EXIT_DISTANCE = 400;

interface SwipeToDismissProps {
  children: React.ReactNode;
  /**
   * Called once the swipe has visually completed. This is where the
   * optimistic deletion mutation should be triggered.
   */
  onDismiss: () => void;
  className?: string;
  /** Disable the gesture (e.g. while a delete is already in flight). */
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Wraps a notification/list card with a physics-based, drag="x" swipe gesture.
 * Swiping far enough or fast enough flings the card off-screen and fires
 * `onDismiss`; anything short of that snaps back with a spring.
 */
export function SwipeToDismiss({
  children,
  onDismiss,
  className,
  disabled = false,
  ariaLabel,
}: SwipeToDismissProps) {
  const x = useMotionValue(0);
  const cardOpacity = useTransform(x, [-EXIT_DISTANCE, 0, EXIT_DISTANCE], [0, 1, 0]);
  // Reveal a delete affordance behind the card as it's dragged away.
  const revealOpacity = useTransform(
    x,
    [-DISTANCE_THRESHOLD, -12, 0, 12, DISTANCE_THRESHOLD],
    [1, 0, 0, 0, 1],
  );
  const [isSettling, setIsSettling] = useState(false);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isSettling) return;

    const { offset, velocity } = info;
    const distancePastThreshold = Math.abs(offset.x) > DISTANCE_THRESHOLD;
    const velocityPastThreshold = Math.abs(velocity.x) > VELOCITY_THRESHOLD;

    // A fast flick counts even if the drag distance itself was short, as long
    // as it's heading the same way the card was dragged.
    const shouldDismiss =
      distancePastThreshold || (velocityPastThreshold && Math.sign(offset.x || velocity.x) !== 0);

    if (shouldDismiss) {
      const direction = offset.x !== 0 ? Math.sign(offset.x) : Math.sign(velocity.x) || 1;
      setIsSettling(true);
      animate(x, direction * EXIT_DISTANCE, {
        type: "spring",
        stiffness: 260,
        damping: 26,
        onComplete: onDismiss,
      });
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
    }
  };

  return (
    <LazyMotion features={loadDomMax} strict={import.meta.env.DEV}>
      <div className="relative">
        {/* Delete affordance revealed behind the card while dragging */}
        <m.div
          aria-hidden="true"
          style={{ opacity: revealOpacity }}
          className="absolute inset-0 flex items-center justify-between rounded-[inherit] bg-red-500 px-5 text-white"
        >
          <Trash2 size={18} />
          <Trash2 size={18} />
        </m.div>

        <m.div
          role={ariaLabel ? "group" : undefined}
          aria-label={ariaLabel}
          drag={disabled ? false : "x"}
          dragDirectionLock
          dragElastic={0.85}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          style={{ x, opacity: cardOpacity, touchAction: "pan-y" }}
          className={className}
        >
          {children}
        </m.div>
      </div>
    </LazyMotion>
  );
}
