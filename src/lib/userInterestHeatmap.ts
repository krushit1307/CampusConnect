export interface AttendedTagDistribution {
  tag: string;
  count: number;
  percentage: number;
  colorHex: string;
  bgClass: string;
  fontSizeClass: string;
}

export interface UserInterestHeatmapResult {
  userId?: string;
  isPrivate: boolean;
  totalAttendedEvents: number;
  distribution: AttendedTagDistribution[];
  topCategories: { category: string; percentage: number }[];
}

/**
 * Returns dynamic color tokens based on tag category (#3546).
 */
export function getInterestBadgeColor(tag: string): { colorHex: string; bgClass: string } {
  const clean = (tag || "").toLowerCase().trim();

  if (clean.includes("tech") || clean.includes("code") || clean.includes("ai") || clean.includes("react") || clean.includes("hackathon")) {
    return { colorHex: "#4f46e5", bgClass: "bg-indigo-100 text-indigo-950 border-indigo-400" };
  }
  if (clean.includes("art") || clean.includes("music") || clean.includes("design") || clean.includes("creative") || clean.includes("photo")) {
    return { colorHex: "#d946ef", bgClass: "bg-fuchsia-100 text-fuchsia-950 border-fuchsia-400" };
  }
  if (clean.includes("sport") || clean.includes("fitness") || clean.includes("run") || clean.includes("game") || clean.includes("outdoor")) {
    return { colorHex: "#10b981", bgClass: "bg-emerald-100 text-emerald-950 border-emerald-400" };
  }
  if (clean.includes("finance") || clean.includes("business") || clean.includes("crypto") || clean.includes("career") || clean.includes("invest")) {
    return { colorHex: "#d97706", bgClass: "bg-amber-100 text-amber-950 border-amber-400" };
  }

  // Default social / networking
  return { colorHex: "#8b5cf6", bgClass: "bg-purple-100 text-purple-950 border-purple-400" };
}

/**
 * Calculates dynamic Tag Cloud font scale based on attendance percentage (#3546).
 */
export function getInterestHeatmapTagCloudScale(percentage: number): string {
  if (percentage >= 35) return "text-xl font-black";
  if (percentage >= 20) return "text-base font-bold";
  if (percentage >= 10) return "text-xs font-bold";
  return "text-[11px] font-medium";
}

/**
 * Calculates tag frequency distribution from attended events (#3546).
 * Translates raw attendance records into an interest distribution (e.g. Tech: 40%, Art: 30%, Sports: 30%).
 */
export function calculateInterestDistribution(
  rawTags: string[],
  isPrivate: boolean = false,
  totalEvents: number = 0
): UserInterestHeatmapResult {
  if (isPrivate || !rawTags || rawTags.length === 0) {
    return {
      isPrivate: Boolean(isPrivate),
      totalAttendedEvents: totalEvents,
      distribution: [],
      topCategories: [],
    };
  }

  const tagCounts = new Map<string, number>();
  rawTags.forEach((t) => {
    const norm = t.trim();
    if (norm) {
      tagCounts.set(norm, (tagCounts.get(norm) || 0) + 1);
    }
  });

  const totalTagInstances = rawTags.length;
  const distribution: AttendedTagDistribution[] = Array.from(tagCounts.entries())
    .map(([tag, count]) => {
      const percentage = Number(((count / totalTagInstances) * 100).toFixed(1));
      const { colorHex, bgClass } = getInterestBadgeColor(tag);
      const fontSizeClass = getInterestHeatmapTagCloudScale(percentage);

      return {
        tag,
        count,
        percentage,
        colorHex,
        bgClass,
        fontSizeClass,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Group into high-level categories
  const categoryMap = new Map<string, number>();
  distribution.forEach((item) => {
    let cat = "Other";
    const t = item.tag.toLowerCase();
    if (t.includes("tech") || t.includes("code") || t.includes("ai") || t.includes("react")) cat = "Tech & Engineering";
    else if (t.includes("art") || t.includes("music") || t.includes("design")) cat = "Art & Creative";
    else if (t.includes("sport") || t.includes("fitness")) cat = "Sports & Athletics";
    else if (t.includes("finance") || t.includes("business") || t.includes("career")) cat = "Business & Finance";
    else cat = "Social & Culture";

    categoryMap.set(cat, (categoryMap.get(cat) || 0) + item.percentage);
  });

  const topCategories = Array.from(categoryMap.entries())
    .map(([category, percentage]) => ({ category, percentage: Math.round(percentage) }))
    .sort((a, b) => b.percentage - a.percentage);

  return {
    isPrivate: false,
    totalAttendedEvents: totalEvents || distribution.reduce((sum, d) => sum + d.count, 0),
    distribution,
    topCategories,
  };
}
