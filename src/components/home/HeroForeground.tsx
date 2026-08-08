import { motion, type MotionValue } from "framer-motion";

interface HeroForegroundProps {
  y: MotionValue<number> | number;
}

export function HeroForeground({ y }: HeroForegroundProps) {
  return (
    <motion.div
      style={{ y }}
      className="absolute inset-0 z-[2] pointer-events-none"
      aria-hidden="true"
    >
      <svg viewBox="0 0 1440 500" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
        <defs>
          <linearGradient id="fgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1f2e" stopOpacity="0" />
            <stop offset="70%" stopColor="#0a1f2e" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0a1f2e" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <rect width="1440" height="500" fill="url(#fgGrad)" />
        <g opacity="0.35">
          <path
            d="M0 460 Q50 440 100 450 Q150 430 200 445 Q250 425 300 440 Q350 420 400 435 Q450 415 500 430 Q550 410 600 425 Q650 405 700 420 Q750 400 800 415 Q850 395 900 410 Q950 390 1000 405 Q1050 385 1100 400 Q1150 380 1200 395 Q1250 375 1300 390 Q1350 370 1400 385 L1440 370 L1440 500 L0 500 Z"
            fill="#061520"
          />
          <path
            d="M0 470 Q60 455 120 465 Q180 450 240 460 Q300 445 360 455 Q420 440 480 450 Q540 435 600 445 Q660 430 720 440 Q780 425 840 435 Q900 420 960 430 Q1020 415 1080 425 Q1140 410 1200 420 Q1260 405 1320 415 Q1380 400 1440 410 L1440 500 L0 500 Z"
            fill="#040f18"
          />
        </g>
        <g opacity="0.2">
          <path
            d="M100 500 C120 460 140 440 160 460 C170 470 180 490 190 500"
            fill="none"
            stroke="#2d5a27"
            strokeWidth="3"
          />
          <path
            d="M300 500 C310 470 325 450 340 470 C350 480 360 495 365 500"
            fill="none"
            stroke="#2d5a27"
            strokeWidth="3"
          />
          <path
            d="M700 500 C715 465 730 445 745 465 C755 475 765 490 770 500"
            fill="none"
            stroke="#2d5a27"
            strokeWidth="3"
          />
          <path
            d="M1050 500 C1065 475 1080 455 1095 470 C1105 480 1115 495 1120 500"
            fill="none"
            stroke="#2d5a27"
            strokeWidth="3"
          />
          <path
            d="M1250 500 C1260 480 1270 465 1280 480 C1290 490 1295 500 1300 500"
            fill="none"
            stroke="#2d5a27"
            strokeWidth="3"
          />
        </g>
        <g opacity="0.15">
          <rect x="480" y="440" width="6" height="60" rx="3" fill="#f5c66b" />
          <rect x="479" y="430" width="8" height="14" rx="4" fill="#f5c66b" />
          <circle cx="483" cy="426" r="5" fill="#f5c66b" opacity="0.6" />
          <rect x="960" y="445" width="6" height="55" rx="3" fill="#f5c66b" />
          <rect x="959" y="435" width="8" height="14" rx="4" fill="#f5c66b" />
          <circle cx="963" cy="431" r="5" fill="#f5c66b" opacity="0.6" />
        </g>
      </svg>
    </motion.div>
  );
}
