import { describe, it, expect, beforeEach } from "vitest";
import {
  ClubSuccessionHealthService,
  ExecutiveMember,
} from "../../src/services/clubSuccessionHealthService";

describe("ClubSuccessionHealthService (#4138)", () => {
  beforeEach(() => {
    ClubSuccessionHealthService.resetState();
  });

  it("should flag CRITICAL_SUCCESSION_RISK when >75% of executives graduate in current year with 0 underclassmen", () => {
    const currentYear = 2026;
    const dyingClubBoard: ExecutiveMember[] = [
      {
        userId: "u-1",
        name: "Senior 1",
        role: "President",
        expectedGraduationYear: 2026,
        isGraduatingThisYear: true,
      },
      {
        userId: "u-2",
        name: "Senior 2",
        role: "Vice President",
        expectedGraduationYear: 2026,
        isGraduatingThisYear: true,
      },
      {
        userId: "u-3",
        name: "Senior 3",
        role: "Treasurer",
        expectedGraduationYear: 2026,
        isGraduatingThisYear: true,
      },
      {
        userId: "u-4",
        name: "Senior 4",
        role: "Secretary",
        expectedGraduationYear: 2026,
        isGraduatingThisYear: true,
      },
      {
        userId: "u-5",
        name: "Senior 5",
        role: "Committee Lead",
        expectedGraduationYear: 2026,
        isGraduatingThisYear: true,
      },
    ];

    const report = ClubSuccessionHealthService.evaluateSuccessionHealth({
      clubId: "club-at-risk",
      clubName: "Vanishing Club",
      currentAcademicYear: currentYear,
      executives: dyingClubBoard,
      underclassmenPipelineCount: 0,
    });

    expect(report.riskLevel).toBe("CRITICAL_SUCCESSION_RISK");
    expect(report.graduatingRatioPercentage).toBe(100.0);
    expect(report.flaggedToStudentUnion).toBe(true);
    expect(report.healthScore).toBeLessThan(30);
    expect(report.warningNotice).toContain("⚠ Succession Risk: Over 75%");
    expect(report.recommendedActionPlan.length).toBeGreaterThan(0);
  });

  it("should evaluate HEALTHY when board has balanced multi-year graduation representation and active pipeline", () => {
    const currentYear = 2026;
    const healthyBoard: ExecutiveMember[] = [
      {
        userId: "u-1",
        name: "Senior Pres",
        role: "President",
        expectedGraduationYear: 2026,
        isGraduatingThisYear: true,
      },
      {
        userId: "u-2",
        name: "Junior VP",
        role: "Vice President",
        expectedGraduationYear: 2027,
        isGraduatingThisYear: false,
      },
      {
        userId: "u-3",
        name: "Sophomore Treas",
        role: "Treasurer",
        expectedGraduationYear: 2028,
        isGraduatingThisYear: false,
      },
      {
        userId: "u-4",
        name: "Freshman Lead",
        role: "Committee Lead",
        expectedGraduationYear: 2029,
        isGraduatingThisYear: false,
      },
    ];

    const report = ClubSuccessionHealthService.evaluateSuccessionHealth({
      clubId: "club-thriving",
      clubName: "Sustainable Club",
      currentAcademicYear: currentYear,
      executives: healthyBoard,
      underclassmenPipelineCount: 2,
    });

    expect(report.riskLevel).toBe("HEALTHY");
    expect(report.graduatingRatioPercentage).toBe(25.0);
    expect(report.flaggedToStudentUnion).toBe(false);
    expect(report.healthScore).toBeGreaterThanOrEqual(85);
    expect(report.warningNotice).toBeNull();
  });

  it("should nominate underclassmen successors and track shadowing state", () => {
    const clubId = "club-cs-01";

    const nomination = ClubSuccessionHealthService.nominateSuccessor({
      clubId,
      nomineeUserId: "user-freshman-01",
      nomineeName: "Samantha Reed",
      targetRole: "Officer-in-Training (President Track)",
      expectedGraduationYear: 2029,
      nominatedByUserId: "user-senior-pres",
    });

    expect(nomination.id).toBeDefined();
    expect(nomination.status).toBe("PROPOSED");

    // Advance to SHADOWING
    const updated = ClubSuccessionHealthService.updateNominationStatus(nomination.id, "SHADOWING");
    expect(updated.status).toBe("SHADOWING");

    const clubNominations = ClubSuccessionHealthService.getNominationsForClub(clubId);
    expect(clubNominations.length).toBe(1);
    expect(clubNominations[0].nomineeName).toBe("Samantha Reed");
  });
});
