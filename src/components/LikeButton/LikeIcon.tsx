import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Sparks } from "./Sparks";

export function LikeIcon({ liked }: { liked: boolean }) {
  const reduceMotion = useReducedMotion();
  const [previousLiked, setPreviousLiked] = useState(liked);
  const [isExploding, setIsExploding] = useState(false);

  useEffect(() => {
    if (liked && !previousLiked && !reduceMotion) {
      setIsExploding(true);
      const timer = setTimeout(() => setIsExploding(false), 500);
      return () => clearTimeout(timer);
    }
    setPreviousLiked(liked);
  }, [liked, previousLiked, reduceMotion]);

  if (reduceMotion) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill={liked ? "#ef4444" : "none"}
        stroke={liked ? "#ef4444" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    );
  }

  const heartVariants = {
    liked: {
      scale: [1, 0.75, 1.25, 1],
      transition: {
        duration: 0.45,
        times: [0, 0.2, 0.6, 1],
      },
    },
    idle: {
      scale: 1,
    },
  };

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <motion.svg
        viewBox="0 0 24 24"
        variants={heartVariants}
        animate={isExploding ? "liked" : "idle"}
        stroke={liked ? "#ef4444" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full relative z-10"
        initial={false}
      >
        <motion.path
          d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
          animate={{
            fill: liked ? "#ef4444" : "transparent",
          }}
          transition={{ duration: 0.2 }}
        />
      </motion.svg>
      <AnimatePresence>{isExploding && <Sparks />}</AnimatePresence>
    </div>
  );
}
