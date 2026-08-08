import { motion, type MotionValue } from "framer-motion";

interface HeroMidgroundProps {
  y: MotionValue<number> | number;
}

export function HeroMidground({ y }: HeroMidgroundProps) {
  return (
    <motion.div
      style={{ y }}
      className="absolute inset-0 z-[1] pointer-events-none"
      aria-hidden="true"
    >
      <svg viewBox="0 0 1440 500" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
        <defs>
          <linearGradient id="buildingFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a4b6e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1a4b6e" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="treeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d5a27" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1a3a15" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <g opacity="0.25">
          <rect x="100" y="300" width="100" height="200" rx="4" fill="url(#buildingFront)" />
          <rect x="110" y="320" width="12" height="16" rx="2" fill="#f5c66b" opacity="0.3" />
          <rect x="130" y="320" width="12" height="16" rx="2" fill="#f5c66b" opacity="0.2" />
          <rect x="150" y="320" width="12" height="16" rx="2" fill="#f5c66b" opacity="0.3" />
          <rect x="170" y="320" width="12" height="16" rx="2" fill="#f5c66b" opacity="0.2" />
          <rect x="110" y="350" width="12" height="16" rx="2" fill="#f5c66b" opacity="0.4" />
          <rect x="130" y="350" width="12" height="16" rx="2" fill="#f5c66b" opacity="0.2" />
          <rect x="150" y="350" width="12" height="16" rx="2" fill="#f5c66b" opacity="0.3" />
          <rect x="170" y="350" width="12" height="16" rx="2" fill="#f5c66b" opacity="0.5" />
        </g>
        <g opacity="0.25">
          <rect x="350" y="280" width="120" height="220" rx="4" fill="url(#buildingFront)" />
          <rect x="360" y="300" width="14" height="16" rx="2" fill="#f5c66b" opacity="0.3" />
          <rect x="382" y="300" width="14" height="16" rx="2" fill="#f5c66b" opacity="0.5" />
          <rect x="404" y="300" width="14" height="16" rx="2" fill="#f5c66b" opacity="0.2" />
          <rect x="426" y="300" width="14" height="16" rx="2" fill="#f5c66b" opacity="0.4" />
          <rect x="360" y="330" width="14" height="16" rx="2" fill="#f5c66b" opacity="0.4" />
          <rect x="382" y="330" width="14" height="16" rx="2" fill="#f5c66b" opacity="0.2" />
          <rect x="404" y="330" width="14" height="16" rx="2" fill="#f5c66b" opacity="0.5" />
          <rect x="426" y="330" width="14" height="16" rx="2" fill="#f5c66b" opacity="0.3" />
        </g>
        <g opacity="0.2">
          <rect x="600" y="310" width="80" height="190" rx="4" fill="url(#buildingFront)" />
          <rect x="620" y="330" width="10" height="14" rx="2" fill="#f5c66b" opacity="0.3" />
          <rect x="640" y="330" width="10" height="14" rx="2" fill="#f5c66b" opacity="0.5" />
          <rect x="660" y="330" width="10" height="14" rx="2" fill="#f5c66b" opacity="0.2" />
        </g>
        <g opacity="0.2">
          <rect x="900" y="290" width="90" height="210" rx="4" fill="url(#buildingFront)" />
          <rect x="915" y="310" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.4" />
          <rect x="935" y="310" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.2" />
          <rect x="955" y="310" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.5" />
          <rect x="915" y="340" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.3" />
          <rect x="935" y="340" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.4" />
          <rect x="955" y="340" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.2" />
        </g>
        <g opacity="0.3">
          <rect x="1150" y="320" width="100" height="180" rx="4" fill="url(#buildingFront)" />
          <rect x="1162" y="340" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.3" />
          <rect x="1182" y="340" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.5" />
          <rect x="1202" y="340" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.2" />
          <rect x="1222" y="340" width="12" height="14" rx="2" fill="#f5c66b" opacity="0.4" />
        </g>
        <g opacity="0.3">
          <circle cx="280" cy="380" r="30" fill="url(#treeGrad)" />
          <circle cx="320" cy="360" r="35" fill="url(#treeGrad)" />
          <circle cx="550" cy="370" r="28" fill="url(#treeGrad)" />
          <circle cx="850" cy="380" r="32" fill="url(#treeGrad)" />
          <circle cx="1080" cy="360" r="30" fill="url(#treeGrad)" />
          <circle cx="1350" cy="380" r="35" fill="url(#treeGrad)" />
        </g>
      </svg>
    </motion.div>
  );
}
