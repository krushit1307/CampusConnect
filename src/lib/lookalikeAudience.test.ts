import { describe, it, expect } from "vitest";
import {
  calculateClubCentroid,
  calculateUserSimilarity,
  generateLookalikeAudience,
  ClubMemberProfile,
  CandidateUser,
} from "./lookalikeAudience";

describe("Lookalike Audience Marketing Engine Utility (#3585)", () => {
  const activeMembers: ClubMemberProfile[] = [
    { userId: "m1", major: "Computer Science", graduationYear: 2026, interestTags: ["React", "AI", "Hackathon"] },
    { userId: "m2", major: "Computer Science", graduationYear: 2026, interestTags: ["AI", "Python", "Web"] },
    { userId: "m3", major: "Data Science", graduationYear: 2027, interestTags: ["AI", "React"] },
  ];

  const candidates: CandidateUser[] = [
    {
      userId: "cand-1",
      fullName: "Alex Rivera",
      handle: "alex_r",
      major: "Computer Science",
      graduationYear: 2026,
      interestTags: ["React", "AI"],
      optOutTargetedMarketing: false,
    },
    {
      userId: "cand-2",
      fullName: "Sam Chen",
      handle: "sam_chen",
      major: "Electrical Engineering",
      graduationYear: 2028,
      interestTags: ["Robotics"],
      optOutTargetedMarketing: false,
    },
    {
      userId: "cand-private",
      fullName: "Taylor Private",
      handle: "taylor_p",
      major: "Computer Science",
      graduationYear: 2026,
      interestTags: ["React", "AI"],
      optOutTargetedMarketing: true, // Opted out of targeted marketing
    },
  ];

  it("calculates demographic centroid from active members", () => {
    const centroid = calculateClubCentroid(activeMembers);

    expect(centroid.activeMemberCount).toBe(3);
    expect(centroid.topMajors[0].major).toBe("Computer Science");
    expect(centroid.topMajors[0].percentage).toBe(67); // 2 out of 3 = 67%
    expect(centroid.topInterestTags[0].tag).toBe("AI");
  });

  it("calculates similarity score for candidate users based on major and tags", () => {
    const centroid = calculateClubCentroid(activeMembers);
    const match = calculateUserSimilarity(candidates[0], centroid);

    expect(match.similarityScore).toBeGreaterThanOrEqual(80);
    expect(match.matchingReasons).toContain("Matches primary club major (Computer Science)");
  });

  it("strictly filters out users with optOutTargetedMarketing enabled", () => {
    const existingMemberIds = new Set<string>(["m1", "m2", "m3"]);
    const result = generateLookalikeAudience(activeMembers, candidates, existingMemberIds);

    expect(result.optOutCount).toBe(1);
    expect(result.matches).toHaveLength(2); // cand-1 & cand-2
    expect(result.matches.some((m) => m.userId === "cand-private")).toBe(false);
  });

  it("ranks lookalike candidates by similarity score", () => {
    const existingMemberIds = new Set<string>();
    const result = generateLookalikeAudience(activeMembers, candidates, existingMemberIds);

    expect(result.matches[0].userId).toBe("cand-1"); // Alex (CS major + React/AI) > Sam (EE)
    expect(result.matches[0].similarityScore).toBeGreaterThan(result.matches[1].similarityScore);
  });
});
