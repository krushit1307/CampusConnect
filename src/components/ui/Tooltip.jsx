import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useInteractions,
} from "@floating-ui/react";

export default function Tooltip({ children, label, placement = "top" }) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    whileElementsMounted: autoUpdate, // Ensures it updates on scroll
    middleware: [offset(5), flip(), shift({ padding: 8 })],
  });

  // Handle hover and focus interactions
  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss]);

  return (
    <>
      {/* The element triggering the tooltip (e.g., a button) */}
      <div ref={refs.setReference} {...getReferenceProps()} style={{ display: "inline-block" }}>
        {children}
      </div>

      {/* The physically rendered tooltip inside a Portal */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={refs.setFloating}
              style={{ ...floatingStyles, zIndex: 9999 }} // Maximum z-index
              {...getFloatingProps()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              // Add any specific Tailwind or CSS classes your project uses here
              className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
