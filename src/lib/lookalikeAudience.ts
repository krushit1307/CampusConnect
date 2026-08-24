export interface ClubMemberProfile {
  userId: string;
  major: string;
  graduationYear?: number;
  interestTags: string[];
}

export interface CandidateUser {
  userId: string;
  fullName: string;
  handle: string;
  avatarUrl?: string;
  major: string;
  graduationYear?: number;
  interestTags: string[];
  optOutTargetedMarketing?: boolean;
}

export interface LookalikeMatchResult {
  userId: string;
  fullName: string;
  handle: string;
  avatarUrl?: string;
  major: string;
  graduationYear?: number;
  similarityScore: number; // 0 to 100
  matchingReasons: string[];
}

export interface ClubCentroidProfile {
  topMajors: { major: string; percentage: number }[];
  topGraduationYears: number[];
  topInterestTags: { tag: string; count: number }[];
  activeMemberCount: number;
}

/**
 * Calculates the demographic and tag centroid of active club members (#3585).
 */
export function calculateClubCentroid(activeMembers: ClubMemberProfile[]): ClubCentroidProfile {
  if (!activeMembers || activeMembers.length === 0) {
    return {
      topMajors: [],
      topGraduationYears: [],
      topInterestTags: [],
      activeMemberCount: 0,
    };
  }

  const total = activeMembers.length;
  const majorCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();
  const tagCounts = new Map<string, number>();

  activeMembers.forEach((m) => {
    if (m.major) {
      const maj = m.major.trim();
      majorCounts.set(maj, (majorCounts.get(maj) || 0) + 1);
    }
    if (m.graduationYear) {
      yearCounts.set(m.graduationYear, (yearCounts.get(m.graduationYear) || 0) + 1);
    }
    if (m.interestTags) {
      m.interestTags.forEach((t) => {
        const tag = t.trim();
        if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    }
  });

  const topMajors = Array.from(majorCounts.entries())
    .map(([major, count]) => ({ major, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.percentage - a.percentage);

  const topGraduationYears = Array.from(yearCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([yr]) => yr);

  const topInterestTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return {
    topMajors,
    topGraduationYears,
    topInterestTags,
    activeMemberCount: total,
  };
}

/**
 * Calculates similarity score (0 to 100%) between a candidate user and club centroid (#3585).
 */
export function calculateUserSimilarity(
  candidate: CandidateUser,
  centroid: ClubCentroidProfile
): LookalikeMatchResult {
  const reasons: string[] = [];
  let score = 10; // Baseline base score

  // 1. Major Match (up to 40 points)
  const topMajor = centroid.topMajors[0]?.major;
  if (candidate.major && topMajor) {
    if (candidate.major.toLowerCase().trim() === topMajor.toLowerCase().trim()) {
      score += 40;
      reasons.push(`Matches primary club major (${candidate.major})`);
    } else if (centroid.topMajors.some((m) => m.major.toLowerCase() === candidate.major.toLowerCase())) {
      score += 25;
      reasons.push(`Matches active member major (${candidate.major})`);
    }
  }

  // 2. Graduation Year Match / Proximity (up to 20 points)
  if (candidate.graduationYear && centroid.topGraduationYears.length > 0) {
    const targetYr = centroid.topGraduationYears[0];
    const diff = Math.abs(candidate.graduationYear - targetYr);
    if (diff === 0) {
      score += 20;
      reasons.push(`Same target class year ('${candidate.graduationYear})`);
    } else if (diff === 1) {
      score += 10;
      reasons.push(`Close class year ('${candidate.graduationYear})`);
    }
  }

  // 3. Interest Tag Overlap (up to 30 points)
  const centroidTags = new Set(centroid.topInterestTags.slice(0, 10).map((t) => t.tag.toLowerCase()));
  const candidateTags = candidate.interestTags || [];
  const sharedTags = candidateTags.filter((t) => centroidTags.has(t.toLowerCase()));

  if (sharedTags.length > 0) {
    const tagPoints = Math.min(30, sharedTags.length * 10);
    score += tagPoints;
    reasons.push(`Shared interests: ${sharedTags.slice(0, 3).join(", ")}`);
  }

  const finalScore = Math.min(100, Math.max(10, score));

  return {
    userId: candidate.userId,
    fullName: candidate.fullName,
    handle: candidate.handle,
    avatarUrl: candidate.avatarUrl,
    major: candidate.major,
    graduationYear: candidate.graduationYear,
    similarityScore: finalScore,
    matchingReasons: reasons.length > 0 ? reasons : ["Cross-campus demographic match"],
  };
}

/**
 * Generates ranked lookalike audience while strictly respecting privacy opt-outs (#3585).
 */
export function generateLookalikeAudience(
  activeMembers: ClubMemberProfile[],
  candidates: CandidateUser[],
  existingMemberIds: Set<string> = new Set(),
  limit: number = 20
): { matches: LookalikeMatchResult[]; optOutCount: number } {
  const centroid = calculateClubCentroid(activeMembers);

  let optOutCount = 0;
  const eligibleCandidates = candidates.filter((c) => {
    if (existingMemberIds.has(c.userId)) return false;
    if (c.optOutTargetedMarketing) {
      optOutCount++;
      return false;
    }
    return true;
  });

  const matches = eligibleCandidates
    .map((c) => calculateUserSimilarity(c, centroid))
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);

  return {
    matches,
    optOutCount,
  };
}
