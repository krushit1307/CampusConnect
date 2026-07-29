import { motion } from "framer-motion";

export function Sparks() {
  const sparkColors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
  
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {[...Array(6)].map((_, i) => {
        // Calculate radial positions (6 sparks in a circle)
        const angle = (i * 60 * Math.PI) / 180;
        const radius = 24; // Distance from center
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <motion.div
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: sparkColors[i] }}
            initial={{
              x: 0,
              y: 0,
              scale: 0,
              opacity: 1,
            }}
            animate={{
              x,
              y,
              scale: 1,
              opacity: 0,
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
}
