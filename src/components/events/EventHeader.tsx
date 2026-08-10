import React, { useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";
import { OptimizedImage } from "@/components/media/OptimizedImage";

interface EventHeaderProps {
  bannerUrl?: string | null;
  title: string;
  children?: React.ReactNode;
}

/**
 * EventHeader component rendering event hero banner with a fluid Framer Motion
 * Parallax Scroll effect.
 *
 * Performance note: `useScroll` and `useTransform` bypass React re-renders and
 * directly mutate DOM transform properties. `useState` is deliberately avoided
 * to maintain 60fps smooth scrolling.
 */
export function EventHeader({ bannerUrl, title, children }: EventHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  // Map scrollY position [0, 500] to Y translation [0, 150] (half-speed parallax feel)
  const y = useTransform(scrollY, [0, 500], [0, 150]);

  return (
    <section
      ref={containerRef}
      className="relative w-full overflow-hidden border-b-2 border-black bg-peach/30"
    >
      {bannerUrl ? (
        <motion.div style={{ y }} className="absolute inset-0 -top-10 h-[120%] w-full">
          <OptimizedImage
            src={bannerUrl}
            alt={`${title} event banner`}
            className="h-full w-full object-cover"
            width={1344}
            height={700}
            responsiveWidths={[448, 672, 896, 1344]}
            sizes="100vw"
            priority
            fallback={
              <div className="h-full w-full bg-linear-to-br from-peach via-pink-200 to-lime/40" />
            }
          />
          <div className="absolute inset-0 bg-black/50" />
        </motion.div>
      ) : (
        <motion.div
          style={{ y }}
          className="absolute inset-0 -top-10 h-[120%] w-full bg-linear-to-br from-peach via-pink-200 to-lime/40"
        />
      )}

      <div className="relative mx-auto flex min-h-[50vh] max-w-4xl flex-col justify-end px-4 py-16 md:min-h-[60vh] md:px-6 md:py-24">
        {children}
      </div>
    </section>
  );
}
