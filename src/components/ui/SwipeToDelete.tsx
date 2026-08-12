import React, { useState, useRef } from "react";
import { motion, useMotionValue, useAnimation, PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";

interface SwipeToDeleteProps {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  threshold?: number;
  ariaLabel?: string;
}

export function SwipeToDelete({
  children,
  onDelete,
  disabled = false,
  threshold = -70,
  ariaLabel,
}: SwipeToDeleteProps) {
  const x = useMotionValue(0);
  const controls = useAnimation();
  const hasVibratedRef = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Gesture locks to handle vertical scrolling conflict
  const [dragEnabled, setDragEnabled] = useState(true);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasDecidedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || isDeleting) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    hasDecidedRef.current = false;
    setDragEnabled(true);
    hasVibratedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || hasDecidedRef.current || disabled || isDeleting) return;

    const deltaX = Math.abs(e.clientX - dragStartRef.current.x);
    const deltaY = Math.abs(e.clientY - dragStartRef.current.y);

    if (deltaX > 5 || deltaY > 5) {
      hasDecidedRef.current = true;
      // If movement is mostly vertical, lock horizontal dragging to allow scroll
      if (deltaY >= deltaX) {
        setDragEnabled(false);
      } else if (deltaX > deltaY + 10) {
        // If movement is horizontal and exceeds vertical by 10px, confirm drag
        setDragEnabled(true);
      } else {
        // Ambient movement: disable dragging to favor scrolling
        setDragEnabled(false);
      }
    }
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
    hasDecidedRef.current = false;
  };

  // Trigger haptic vibration tick on threshold cross
  const handleDrag = (_event: any, info: PanInfo) => {
    if (disabled || isDeleting || !dragEnabled) return;

    // Framer motion drag offset
    const currentX = info.offset.x;
    if (currentX <= threshold) {
      if (!hasVibratedRef.current) {
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        hasVibratedRef.current = true;
      }
    } else {
      hasVibratedRef.current = false;
    }
  };

  const handleDragEnd = async (_event: any, info: PanInfo) => {
    if (disabled || isDeleting || !dragEnabled) return;

    const offset = info.offset.x;

    if (offset <= threshold) {
      setIsDeleting(true);
      // Animate card fully offscreen to the left
      await controls.start({ x: -400, opacity: 0, transition: { duration: 0.2 } });
      // Shrink container to zero height with smooth transition
      await controls.start({
        height: 0,
        opacity: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
        transition: { duration: 0.25, ease: "easeInOut" },
      });
      onDelete();
    } else {
      // Spring back to center
      void controls.start({
        x: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 350, damping: 28 },
      });
    }
    hasVibratedRef.current = false;
    dragStartRef.current = null;
    hasDecidedRef.current = false;
  };

  return (
    <motion.div
      animate={controls}
      layout
      className="relative overflow-hidden w-full select-none"
      style={{ originY: 0 }}
      aria-label={ariaLabel}
    >
      {/* Absolute red background div containing Trash icon (z-index 0) */}
      <div
        className="absolute inset-0 bg-red-600 flex items-center justify-end px-6 text-white rounded-[inherit] z-0"
        style={{ pointerEvents: "none" }}
      >
        <div className="flex flex-col items-center justify-center gap-1 pr-2">
          <Trash2 className="h-6 w-6 animate-bounce" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Delete</span>
        </div>
      </div>

      {/* Swipeable List Item Content (z-index 10) */}
      <motion.div
        drag={disabled || !dragEnabled ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={{ left: 0.5, right: 0.1 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        animate={controls}
        style={{ x }}
        className="relative bg-transparent z-10 w-full cursor-grab active:cursor-grabbing touch-pan-y"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
export default SwipeToDelete;
