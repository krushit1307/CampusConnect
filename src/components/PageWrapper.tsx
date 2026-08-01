import React, { useLayoutEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { pageTransitionTransition } from "@/lib/animations";

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const prefersReduced = useReducedMotion();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <motion.main
      id="main-content"
      tabIndex={-1}
      className="outline-none"
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
      transition={prefersReduced ? { duration: 0 } : pageTransitionTransition}
    >
      {children}
    </motion.main>
  );
}
