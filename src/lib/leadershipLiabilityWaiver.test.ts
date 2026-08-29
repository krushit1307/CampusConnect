import { describe, it, expect } from "vitest";
import {
  getTransitionHandoverSteps,
  generateWaiverSignatureHash,
  executeLeadershipLiabilityWaiver,
  WaiverExecutionPayload,
} from "./leadershipLiabilityWaiver";

describe("Implement Automated Club Leadership Liability Waiver Suite (#4534)", () => {
  const validPayload: WaiverExecutionPayload = {
    clubId: "club_rock_climbing",
    incomingAdminId: "usr_pres_jake",
    adminFullName: "Jake Sullivan",
    signatureText: "Jake Sullivan",
    signedAtIso: "2026-08-27T10:00:00Z",
  };

  it("dynamically injects 4th waiver step into handover checklist for High-risk clubs only", () => {
    const lowRiskSteps = getTransitionHandoverSteps("Low");
    expect(lowRiskSteps.length).toBe(3);
    expect(lowRiskSteps.some((s) => s.isWaiverStep)).toBe(false);

    const highRiskSteps = getTransitionHandoverSteps("High");
    expect(highRiskSteps.length).toBe(4);
    expect(highRiskSteps[3].stepNumber).toBe(4);
    expect(highRiskSteps[3].isWaiverStep).toBe(true);
    expect(highRiskSteps[3].title).toContain("Execute High-Risk Leadership");
  });

  it("generates deterministic 64-character SHA-256 cryptographic signature hashes", () => {
    const hash1 = generateWaiverSignatureHash(validPayload);
    const hash2 = generateWaiverSignatureHash(validPayload);

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it("executes legal waiver and validates signature match against full name", () => {
    const record = executeLeadershipLiabilityWaiver(validPayload, "High");

    expect(record.isLegallyBinding).toBe(true);
    expect(record.signatureHash).toBeDefined();
    expect(record.waiverTitle).toContain("High-Risk Organization Leadership");

    // Test signature mismatch rejection
    const invalidPayload: WaiverExecutionPayload = {
      ...validPayload,
      signatureText: "Wrong Name",
    };

    expect(() => executeLeadershipLiabilityWaiver(invalidPayload, "High")).toThrow(
      "Signature mismatch: Printed name must match signature text exactly.",
    );
  });
});
