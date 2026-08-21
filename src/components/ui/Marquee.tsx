/**
 * Marquee — infinitely scrolling announcement bar.
 *
 * HOW THE SEAMLESS LOOP WORKS
 * ----------------------------
 * The wrapper is  display:flex  overflow:hidden  white-space:nowrap.
 * Inside it are TWO identical <div> children, each with min-width:100%
 * so they sit side-by-side and together fill 200% of the wrapper width.
 *
 * Each child has  animation: marquee 20s linear infinite  applied directly.
 * The keyframe goes from  translateX(0)  →  translateX(-100%).
 *
 * Because each child is 100% wide, a -100% translation moves it exactly
 * one full width to the left — off-screen. At that moment the animation
 * loops back to 0%, which is the exact position where the second child
 * was already visible. The two children are always offset by one full
 * width, so the loop is seamless: zero snap, zero flash, zero gap.
 *
 * ANIMATION — pure CSS only
 * -------------------------
 * No setInterval, setTimeout, requestAnimationFrame, or React state.
 * The @keyframes and class rules live in styles.css.
 *
 * ACCESSIBILITY
 * -------------
 * The scrolling wrapper is aria-hidden. A sr-only static copy outside it
 * lets screen readers encounter the text once without repetition.
 *
 * prefers-reduced-motion
 * ----------------------
 * Handled entirely in CSS: animation is removed from .marquee-child,
 * the second child is hidden, and the first child is centered.
 */

interface MarqueeProps {
  /** Announcement text or elements to scroll. */
  children: React.ReactNode;
  /** Extra Tailwind classes for the outer container (bg, border, etc.). */
  className?: string;
}

export function Marquee({ children, className = "" }: MarqueeProps) {
  return (
    <div
      className={`border-b-2 border-black bg-lime text-black dark:border-cream dark:bg-black dark:text-cream ${className}`}
    >
      {/* Screen-reader-only static copy — announced once, never repeated */}
      <span className="sr-only">{children}</span>

      {/*
       * Scrolling wrapper: flex row, overflow clipped, no wrapping.
       * aria-hidden — AT reads the sr-only copy above instead.
       */}
      <div className="marquee-wrapper" aria-hidden="true">
        {/* Child 1 — animates from 0 → -100% then loops */}
        <div className="marquee-child">
          <span className="inline-flex items-center px-8 py-1.5 font-mono text-xs font-bold uppercase tracking-widest">
            {children}
          </span>
        </div>

        {/* Child 2 — identical, offset by 100%, fills the gap while Child 1 resets */}
        <div className="marquee-child">
          <span className="inline-flex items-center px-8 py-1.5 font-mono text-xs font-bold uppercase tracking-widest">
            {children}
          </span>
        </div>
      </div>
    </div>
  );
}
