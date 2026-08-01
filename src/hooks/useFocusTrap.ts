import { useEffect, useRef, RefObject } from "react";

interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose: () => void;
}

// Global stack to keep track of active custom focus traps
const activeTraps: HTMLElement[] = [];

export function useFocusTrap<T extends HTMLElement>(
  options: UseFocusTrapOptions,
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!options.isOpen) return;

    // Save the element that had focus before opening the modal
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Add this container to the active traps stack
    activeTraps.push(container);

    // Find all focusable elements inside the modal container
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusableElements = (): HTMLElement[] => {
      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
    };

    // Focus the first focusable element when opened
    const focusables = getFocusableElements();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;

      // If document.activeElement is inside some other active trap, let that trap handle it
      if (activeEl) {
        const containingTrap = activeTraps.find(
          (trap) => trap !== container && trap.contains(activeEl),
        );
        if (containingTrap) return;
      }

      // Check if focus has been moved to a nested Radix component (like a portal dropdown/modal)
      if (activeEl && !container.contains(activeEl)) {
        // If focus is inside a Radix Dialog/Popover/Menu or focus guard, let it handle the event
        if (
          activeEl.closest('[role="dialog"]') ||
          activeEl.closest('[role="menu"]') ||
          activeEl.closest("[data-radix-focus-guard]")
        ) {
          return;
        }
      }

      // Handle Escape key
      if (event.key === "Escape") {
        options.onClose();
        return;
      }

      // Handle Tab key focus trapping
      if (event.key === "Tab") {
        const elements = getFocusableElements();
        if (elements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = elements[0];
        const lastElement = elements[elements.length - 1];

        if (event.shiftKey) {
          // Shift + Tab -> loop to last element if on first
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab -> loop to first element if on last
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      // Remove this container from the active traps stack
      const index = activeTraps.indexOf(container);
      if (index !== -1) {
        activeTraps.splice(index, 1);
      }

      // Restore focus to original element upon closing
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [options.isOpen, options.onClose]);

  return containerRef;
}
