import { describe, it, expect } from "vitest";
import {
  evaluateMemberForPromotion,
  analyzeClubRolePromotions,
  buildPresidentNotificationPayload,
  HEURISTIC_THRESHOLDS,
  MemberActivityLedger,
} from "./rolePromotionEngine";

describe("Implement Dynamic Role Promotion Logic Suite (#3878)", () => {
  const activeVolunteer: MemberActivityLedger = {
    userId: "usr_alex",
    userName: "Alex Rivera",
    userEmail: "alex@university.edu",
    clubId: "club_tech",
    currentRole: "member",
    eventsAttendedLast90Days: 6,
    microTasksCompletedCount: 4,
  };

  const casualMember: MemberActivityLedger = {
    userId: "usr_sam",
    userName: "Sam Lee",
    userEmail: "sam@university.edu",
    clubId: "club_tech",
    currentRole: "member",
    eventsAttendedLast90Days: 2,
    microTasksCompletedCount: 1,
  };

  const existingCommitteeMember: MemberActivityLedger = {
    userId: "usr_taylor",
    userName: "Taylor Swift",
    userEmail: "taylor@university.edu",
    clubId: "club_tech",
    currentRole: "committee",
    eventsAttendedLast90Days: 10,
    microTasksCompletedCount: 8,
  };

  it("identifies members who exceed event check-in or micro-task thresholds", () => {
    const suggestion = evaluateMemberForPromotion(activeVolunteer);

    expect(suggestion).not.toBeNull();
    expect(suggestion?.isEligible).toBe(true);
    expect(suggestion?.suggestedRole).toBe("committee");
    expect(suggestion?.recommendationReason).toContain("Checked in to 6 club events");
    expect(suggestion?.recommendationReason).toContain("completed 4 micro-volunteering tasks");
  });

  it("ignores casual members below heuristic thresholds and existing officers/committee", () => {
    expect(evaluateMemberForPromotion(casualMember)).toBeNull();
    expect(evaluateMemberForPromotion(existingCommitteeMember)).toBeNull();
  });

  it("analyzes club ledger in batch and returns valid promotion suggestions", () => {
    const list = [activeVolunteer, casualMember, existingCommitteeMember];
    const results = analyzeClubRolePromotions(list);

    expect(results.length).toBe(1);
    expect(results[0].userId).toBe("usr_alex");
  });

  it("builds actionable notification payloads for club leadership with 1-click promotion link", () => {
    const suggestion = evaluateMemberForPromotion(activeVolunteer)!;
    const notification = buildPresidentNotificationPayload(suggestion);

    expect(notification.title).toBe("Role Promotion Suggestion: Alex Rivera");
    expect(notification.body).toContain("Alex Rivera has been highly active!");
    expect(notification.actionUrl).toBe("/dashboard/clubs/club_tech/promotions");
  });
});
