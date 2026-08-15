import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LazyMotion, m, useMotionValue, animate, type PanInfo } from "framer-motion";
import { loadDomMax } from "@/lib/motionFeatures";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useOptionalModal } from "@/components/modal/ModalContext";

/** Bubble diameter in px — >= 48px touch target per issue #1873. */
export const BUBBLE_SIZE = 56;
/** Distance kept between the bubble and any screen edge. */
export const EDGE_MARGIN = 16;
/** Height of the bottom "throw away" zone that dismisses the bubble. */
export const DISMISS_ZONE_HEIGHT = 96;
/** z-index while the bubble is the topmost floating element. */
export const Z_INDEX_ACTIVE = 90;
/** z-index while a critical full-screen modal is open (bubble drops below it). */
export const Z_INDEX_LOWERED = 40;

const STORAGE_KEY = "floating_chat_dismissed";

export interface Viewport {
  width: number;
  height: number;
}

export interface SnapPosition {
  x: number;
  y: number;
}

/**
 * Snap target for the bubble's top-left corner after a drag release.
 * Snaps to the nearest vertical edge and clamps the y position so the
 * bubble never sits inside the dismiss zone or off-screen.
 */
export function getSnapPosition(
  centerX: number,
  centerY: number,
  viewport: Viewport,
  bubbleSize: number,
  edgeMargin: number,
  dismissZoneHeight: number,
): SnapPosition {
  const x = centerX < viewport.width / 2 ? edgeMargin : viewport.width - bubbleSize - edgeMargin;
  const maxY = Math.max(edgeMargin, viewport.height - dismissZoneHeight - bubbleSize - edgeMargin);
  const minY = edgeMargin;
  const y = Math.min(Math.max(centerY - bubbleSize / 2, minY), maxY);
  return { x, y };
}

/** True when the bubble's vertical center has entered the dismiss zone. */
export function isInDismissZone(
  centerY: number,
  viewportHeight: number,
  dismissZoneHeight: number,
): boolean {
  return centerY > viewportHeight - dismissZoneHeight;
}

function getViewport(): Viewport {
  return typeof window === "undefined"
    ? { width: 1024, height: 768 }
    : { width: window.innerWidth, height: window.innerHeight };
}

/**
 * FloatingChat — a Messenger-style draggable chat head (issue #1873).
 *
 * - `m.button` with full 2D drag; `dragConstraints` bound to the
 *   window so the bubble cannot be thrown off-screen.
 * - On drag end the bubble spring-snaps to the nearest vertical edge
 *   (left/right) using its `useMotionValue` position.
 * - Dragging the bubble into the bottom dismiss zone plays an exit
 *   animation and hides it (persisted in localStorage).
 * - A clean tap (no drag) navigates to /messages.
 * - z-index is high by default but drops when a modal is open so
 *   full-screen overlays (e.g. payment flows) render above it.
 */
export function FloatingChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const modal = useOptionalModal();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");
  const [viewport, setViewport] = useState<Viewport>(getViewport);

  const x = useMotionValue(viewport.width - BUBBLE_SIZE - EDGE_MARGIN);
  const y = useMotionValue(viewport.height * 0.55);
  const didDragRef = useRef(false);

  const dragConstraints = useMemo(
    () => ({
      left: EDGE_MARGIN,
      top: EDGE_MARGIN,
      right: viewport.width - BUBBLE_SIZE - EDGE_MARGIN,
      bottom: viewport.height - BUBBLE_SIZE - EDGE_MARGIN,
    }),
    [viewport],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const snapToEdge = useCallback(() => {
    const { x: sx, y: sy } = getSnapPosition(
      x.get() + BUBBLE_SIZE / 2,
      y.get() + BUBBLE_SIZE / 2,
      viewport,
      BUBBLE_SIZE,
      EDGE_MARGIN,
      DISMISS_ZONE_HEIGHT,
    );
    animate(x, sx, { type: "spring", stiffness: 260, damping: 24 });
    animate(y, sy, { type: "spring", stiffness: 260, damping: 24 });
  }, [viewport, x, y]);

  // Re-snap to the nearest edge whenever the window resizes so the
  // bubble stays fully visible inside the new viewport bounds.
  useEffect(() => {
    const handleResize = () => {
      setViewport(getViewport());
      snapToEdge();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [snapToEdge]);

  const handleDragStart = () => {
    didDragRef.current = true;
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
    const centerX = x.get() + BUBBLE_SIZE / 2;
    const centerY = y.get() + BUBBLE_SIZE / 2;

    if (isInDismissZone(centerY, viewport.height, DISMISS_ZONE_HEIGHT)) {
      // Fly the bubble off the bottom of the screen, then remove it.
      animate(y, viewport.height + BUBBLE_SIZE, {
        type: "spring",
        stiffness: 200,
        damping: 22,
      });
      animate(x, centerX < viewport.width / 2 ? -BUBBLE_SIZE : viewport.width, {
        type: "spring",
        stiffness: 200,
        damping: 22,
      });
      localStorage.setItem(STORAGE_KEY, "1");
      setDismissed(true);
      return;
    }

    snapToEdge();
  };

  const handleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    navigate("/messages");
  };

  if (!user || dismissed || location.pathname.startsWith("/messages")) return null;

  const zIndex = modal?.activeModal ? Z_INDEX_LOWERED : Z_INDEX_ACTIVE;

  return (
    <LazyMotion features={loadDomMax} strict={import.meta.env.DEV}>
      <m.button
        data-testid="floating-chat"
        type="button"
        aria-label="Open chat"
        drag
        dragMomentum
        dragConstraints={dragConstraints}
        dragElastic={0.3}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        style={{ x, y, zIndex, touchAction: "none" }}
        whileTap={{ scale: 0.92 }}
        className="fixed left-0 top-0 flex h-14 w-14 cursor-grab items-center justify-center overflow-hidden rounded-full border-2 border-black bg-brand-blue-dark text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-brand-blue-alt active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      >
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url as string}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <MessageCircle size={26} aria-hidden="true" />
        )}
      </m.button>
    </LazyMotion>
  );
}
