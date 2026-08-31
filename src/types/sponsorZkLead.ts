// =============================================================================
// Types: Real-Time Sponsor Lead CRM Webhook Zero-Knowledge Proof
// Issue: #5130 - Real-Time "Sponsor Lead" CRM Webhook Zero-Knowledge Proof
// Description: Data models for sponsor eligibility criteria, private student academic records,
// ZK Groth16 proof payloads, anonymized proxy leads, and interview offer PII consent flow.
// =============================================================================

export interface SponsorLeadCriteria {
  criteriaId: string;
  sponsorId: string;
  sponsorName: string;
  requiredMajor: string; // e.g. "Computer Science"
  minGpa: number; // e.g. 3.5
  requiredGraduationYear: number; // e.g. 2026
  createdAt?: string;
}

export interface PrivateAcademicData {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  major: string;
  gpa: number; // Exact GPA (e.g. 3.92) - STAYS STRICTLY ON CLIENT
  graduationYear: number;
  verifiedAt: string;
  registrarSignature: string;
}

export interface Groth16ProofObject {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
}

export interface ZkProofPayload {
  criteriaId: string;
  proof: Groth16ProofObject;
  publicSignals: (string | number)[];
  nullifierHash: string;
  timestamp: string;
}

export interface ZkVerifiedLeadProxy {
  leadProxyId: string;
  sponsorId: string;
  criteriaId: string;
  isVerified: boolean;
  verifiedAt: string;
  crmDeliveryStatus: "PENDING" | "DELIVERED" | "FAILED";
  offerStatus: "NONE" | "OFFER_SENT" | "ACCEPTED" | "DECLINED";
  piiReleased: boolean;
}

export interface ProxyInterviewOffer {
  offerId: string;
  leadProxyId: string;
  sponsorId: string;
  sponsorName: string;
  positionTitle: string;
  message: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  respondedAt?: string | null;
  // Revealed ONLY after explicit student acceptance (status == "ACCEPTED")
  studentPii?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}
