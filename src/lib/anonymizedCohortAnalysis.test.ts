import { describe, it, expect } from "vitest";
import {
  generateCohortHash,
  anonymizeUserCohortData,
  queryCohortEventAttendance,
} from "./anonymizedCohortAnalysis";

describe("Automated Data Privacy Anonymized Cohort Analysis Utility (#4670)", () => {
  it("generates deterministic cohort hash string", () => {
    const hash = generateCohortHash("Computer Science", 2024);
    expect(hash).toBe("Cohort_Computer_Science_2024");
  });

  it("anonymizes user data, re-parents RSVPs to cohort, and purges PII", () => {
    const result = anonymizeUserCohortData("user-901", "Computer Science", 2024, ["evt-1", "evt-2", "evt-3"]);

    expect(result.cohortHash).toBe("Cohort_Computer_Science_2024");
    expect(result.reparentedRsvpsCount).toBe(3);
    expect(result.piiPurged).toBe(true);
  });

  it("evaluates cohort event attendance query for longitudinal university research", () => {
    const query = queryCohortEventAttendance("Computer Science", 2024, "Spring Hackathon 2024", 42);

    expect(query.major).toBe("Computer Science");
    expect(query.graduationYear).toBe(2024);
    expect(query.totalAttendedCount).toBe(42);
    expect(query.privacyGuardActive).toBe(true);
  });
});
