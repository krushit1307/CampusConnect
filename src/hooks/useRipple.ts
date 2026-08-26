import { useCallback, useRef, useState } from "react";

export interface Ripple {
  id: number;
  /** Left offset of the ripple square (already centered on the click point). */
  left: number;
  /** Top offset of the ripple square (already centered on the click point). */
  top: number;
  /** Square size that guarantees the ripple covers the whole button. */
  size: number;
}

export interface RippleSourceEvent {
  clientX: number;
  clientY: number;
  currentTarget: HTMLElement;
}

export interface RippleGeometry {
  left: number;
  top: number;
  size: number;
}

type DOMRectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

function distance(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Computes the ripple square geometry for a click on `rect`.
 *
 * Keyboard activations have no pointer coordinates (`clientX`/`clientY` are
 * 0), so the ripple is spawned from the exact center of the button instead of
 * a bogus corner position (#2395).
 */
export function getRippleGeometry(
  clientX: number,
  clientY: number,
  rect: DOMRectLike,
): RippleGeometry {
  const isKeyboard = clientX === 0 && clientY === 0;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const x = isKeyboard ? centerX : clientX - rect.left;
  const y = isKeyboard ? centerY : clientY - rect.top;

  const diameter =
    2 *
    Math.max(
      distance(x, y),
      distance(x, rect.height - y),
      distance(rect.width - x, y),
      distance(rect.width - x, rect.height - y),
    );

  return {
    left: x - diameter / 2,
    top: y - diameter / 2,
    size: diameter,
  };
}

/**
 * Fluid "ripple" feedback for button presses (#2395).
 *
 * Tracks an array of active ripples so rapid multi-clicks render as several
 * overlapping waves. Consume it with the `RippleButton` wrapper, or wire the
 * handlers onto any element yourself:
 *
 *   const { ripples, addRipple, removeRipple } = useRipple();
 *   <button onMouseDown={addRipple} onKeyDown={addRipple}>
 *     {ripples.map((r) => <motion.span key={r.id} ... onAnimationComplete={() => removeRipple(r.id)} />)}
 *   </button>
 */
export function useRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);

  const addRipple = useCallback((event: RippleSourceEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const { left, top, size } = getRippleGeometry(event.clientX, event.clientY, rect);
    const id = ++idRef.current;
    setRipples((prev) => [...prev, { id, left, top, size }]);
  }, []);

  const removeRipple = useCallback((id: number) => {
    setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
  }, []);

  return { ripples, addRipple, removeRipple };
}
