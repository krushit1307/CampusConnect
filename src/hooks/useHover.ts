import { useEffect, useRef, useState, RefObject } from "react";

/**
 * Tracks whether the element attached to the returned ref is currently
 * hovered, using native mouseenter/mouseleave listeners instead of inline
 * onMouseEnter/onMouseLeave props scattered across JSX. (#1234)
 *
 * Usage:
 *   const [ref, isHovered] = useHover<HTMLDivElement>();
 *   <div ref={ref}>{isHovered ? "Hovered!" : "Not hovered"}</div>
 */
export function useHover<T extends HTMLElement = HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    node.addEventListener("mouseenter", handleMouseEnter);
    node.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      node.removeEventListener("mouseenter", handleMouseEnter);
      node.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return [ref, isHovered];
}
