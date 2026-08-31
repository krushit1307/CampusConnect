// =============================================================================
// Unit Tests: SponsorZkProofEngine
// Issue: #5130 - Real-Time "Sponsor Lead" CRM Webhook Zero-Knowledge Proof
// Description: Exhaustive cryptographic tests asserting Groth16 ZK proof generation,
// verification soundness, criteria matching, anti-tampering, and 0-PII leakage.
// =============================================================================

import { describe, it, expect } from "vitest";
import { SponsorZkProofEngine } from "../sponsorZkProof";
import { PrivateAcademicData, SponsorLeadCriteria } from "../../types/sponsorZkLead";

describe("SponsorZkProofEngine (#5130)", () => {
  const mockCriteria: SponsorLeadCriteria = {
    criteriaId: "crit-cs-2026",
    sponsorId: "sponsor-techcorp",
    sponsorName: "TechCorp Global",
    requiredMajor: "Computer Science",
    minGpa: 3.5,
    requiredGraduationYear: 2026,
  };

  const validPrivateData: PrivateAcademicData = {
    studentId: "student-alex-99",
    firstName: "Alex",
    lastName: "Johnson",
    email: "alex@university.edu",
    major: "Computer Science",
    gpa: 3.92, // Exact GPA > 3.5
    graduationYear: 2026,
    verifiedAt: "2026-08-01T00:00:00Z",
    registrarSignature: "sig_verified_12345",
  };

  it("scales floating-point GPA to integer accurately for ZK field arithmetic", () => {
    expect(SponsorZkProofEngine.scaleGpa(3.5)).toBe(350);
    expect(SponsorZkProofEngine.scaleGpa(3.92)).toBe(392);
    expect(SponsorZkProofEngine.scaleGpa(4.0)).toBe(400);
  });

  it("generates and cryptographically verifies a valid ZK proof when student satisfies criteria", async () => {
    const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
      validPrivateData,
      mockCriteria,
    );

    expect(proofPayload).toBeDefined();
    expect(proofPayload.criteriaId).toBe("crit-cs-2026");
    expect(proofPayload.nullifierHash).toBeDefined();

    const verification = await SponsorZkProofEngine.verifyLeadEligibilityProof(
      proofPayload,
      mockCriteria,
    );

    expect(verification.isValid).toBe(true);
    expect(verification.error).toBeUndefined();
  });

  it("fails proof generation if student GPA is below minimum threshold (3.2 < 3.5)", async () => {
    const lowGpaData: PrivateAcademicData = {
      ...validPrivateData,
      gpa: 3.2, // Below 3.5
    };

    await expect(
      SponsorZkProofEngine.generateLeadEligibilityProof(lowGpaData, mockCriteria),
    ).rejects.toThrow(/GPA requirement not satisfied/i);
  });

  it("fails proof generation if student major does not match required major", async () => {
    const wrongMajorData: PrivateAcademicData = {
      ...validPrivateData,
      major: "Mechanical Engineering",
    };

    await expect(
      SponsorZkProofEngine.generateLeadEligibilityProof(wrongMajorData, mockCriteria),
    ).rejects.toThrow(/Major requirement not satisfied/i);
  });

  it("fails proof generation if graduation year does not match", async () => {
    const wrongYearData: PrivateAcademicData = {
      ...validPrivateData,
      graduationYear: 2025,
    };

    await expect(
      SponsorZkProofEngine.generateLeadEligibilityProof(wrongYearData, mockCriteria),
    ).rejects.toThrow(/Graduation year requirement not satisfied/i);
  });

  it("fails verification if public signals are tampered with (criteria mismatch)", async () => {
    const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
      validPrivateData,
      mockCriteria,
    );

    // Tamper with public signals min GPA expectation (change 350 to 390)
    const tamperedPayload = {
      ...proofPayload,
      publicSignals: [
        1,
        390,
        proofPayload.publicSignals[2],
        proofPayload.publicSignals[3],
        proofPayload.publicSignals[4],
      ],
    };

    const verification = await SponsorZkProofEngine.verifyLeadEligibilityProof(
      tamperedPayload,
      mockCriteria,
    );

    expect(verification.isValid).toBe(false);
    expect(verification.error).toContain("min GPA mismatch");
  });

  it("fails verification if proof object protocol is corrupted", async () => {
    const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
      validPrivateData,
      mockCriteria,
    );

    const corruptedPayload = {
      ...proofPayload,
      proof: {
        ...proofPayload.proof,
        protocol: "invalid_proto",
      },
    };

    const verification = await SponsorZkProofEngine.verifyLeadEligibilityProof(
      corruptedPayload,
      mockCriteria,
    );

    expect(verification.isValid).toBe(false);
    expect(verification.error).toContain("Malformed Groth16 proof structure");
  });

  it("verifies 0-PII leakage: proof payload and public signals contain NO name, email, exact GPA, or transcript", async () => {
    const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
      validPrivateData,
      mockCriteria,
    );

    const serializedPayload = JSON.stringify(proofPayload);

    // PII leak assertions
    expect(serializedPayload).not.toContain("Alex");
    expect(serializedPayload).not.toContain("Johnson");
    expect(serializedPayload).not.toContain("alex@university.edu");
    expect(serializedPayload).not.toContain("3.92"); // Exact GPA must NOT appear
    expect(serializedPayload).not.toContain("sig_verified_12345"); // Registrar signature secret must NOT appear
  });
});
