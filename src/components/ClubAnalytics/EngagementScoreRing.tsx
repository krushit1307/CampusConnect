import { useEffect, useState } from "react";

interface EngagementScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export function EngagementScoreRing({
  score,
  size = 140,
  strokeWidth = 12,
}: EngagementScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 800;
    const startTime = Date.now();
    const start = animatedScore;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(start + (score - start) * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 70) return "#a3e635";
    if (s >= 40) return "#facc15";
    return "#f87171";
  };

  const getLabel = (s: number) => {
    if (s >= 70) return "Excellent";
    if (s >= 40) return "Good";
    return "Needs Work";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getColor(animatedScore)}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-black text-black">
            {Math.round(animatedScore)}
          </span>
          <span className="font-mono text-[10px] font-bold uppercase text-gray-500">/ 100</span>
        </div>
      </div>
      <span
        className="neu-border px-3 py-1 font-mono text-xs font-bold uppercase"
        style={{ backgroundColor: getColor(score) + "33" }}
      >
        {getLabel(score)}
      </span>
    </div>
  );
}
