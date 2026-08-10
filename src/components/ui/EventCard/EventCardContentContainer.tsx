import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useEventCardContext } from "./EventCardContext";
import { microInteractionTransition } from "@/lib/animations";

export function EventCardContentContainer({ children }: { children?: ReactNode }) {
  const { event, cardBg } = useEventCardContext();
  const prefersReduced = useReducedMotion();

  return (
    <motion.article
      id={`event-${event.id}`}
      className={`neu-border p-5 relative ${cardBg}`}
      whileHover={prefersReduced ? undefined : { scale: 1.01 }}
      whileTap={prefersReduced ? undefined : { scale: 0.99 }}
      transition={microInteractionTransition}
    >
      {children}
    </motion.article>
  );
}
