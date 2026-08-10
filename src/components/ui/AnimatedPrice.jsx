import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// 1. The individual rolling digit column
function RollingDigit({ value }) {
  return (
    <div className="relative h-[1em] w-[0.6em] overflow-hidden leading-none tabular-nums">
      <motion.div
        initial={false}
        animate={{ y: `-${value * 10}%` }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="absolute inset-x-0 top-0 flex flex-col"
      >
        {/* Render the vertical column of numbers 0-9 */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <span key={num} className="flex h-[1em] items-center justify-center">
            {num}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// 2. The main wrapper component
export default function AnimatedPrice({ price }) {
  // Track the max number of digits to prevent array lengths from shrinking and breaking the layout
  const [paddedLength, setPaddedLength] = useState(price.toString().length);

  useEffect(() => {
    if (price.toString().length > paddedLength) {
      setPaddedLength(price.toString().length);
    }
  }, [price, paddedLength]);

  // Pad the price string with leading zeros to match our max observed length
  const priceStr = price.toString().padStart(paddedLength, "0");

  return (
    <div className="flex items-center text-4xl font-bold">
      <span className="mr-1">$</span>
      <div className="flex">
        {priceStr.split("").map((char, index) => {
          // Identify if this specific digit is a padding zero that should remain hidden
          const isPaddingZero = index < paddedLength - price.toString().length;

          return (
            <motion.div
              key={paddedLength - index} // Key based on place value (1s, 10s, 100s) for stable math
              initial={false}
              animate={{
                width: isPaddingZero ? 0 : "auto",
                opacity: isPaddingZero ? 0 : 1,
              }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
              className="overflow-hidden"
            >
              <RollingDigit value={parseInt(char, 10)} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
