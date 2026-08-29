import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  TIER_META,
  CATEGORY_META,
  type Achievement,
  type AchievementStatus,
} from "@/types/achievements";

interface BadgeCardProps {
  achievement: Achievement;
  onSelect: (id: string) => void;
}

export function BadgeCard({ achievement, onSelect }: BadgeCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const tierMeta = TIER_META[achievement.tier];
  const catMeta = CATEGORY_META[achievement.category];

  const statusColor: Record<AchievementStatus, string> = {
    unlocked: "border-emerald-400 shadow-emerald-100",
    in_progress: "border-amber-300 shadow-amber-100",
    locked: "border-gray-200 shadow-gray-50",
  };

  const isLocked = achievement.status === "locked";

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(achievement.id)}
      className={cn(
        "relative rounded-2xl border-2 bg-white p-4 cursor-pointer transition-shadow duration-200",
        "hover:shadow-lg",
        statusColor[achievement.status],
        isLocked && "opacity-60 grayscale-[40%]",
      )}
    >
      {/* Tier badge top-right */}
      <div className="absolute top-3 right-3">
        <span className="text-lg" title={tierMeta.label}>
          {tierMeta.icon}
        </span>
      </div>

      {/* Emoji icon */}
      <div
        className={cn(
          "h-14 w-14 rounded-xl flex items-center justify-center text-3xl mb-3",
          isLocked ? "bg-gray-100" : tierMeta.bgClass,
        )}
      >
        {isLocked ? "🔒" : achievement.icon_emoji}
      </div>

      {/* Name + Category */}
      <h3 className="font-bold text-sm text-gray-900 line-clamp-1 mb-1 pr-6">{achievement.name}</h3>
      <Badge variant="secondary" className={cn("text-[9px] font-semibold mb-2", catMeta.bgClass)}>
        {catMeta.icon} {catMeta.label}
      </Badge>

      {/* Description */}
      <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
        {achievement.description}
      </p>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono mb-1">
          <span>
            {achievement.requirement_current}/{achievement.requirement_total}
          </span>
          <span>{achievement.progress_pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${achievement.progress_pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              achievement.status === "unlocked"
                ? "bg-emerald-500"
                : achievement.status === "in_progress"
                  ? "bg-amber-400"
                  : "bg-gray-300",
            )}
          />
        </div>
      </div>

      {/* Points + rarity */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
        <span className="font-bold text-indigo-600">{achievement.points} pts</span>
        <span>{achievement.rarity_pct}% rarity</span>
      </div>

      {/* Unlocked checkmark overlay */}
      {achievement.status === "unlocked" && (
        <div className="absolute -top-1.5 -left-1.5 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
          <svg
            className="h-3.5 w-3.5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </motion.div>
  );
}
