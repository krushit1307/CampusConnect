import { AnimatePresence, motion, type Transition } from "framer-motion";
import type { ReactNode } from "react";

export interface SkeletonCrossfadeProps {
  /** True if content is loading and skeleton should be displayed */
  isLoading: boolean;
  /** Skeleton element to show during loading */
  skeleton: ReactNode;
  /** Actual content element to show when loaded */
  children: ReactNode;
  /** Optional layoutId for Framer Motion shared layout animation */
  layoutId?: string;
  /** Class name for the container element */
  className?: string;
  /** AnimatePresence mode @default "wait" */
  mode?: "wait" | "sync" | "popLayout";
  /** Custom transition configuration */
  transition?: Transition;
}

const defaultTransition: Transition = {
  duration: 0.25,
  ease: "easeInOut",
};

/**
 * Wraps skeleton and content components in AnimatePresence with layout animations
 * to perform a fluid crossfade and container size transition.
 */
export function SkeletonCrossfade({
  isLoading,
  skeleton,
  children,
  layoutId,
  className = "",
  mode = "sync",
  transition = defaultTransition,
}: SkeletonCrossfadeProps) {
  return (
    <motion.div layout layoutId={layoutId} className={className}>
      <AnimatePresence mode={mode} initial={false}>
        {isLoading ? (
          <motion.div
            key="skeleton-view"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="w-full"
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content-view"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="w-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
