import { describe, it, expect } from "vitest";
import {
  validateMergerProposal,
  deduplicateMergedRoster,
  buildMergerNotificationEmail,
  MemberRosterItem,
} from "./clubMergerWorkflow";

describe("Automated Club Merger Workflow Suite (#3705)", () => {
  const rosterA: MemberRosterItem[] = [
    { userId: "usr_alice", userEmail: "alice@uni.edu", clubId: "club_webdev", role: "PRESIDENT" },
    { userId: "usr_shared", userEmail: "shared@uni.edu", clubId: "club_webdev", role: "MEMBER" },
  ];

  const rosterB: MemberRosterItem[] = [
    { userId: "usr_bob", userEmail: "bob@uni.edu", clubId: "club_appdev", role: "PRESIDENT" },
    { userId: "usr_shared", userEmail: "shared@uni.edu", clubId: "club_appdev", role: "MEMBER" }, // Duplicate user
  ];

  it("validates merger proposals preventing self-merger or empty names", () => {
    expect(
      validateMergerProposal({
        sourceClubAId: "c1",
        sourceClubBId: "c1",
        newClubName: "Software Engineering Club",
        presidentAUserId: "usr_alice",
      }).isValid,
    ).toBe(false);

    expect(
      validateMergerProposal({
        sourceClubAId: "c1",
        sourceClubBId: "c2",
        newClubName: "Software Engineering Club",
        presidentAUserId: "usr_alice",
      }).isValid,
    ).toBe(true);
  });

  it("deduplicates members who belong to both source clubs during fusion", () => {
    const { uniqueRoster, uniqueEmails } = deduplicateMergedRoster(
      rosterA,
      rosterB,
      "club_softeng",
    );

    expect(uniqueRoster.length).toBe(3); // Alice, Bob, and 1 instance of Shared User
    expect(uniqueEmails).toEqual(["alice@uni.edu", "shared@uni.edu", "bob@uni.edu"]);
    expect(uniqueRoster.every((r) => r.clubId === "club_softeng")).toBe(true);
  });

  it("builds merger announcement email notifications for combined membership", () => {
    const email = buildMergerNotificationEmail(
      "alice@uni.edu",
      ["Web Dev Club", "App Dev Club"],
      "Software Engineering Club",
    );

    expect(email.subject).toContain("Software Engineering Club");
    expect(email.bodyHtml).toContain("Web Dev Club and App Dev Club");
  });
});
