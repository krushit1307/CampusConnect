import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { pageTransitionTransition } from "@/lib/animations";

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.main
      id="main-content"
      tabIndex={-1}
      className="outline-none"
      initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -15 }}
      transition={pageTransitionTransition}
    >
      {children}
    </motion.main>
  );
}
