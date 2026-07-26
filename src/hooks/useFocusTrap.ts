import { useEffect, useRef, RefObject } from "react";

interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose: () => void;
}

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
      // Restore focus to original element upon closing
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [options.isOpen, options.onClose]);

  return containerRef;
}
