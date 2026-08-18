import React from "react";
import { getMemberTier, getAvatarTierClasses, MemberTierId } from "@/lib/memberTiers";
import { cn } from "@/lib/utils";

export interface MemberTierAvatarProps {
  src?: string | null;
  alt?: string;
  points?: number;
  tierId?: MemberTierId;
  size?: "sm" | "md" | "lg" | "xl";
  showBadgeOverlay?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-lg",
  xl: "w-24 h-24 text-2xl",
};

/**
 * Avatar Wrapper with Dynamic Member Tier Borders & Visual Flair (#3461).
 * Renders shiny gold CSS gradient border for Gold tier and shimmering aura for Platinum tier.
 */
export const MemberTierAvatar: React.FC<MemberTierAvatarProps> = ({
  src,
  alt = "User Avatar",
  points = 0,
  tierId,
  size = "md",
  showBadgeOverlay = false,
  className,
}) => {
  const tier = tierId
    ? getMemberTier(tierId === "bronze" ? 0 : tierId === "silver" ? 500 : tierId === "gold" ? 1500 : 3500)
    : getMemberTier(points);

  const borderClass = getAvatarTierClasses(tier.id);
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  const fallbackInitial = alt ? alt.charAt(0).toUpperCase() : "U";

  return (
    <div className="relative inline-block select-none" data-testid="member-tier-avatar-wrapper">
      {/* Tier Flair Border Ring */}
      <div
        className={cn(
          "rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden",
          borderClass,
          sizeClass,
          className
        )}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full bg-slate-800 text-white font-bold flex items-center justify-center rounded-full">
            {fallbackInitial}
          </div>
        )}
      </div>

      {/* Floating Tier Badge Icon Overlay */}
      {showBadgeOverlay && (
        <span
          title={tier.badge}
          className="absolute -bottom-1 -right-1 bg-black/90 border border-white/40 text-[10px] rounded-full p-0.5 shadow-md leading-none"
        >
          {tier.id === "platinum" ? "💎" : tier.id === "gold" ? "🥇" : tier.id === "silver" ? "🥈" : "🥉"}
        </span>
      )}
    </div>
  );
};
