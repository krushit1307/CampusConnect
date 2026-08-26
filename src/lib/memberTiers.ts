export type MemberTierId = "bronze" | "silver" | "gold" | "platinum";

export interface MemberTierConfig {
  id: MemberTierId;
  name: string;
  badge: string;
  minPoints: number;
  maxPoints: number | null;
  color: string;
  badgeBg: string;
  avatarBorderClass: string;
  perks: string[];
}

export const MEMBER_TIERS: MemberTierConfig[] = [
  {
    id: "bronze",
    name: "Bronze",
    badge: "Bronze Member 🥉",
    minPoints: 0,
    maxPoints: 499,
    color: "#b45309",
    badgeBg: "bg-amber-100 text-amber-900 border-amber-500",
    avatarBorderClass: "border-2 border-amber-700/60 shadow-sm",
    perks: ["Access to public club events", "Standard forum badges"],
  },
  {
    id: "silver",
    name: "Silver",
    badge: "Silver Member 🥈",
    minPoints: 500,
    maxPoints: 1499,
    color: "#64748b",
    badgeBg: "bg-slate-200 text-slate-900 border-slate-400",
    avatarBorderClass: "border-2 border-slate-400 shadow-md ring-2 ring-slate-200",
    perks: ["Silver profile badge", "Priority RSVP access", "1.2x Gamification Point Multiplier"],
  },
  {
    id: "gold",
    name: "Gold",
    badge: "Gold Member 🥇",
    minPoints: 1500,
    maxPoints: 3499,
    color: "#d97706",
    badgeBg: "bg-gradient-to-r from-amber-400 to-yellow-500 text-black border-amber-600 font-bold",
    avatarBorderClass:
      "border-2 border-amber-400 ring-4 ring-amber-300/60 shadow-[0_0_12px_rgba(245,158,11,0.6)] bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 p-[2px]",
    perks: [
      "Shiny Gold Avatar Border everywhere",
      "VIP Event Access",
      "Gold Forum Flair",
      "1.5x Gamification Point Multiplier",
    ],
  },
  {
    id: "platinum",
    name: "Platinum",
    badge: "Platinum Member 💎",
    minPoints: 3500,
    maxPoints: null,
    color: "#0284c7",
    badgeBg: "bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-500 text-black border-cyan-400 font-bold animate-pulse",
    avatarBorderClass:
      "border-2 border-cyan-300 ring-4 ring-sky-400/80 shadow-[0_0_18px_rgba(56,189,248,0.8)] animate-pulse bg-gradient-to-r from-sky-400 via-cyan-200 to-indigo-400 p-[2px]",
    perks: [
      "Platinum Shimmering Avatar Aura everywhere",
      "Exclusive Alumni Job Referrals",
      "Executive Council Voting Rights",
      "2x Gamification Point Multiplier",
    ],
  },
];

/**
 * Resolves user's status tier config based on total points (#3461).
 */
export function getMemberTier(points: number): MemberTierConfig {
  const safePoints = Math.max(0, points || 0);

  for (let i = MEMBER_TIERS.length - 1; i >= 0; i--) {
    if (safePoints >= MEMBER_TIERS[i].minPoints) {
      return MEMBER_TIERS[i];
    }
  }

  return MEMBER_TIERS[0];
}

/**
 * Calculates progress details towards the next status tier (#3461).
 * E.g., at 1450 points: 50 points remaining until Gold Tier at 1500 points.
 */
export function getNextTierProgress(points: number): {
  currentTier: MemberTierConfig;
  nextTier: MemberTierConfig | null;
  pointsNeeded: number;
  pointsRemaining: number;
  progressPercent: number;
} {
  const safePoints = Math.max(0, points || 0);
  const currentTier = getMemberTier(safePoints);

  const currentIndex = MEMBER_TIERS.findIndex((t) => t.id === currentTier.id);
  const nextTier = currentIndex < MEMBER_TIERS.length - 1 ? MEMBER_TIERS[currentIndex + 1] : null;

  if (!nextTier) {
    // Max tier reached (Platinum)
    return {
      currentTier,
      nextTier: null,
      pointsNeeded: 0,
      pointsRemaining: 0,
      progressPercent: 100,
    };
  }

  const range = nextTier.minPoints - currentTier.minPoints;
  const currentProgress = safePoints - currentTier.minPoints;
  const pointsRemaining = Math.max(0, nextTier.minPoints - safePoints);
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100)));

  return {
    currentTier,
    nextTier,
    pointsNeeded: nextTier.minPoints,
    pointsRemaining,
    progressPercent,
  };
}

/**
 * Returns dynamic CSS classes for rendering avatar tier borders & flair (#3461).
 */
export function getAvatarTierClasses(pointsOrTier: number | MemberTierId): string {
  const tier = typeof pointsOrTier === "number" ? getMemberTier(pointsOrTier) : MEMBER_TIERS.find((t) => t.id === pointsOrTier) || MEMBER_TIERS[0];
  return tier.avatarBorderClass;
}
