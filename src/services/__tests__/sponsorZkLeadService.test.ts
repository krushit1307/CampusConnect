// =============================================================================
// Integration Tests: SponsorZkLeadService
// Issue: #5130 - Real-Time "Sponsor Lead" CRM Webhook Zero-Knowledge Proof
// Description: Exhaustive tests for sponsor criteria, ZK lead proof submission,
// CRM webhook payload zero-knowledge validation, interview offer proxying, and PII consent release.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SponsorZkLeadService } from "../sponsorZkLeadService";
import { SponsorZkProofEngine } from "../../lib/sponsorZkProof";
import { PrivateAcademicData } from "../../types/sponsorZkLead";

describe("SponsorZkLeadService (#5130)", () => {
  let service: SponsorZkLeadService;

  const validStudentData: PrivateAcademicData = {
    studentId: "student-taylor-44",
    firstName: "Taylor",
    lastName: "Swift",
    email: "taylor@campusconnect.edu",
    major: "Computer Science",
    gpa: 3.88,
    graduationYear: 2026,
    verifiedAt: "2026-08-10T00:00:00Z",
    registrarSignature: "sig_verified_taylor_77",
  };

  beforeEach(() => {
    service = new SponsorZkLeadService();
  });

  afterEach(() => {
    service.clearAll();
  });

  it("creates and registers sponsor eligibility criteria", () => {
    const criteria = service.createCriteria(
      "sponsor-apex",
      "Apex Systems",
      "Computer Science",
      3.5,
      2026,
    );

    expect(criteria.criteriaId).toBeDefined();
    expect(criteria.sponsorId).toBe("sponsor-apex");
    expect(criteria.requiredMajor).toBe("Computer Science");
    expect(criteria.minGpa).toBe(3.5);
    expect(criteria.requiredGraduationYear).toBe(2026);

    expect(service.getCriteria(criteria.criteriaId)).toEqual(criteria);
  });

  it("submits valid ZK proof and generates anonymized proxy lead with 0 PII shared", async () => {
    const criteria = service.createCriteria(
      "sponsor-apex",
      "Apex Systems",
      "Computer Science",
      3.5,
      2026,
    );

    const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
      validStudentData,
      criteria,
    );

    const result = await service.submitZkLeadProof(
      criteria.criteriaId,
      proofPayload,
      validStudentData,
    );

    expect(result.success).toBe(true);
    expect(result.leadProxy).toBeDefined();

    const proxy = result.leadProxy!;
    expect(proxy.isVerified).toBe(true);
    expect(proxy.piiReleased).toBe(false); // PII MUST BE LOCKED INITIAL
    expect(proxy.crmDeliveryStatus).toBe("DELIVERED");
  });

  it("prevents proof replay attacks using nullifier checks", async () => {
    const criteria = service.createCriteria(
      "sponsor-apex",
      "Apex Systems",
      "Computer Science",
      3.5,
      2026,
    );

    const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
      validStudentData,
      criteria,
    );

    // First submission succeeds
    const res1 = await service.submitZkLeadProof(
      criteria.criteriaId,
      proofPayload,
      validStudentData,
    );
    expect(res1.success).toBe(true);

    // Replay submission with same nullifier fails
    const res2 = await service.submitZkLeadProof(
      criteria.criteriaId,
      proofPayload,
      validStudentData,
    );
    expect(res2.success).toBe(false);
    expect(res2.error).toContain("Replay detected");
  });

  it("proxies interview offer to student without leaking PII before acceptance", async () => {
    const criteria = service.createCriteria(
      "sponsor-apex",
      "Apex Systems",
      "Computer Science",
      3.5,
      2026,
    );
    const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
      validStudentData,
      criteria,
    );
    const leadRes = await service.submitZkLeadProof(
      criteria.criteriaId,
      proofPayload,
      validStudentData,
    );

    const proxyLeadId = leadRes.leadProxy!.leadProxyId;

    // Sponsor sends interview offer via proxy lead ID
    const offerRes = service.sendProxyInterviewOffer(
      proxyLeadId,
      "Software Engineer Intern",
      "We'd love to chat!",
    );

    expect(offerRes.success).toBe(true);
    const offer = offerRes.offer!;
    expect(offer.offerId).toBeDefined();
    expect(offer.status).toBe("PENDING");
    expect(offer.studentPii).toBeNull(); // PII IS 100% LOCKED
  });

  it("releases student PII (Name & Email) ONLY upon explicit student offer acceptance", async () => {
    const criteria = service.createCriteria(
      "sponsor-apex",
      "Apex Systems",
      "Computer Science",
      3.5,
      2026,
    );
    const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
      validStudentData,
      criteria,
    );
    const leadRes = await service.submitZkLeadProof(
      criteria.criteriaId,
      proofPayload,
      validStudentData,
    );

    const proxyLeadId = leadRes.leadProxy!.leadProxyId;
    const offerRes = service.sendProxyInterviewOffer(
      proxyLeadId,
      "SWE Intern",
      "Interview offer message",
    );

    const offerId = offerRes.offer!.offerId;

    // Student explicitly accepts offer
    const acceptRes = service.acceptProxyInterviewOffer(offerId);

    expect(acceptRes.success).toBe(true);
    const acceptedOffer = acceptRes.offer!;
    expect(acceptedOffer.status).toBe("ACCEPTED");

    // PII is NOW unlocked and released!
    expect(acceptedOffer.studentPii).toEqual({
      firstName: "Taylor",
      lastName: "Swift",
      email: "taylor@campusconnect.edu",
    });

    const updatedProxy = service.getVerifiedProxy(proxyLeadId);
    expect(updatedProxy?.piiReleased).toBe(true);
  });

  it("keeps student PII LOCKED when student declines interview offer", async () => {
    const criteria = service.createCriteria(
      "sponsor-apex",
      "Apex Systems",
      "Computer Science",
      3.5,
      2026,
    );
    const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
      validStudentData,
      criteria,
    );
    const leadRes = await service.submitZkLeadProof(
      criteria.criteriaId,
      proofPayload,
      validStudentData,
    );

    const proxyLeadId = leadRes.leadProxy!.leadProxyId;
    const offerRes = service.sendProxyInterviewOffer(
      proxyLeadId,
      "SWE Intern",
      "Interview offer message",
    );

    const offerId = offerRes.offer!.offerId;

    // Student declines offer
    const declineRes = service.declineProxyInterviewOffer(offerId);

    expect(declineRes.success).toBe(true);
    const declinedOffer = declineRes.offer!;
    expect(declinedOffer.status).toBe("DECLINED");
    expect(declinedOffer.studentPii).toBeNull(); // STAYS LOCKED

    const updatedProxy = service.getVerifiedProxy(proxyLeadId);
    expect(updatedProxy?.piiReleased).toBe(false);
  });
});
