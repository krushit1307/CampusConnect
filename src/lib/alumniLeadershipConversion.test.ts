import { describe, it, expect } from "vitest";
import {
  isExecutiveRoleEligibleForConversion,
  convertLeaderToAlumniMentor,
  GraduatingLeaderProfile,
} from "./alumniLeadershipConversion";

describe("Implement Automated Club Leadership Alumni Conversion Suite (#4504)", () => {
  const graduatingPresident: GraduatingLeaderProfile = {
    userId: "usr_pres_101",
    userName: "Sarah Jenkins",
    userEmail: "sarah@university.edu",
    clubId: "club_cs_society",
    clubName: "Computer Science Society",
    executiveRole: "President",
    graduationYear: 2026,
  };

  it("identifies executive roles eligible for alumni conversion", () => {
    expect(isExecutiveRoleEligibleForConversion("President")).toBe(true);
    expect(isExecutiveRoleEligibleForConversion("Admin")).toBe(true);
    expect(isExecutiveRoleEligibleForConversion("Treasurer")).toBe(true);
    expect(isExecutiveRoleEligibleForConversion("member")).toBe(false);
  });

  it("converts graduating president into Alumni_Mentor with pre-filled directory payload and welcome email", () => {
    const payload = convertLeaderToAlumniMentor(graduatingPresident);

    expect(payload).not.toBeNull();
    expect(payload?.assignedRole).toBe("Alumni_Mentor");
    expect(payload?.directoryProfile.roleTitle).toBe("Alumni Mentor (Former President)");
    expect(payload?.directoryProfile.pastExperienceSummary).toContain(
      "Verified former President at Computer Science Society (Class of 2026).",
    );
    expect(payload?.directoryProfile.isMentorAvailable).toBe(true);

    expect(payload?.emailNotification.recipientEmail).toBe("sarah@university.edu");
    expect(payload?.emailNotification.bodyText).toContain(
      "Congratulations on graduating! We've automatically added you to the Alumni Mentor network",
    );
  });

  it("returns null when attempting to convert non-executive general members", () => {
    const generalMember: GraduatingLeaderProfile = {
      ...graduatingPresident,
      executiveRole: "member",
    };

    expect(convertLeaderToAlumniMentor(generalMember)).toBeNull();
  });
});
