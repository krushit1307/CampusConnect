import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";

/**
 * AnimatedCounter
 * ----------------
 * Spins a number up from 0 to `value` on a damped spring the moment it
 * scrolls into view (e.g. Global Feed stats: "5,432 Active Members").
 *
 * Perf note: the animated value never touches React state. `motionValue`
 * and the spring wrapping it live entirely in Framer Motion's own
 * scheduler, and `useTransform` formats it (comma grouping) on every
 * animation frame. Because that transformed value is passed as children
 * of <motion.span> — not read into useState and re-rendered — Framer
 * Motion writes straight to the DOM node on each tick. React renders
 * this component once; the 60fps count-up never touches the render cycle.
 */
export default function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  locale = "en-US",
  springConfig = { stiffness: 100, damping: 50 },
  className = "",
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  // 1. Raw value, starts at 0, lives outside React state.
  const motionValue = useMotionValue(0);

  // 2. Spring wrapping the raw value — this is what actually animates.
  const springValue = useSpring(motionValue, springConfig);

  // 3. Format on every frame via useTransform (Framer's render loop, not React's).
  const displayValue = useTransform(springValue, (latest) => {
    const rounded = decimals > 0 ? Number(latest.toFixed(decimals)) : Math.round(latest);
    return (
      prefix +
      rounded.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) +
      suffix
    );
  });

  // 4. Trigger the count-up once the element scrolls into view.
  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  // Respect reduced-motion users: snap straight to the final value.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      motionValue.jump(value);
    }
  }, [value, motionValue]);

  return (
    <motion.span ref={ref} className={className}>
      {displayValue}
    </motion.span>
  );
}
