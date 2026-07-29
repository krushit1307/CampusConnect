import { motion, type MotionValue } from "framer-motion";

interface HeroBackgroundProps {
  y: MotionValue<number> | number;
}

export function HeroBackground({ y }: HeroBackgroundProps) {
  return (
    <motion.div
      style={{ y }}
      className="absolute inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    >
      <svg viewBox="0 0 1440 500" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
        <defs>
          <linearGradient id="heroBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#123a57" />
            <stop offset="60%" stopColor="#1c4b6e" />
            <stop offset="100%" stopColor="#0e293e" />
          </linearGradient>
          <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect width="1440" height="500" fill="url(#heroBg)" />
        <g opacity="0.12">
          <ellipse cx="200" cy="120" rx="180" ry="40" fill="url(#cloudGrad)" />
          <ellipse cx="600" cy="90" rx="220" ry="35" fill="url(#cloudGrad)" />
          <ellipse cx="1100" cy="140" rx="160" ry="30" fill="url(#cloudGrad)" />
          <ellipse cx="1400" cy="100" rx="200" ry="38" fill="url(#cloudGrad)" />
        </g>
        <g opacity="0.08">
          <rect x="80" y="280" width="60" height="220" rx="2" />
          <rect x="160" y="260" width="50" height="240" rx="2" />
          <rect x="230" y="300" width="40" height="200" rx="2" />
          <rect x="340" y="270" width="70" height="230" rx="2" />
          <rect x="500" y="250" width="45" height="250" rx="2" />
          <rect x="580" y="290" width="55" height="210" rx="2" />
          <rect x="680" y="260" width="65" height="240" rx="2" />
          <rect x="820" y="280" width="50" height="220" rx="2" />
          <rect x="950" y="250" width="60" height="250" rx="2" />
          <rect x="1050" y="300" width="40" height="200" rx="2" />
          <rect x="1150" y="270" width="55" height="230" rx="2" />
          <rect x="1280" y="260" width="60" height="240" rx="2" />
        </g>
      </svg>
    </motion.div>
  );
}
