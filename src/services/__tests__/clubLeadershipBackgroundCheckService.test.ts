import { describe, it, expect, beforeEach } from "vitest";
import { clubLeadershipBackgroundCheckService } from "../clubLeadershipBackgroundCheckService";

describe("clubLeadershipBackgroundCheckService", () => {
  beforeEach(() => {
    clubLeadershipBackgroundCheckService.resetToSample();
  });

  it("retrieves sample background check records", () => {
    const all = clubLeadershipBackgroundCheckService.getAllRecords();
    expect(all.length).toBeGreaterThan(0);
  });

  it("returns cleared status for a candidate with clean compliance vectors", () => {
    const record = clubLeadershipBackgroundCheckService.getCheckByTransitionId("trans-1");
    expect(record).toBeDefined();
    expect(record?.status).toBe("cleared");
    expect(record?.riskFlags.length).toBe(0);

    const isCleared = clubLeadershipBackgroundCheckService.isCandidateClearedForLeadership("trans-1");
    expect(isCleared).toBe(true);
  });

  it("flags candidates for review if compliance vectors fail (e.g. low GPA or missing safety training)", () => {
    const record = clubLeadershipBackgroundCheckService.getCheckByTransitionId("trans-2");
    expect(record).toBeDefined();
    expect(record?.status).toBe("flagged_for_review");
    expect(record?.riskFlags).toContain("missing_safety_training");
    expect(record?.riskFlags).toContain("financial_hold");

    const isCleared = clubLeadershipBackgroundCheckService.isCandidateClearedForLeadership("trans-2");
    expect(isCleared).toBe(false);
  });

  it("evaluates custom vector overrides and detects low GPA risk flags", () => {
    const newCheck = clubLeadershipBackgroundCheckService.initiateBackgroundCheck({
      transitionId: "trans-test-low-gpa",
      clubId: "club-cs",
      clubName: "Computer Science Society",
      candidateId: "user-low-gpa",
      candidateName: "Test Low GPA Candidate",
      candidateEmail: "lowgpa@campus.edu",
      roleTitle: "Club Vice President",
    });

    const screened = clubLeadershipBackgroundCheckService.runAutomatedScreening(newCheck.id, {
      academic: {
        gpa: 2.1, // Below 2.5 min threshold
        minGpaRequired: 2.5,
        isAcademicProbation: true,
        creditHoursEnrolled: 15,
        minCreditsRequired: 12,
        passed: false,
      },
    });

    expect(screened?.status).toBe("flagged_for_review");
    expect(screened?.riskFlags).toContain("low_gpa");
    expect(screened?.riskFlags).toContain("academic_probation");
  });

  it("allows Student Union staff advisors to manually override flagged status", () => {
    const check = clubLeadershipBackgroundCheckService.getCheckByTransitionId("trans-2");
    expect(check?.status).toBe("flagged_for_review");

    const overridden = clubLeadershipBackgroundCheckService.manualAdvisorOverride(
      check!.id,
      "Advisor Dr. Taylor",
      "cleared",
      "Granted one-term waiver for safety training completion deadline.",
    );

    expect(overridden?.status).toBe("cleared");
    expect(overridden?.advisorOverride?.advisorName).toBe("Advisor Dr. Taylor");
    expect(overridden?.advisorOverride?.notes).toContain("one-term waiver");

    const isClearedNow = clubLeadershipBackgroundCheckService.isCandidateClearedForLeadership("trans-2");
    expect(isClearedNow).toBe(true);
  });
});
