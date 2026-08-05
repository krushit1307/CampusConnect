import React, { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
} from "framer-motion";

/**
 * AnimatedCounter
 * ----------------
 * Spins a number up from 0 to `value` using a physics-based spring,
 * triggered the moment the element scrolls into view.
 *
 * Performance note (the important part):
 * We never put the animated number in React state. `motionValue` and
 * `springValue` live entirely in Framer Motion's own scheduler, and
 * `useTransform` derives the formatted string from the spring on every
 * animation frame. Because that transformed value is passed straight to
 * <motion.span> (not rendered via {state} in JSX), Framer Motion writes
 * it to the DOM node directly — no React re-render, no reconciliation,
 * 60 times a second, ever. React only renders this component once.
 *
 * @param {number} value        - target number to count up to
 * @param {number} [duration]   - ignored if you tune stiffness/damping instead;
 *                                kept as a comment hook for readability
 * @param {string} [prefix]     - e.g. "$"
 * @param {string} [suffix]     - e.g. "+"
 * @param {number} [decimals]   - decimal places to show (0 = integers)
 * @param {string} [locale]     - Intl locale for grouping, default "en-US"
 * @param {object} [springConfig] - override { stiffness, damping, mass }
 * @param {boolean} [triggerOnce] - only animate the first time it's seen
 */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  locale = "en-US",
  springConfig = { stiffness: 100, damping: 50 },
  triggerOnce = true,
  className = "",
}) {
  const ref = useRef(null);
  // amount: how much of the element must be visible before we fire.
  const isInView = useInView(ref, { once: triggerOnce, amount: 0.4 });

  // 1. Raw motion value, starts at 0. Lives outside React state.
  const motionValue = useMotionValue(0);

  // 2. Spring wrapping the raw value — this is what actually animates.
  //    High-ish stiffness + heavy damping = fast spin-up, no visible
  //    overshoot/bounce on settle, matching the "violent then smooth" brief.
  const springValue = useSpring(motionValue, springConfig);

  // 3. Format on every frame via useTransform. This runs in Framer's
  //    render loop, NOT React's — critical for perf at 60fps.
  const displayValue = useTransform(springValue, (latest) => {
    const rounded =
      decimals > 0
        ? Number(latest.toFixed(decimals))
        : Math.round(latest);
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
    } else if (!triggerOnce) {
      motionValue.set(0);
    }
  }, [isInView, value, motionValue, triggerOnce]);

  // Respect reduced-motion users: snap straight to the final value.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      motionValue.jump(value);
    }
  }, [value, motionValue]);

  return (
    <motion.span ref={ref} className={className}>
      {displayValue}
    </motion.span>
  );
}

export default AnimatedCounter;
