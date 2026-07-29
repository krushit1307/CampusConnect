import { ReactNode } from "react";
import { useScrollDirection } from "@/hooks/useScrollDirection";

interface ScrollAwareFabProps {
  children: ReactNode;
}

/**
 * Anchors its children as a Floating Action Button in the bottom-right
 * corner on mobile only (md:hidden). Hides itself (translate) while
 * scrolling down so it doesn't block content on long feeds, and instantly
 * reveals itself on scroll-up for quick access. (#1232)
 *
 * On desktop (md and up) this renders nothing — the existing inline
 * toolbar button remains the only entry point there.
 */
export function ScrollAwareFab({ children }: ScrollAwareFabProps) {
  const direction = useScrollDirection();

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 md:hidden transition-transform duration-300 ease-out ${
        direction === "down" ? "translate-y-24" : "translate-y-0"
      }`}
      aria-hidden={direction === "down"}
    >
      {children}
    </div>
  );
}
