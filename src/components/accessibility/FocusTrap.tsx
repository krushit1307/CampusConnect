import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface FocusTrapProps {
  children: ReactNode;
  autoFocusSelector?: string;
  autoFocus?: boolean;
  onFallbackFocus?: () => void;
  className?: string;
  "data-testid"?: string;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      if (element.hasAttribute("disabled")) return false;
      if (element.getAttribute("aria-disabled") === "true") return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    },
  );
}

function focusElement(element: HTMLElement | null) {
  element?.focus({ preventScroll: true });
}

export function FocusTrap({
  children,
  autoFocusSelector,
  autoFocus = true,
  onFallbackFocus,
  className,
  "data-testid": dataTestId,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    if (!container) return;

    const focusInitial = () => {
      if (!autoFocus) return;
      const target = autoFocusSelector
        ? container.querySelector<HTMLElement>(autoFocusSelector)
        : getFocusableElements(container)[0];

      if (target) focusElement(target);
      else {
        container.focus({ preventScroll: true });
        onFallbackFocus?.();
      }
    };

    const frame = requestAnimationFrame(focusInitial);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(container);

      if (!focusable.length) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!container.contains(active)) {
        event.preventDefault();
        focusElement(event.shiftKey ? last : first);
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        focusElement(last);
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        focusElement(first);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || container.contains(target)) return;
      const focusable = getFocusableElements(container);
      focusElement(focusable[0] ?? container);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      const opener = openerRef.current;
      if (opener?.isConnected && !opener.hasAttribute("disabled")) {
        focusElement(opener);
      }
    };
  }, [autoFocus, autoFocusSelector, onFallbackFocus]);

  return (
    <div ref={containerRef} tabIndex={-1} className={className} data-testid={dataTestId}>
      {children}
    </div>
  );
}
