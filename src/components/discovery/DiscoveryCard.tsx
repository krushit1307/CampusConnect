import { motion, useMotionValue, useTransform } from "framer-motion";
import type { DiscoveryClub } from "./useClubDiscovery";

interface DiscoveryCardProps {
  club: DiscoveryClub;
  /** 0 = top of the stack (drag-enabled). Higher = deeper in the stack. */
  stackIndex: number;
  totalCount: number;
  isTop: boolean;
  swipeThreshold: number;
  onDismiss: (direction: "left" | "right") => void;
}

const STACK_OFFSET_PX = 8;
const STACK_SCALE_STEP = 0.04;

/**
 * DiscoveryCard — a single club card in the swipe stack.
 *
 * - Top card (stackIndex 0): drag-enabled via framer-motion. useTransform
 *   maps the drag x to a slight rotation (max +/- 15deg at +/- 200px)
 *   and an opacity that fades as the card leaves the screen. Past the
 *   swipe threshold (or a fast flick) the card animates off-screen and
 *   onDismiss is called with the direction.
 * - Lower cards: static, stacked behind with translateY + scale so the
 *   user can see more cards are waiting underneath.
 */
export function DiscoveryCard({
  club,
  stackIndex,
  totalCount,
  isTop,
  swipeThreshold,
  onDismiss,
}: DiscoveryCardProps) {
  if (!isTop) {
    const offsetY = stackIndex * STACK_OFFSET_PX;
    const scale = 1 - stackIndex * STACK_SCALE_STEP;
    const zIndex = totalCount - stackIndex;
    return (
      <div
        data-testid="discovery-card-back"
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-black bg-white shadow-md"
        style={{ transform: `translateY(${offsetY}px) scale(${scale})`, zIndex }}
      />
    );
  }

  return <DraggableTopCard club={club} swipeThreshold={swipeThreshold} onDismiss={onDismiss} />;
}

interface DraggableTopCardProps {
  club: DiscoveryClub;
  swipeThreshold: number;
  onDismiss: (direction: "left" | "right") => void;
}

function DraggableTopCard({ club, swipeThreshold, onDismiss }: DraggableTopCardProps) {
  // Bind a useMotionValue to the same drag axis the motion.div uses.
  // We pass it as `style.x` so framer-motion's drag layer updates it on
  // every pointer move; useTransform then derives rotation + opacity from
  // it without re-rendering React.
  const x = useMotionValue(0);

  // Issue #1903 spec: map drag x to rotation. -200px -> -15deg, +200px
  // -> +15deg. Linear interpolation via useTransform.
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  // Fade slightly as the card leaves the viewport so the swipe gesture
  // feels kinetic.
  const opacity = useTransform(x, [-300, -200, 0, 200, 300], [0.4, 0.8, 1, 0.8, 0.4]);

  const handleDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number }; velocity: { x: number } },
  ) => {
    const dx = info.offset.x;
    const vx = info.velocity.x;
    // Spec: >150px right triggers join. We also accept a fast flick
    // (|vx| > 500 px/s) in either direction as a deliberate gesture.
    const flicked = Math.abs(vx) > 500;
    const passed = Math.abs(dx) > swipeThreshold;

    if (flicked || passed) {
      onDismiss(dx > 0 ? "right" : "left");
    }
    // Otherwise: framer-motion's drag with dragMomentum on (default) snaps
    // the card back to x=0 with built-in spring physics. No explicit
    // animation needed.
  };

  return (
    <motion.div
      data-testid="discovery-card-top"
      data-club-id={club.id}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      style={{ x, rotate, opacity, zIndex: 100 }}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: "grabbing" }}
      className="absolute inset-0 cursor-grab overflow-hidden rounded-2xl border-2 border-black bg-white shadow-lg"
      role="article"
      aria-label={`${club.name} club card`}
    >
      {club.banner_url ? (
        <img src={club.banner_url} alt="" className="h-1/2 w-full object-cover" loading="lazy" />
      ) : (
        <div
          data-testid="discovery-card-banner-fallback"
          className="h-1/2 w-full bg-gradient-to-br from-brand-blue-dark to-violet-700"
        />
      )}

      <div className="flex h-1/2 flex-col justify-between p-6">
        <div>
          <h3 className="font-display text-2xl font-bold text-brand-blue-dark">{club.name}</h3>
          {club.category && (
            <p className="mt-1 font-mono text-xs font-bold uppercase text-gray-600">
              {club.category}
            </p>
          )}
          {club.description && (
            <p className="mt-3 line-clamp-3 text-sm text-gray-700">{club.description}</p>
          )}
        </div>
        {typeof club.member_count === "number" && (
          <p
            data-testid="discovery-card-member-count"
            className="font-mono text-xs font-bold uppercase text-gray-500"
          >
            {club.member_count} {club.member_count === 1 ? "member" : "members"}
          </p>
        )}
      </div>
    </motion.div>
  );
}
