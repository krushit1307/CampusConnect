import { useEffect, useRef, useState, RefObject } from "react";

/**
 * Tracks whether the ref'd element or any of its descendants currently has
 * keyboard focus, using focusin/focusout (which bubble, unlike focus/blur).
 * Treats keyboard accessibility with the same priority as mouse hover. (#1234)
 *
 * Usage:
 *   const [ref, isFocusWithin] = useFocusWithin<HTMLDivElement>();
 *   <div ref={ref}>{isFocusWithin ? "Focused!" : "Not focused"}</div>
 */
export function useFocusWithin<T extends HTMLElement = HTMLElement>(): [
  RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T | null>(null);
  const [isFocusWithin, setIsFocusWithin] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const updateFocusState = () => {
      setIsFocusWithin(node.contains(document.activeElement));
    };

    node.addEventListener("focusin", updateFocusState);
    node.addEventListener("focusout", updateFocusState);

    return () => {
      node.removeEventListener("focusin", updateFocusState);
      node.removeEventListener("focusout", updateFocusState);
    };
  }, []);

  return [ref, isFocusWithin];
}
