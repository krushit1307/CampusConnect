/**
 * Types for Zero-Knowledge Identity Federation & Dynamic MAC Randomization (#5143)
 */

export interface ZkFederationTrustAnchor {
  id: string;
  campusId: string;
  institutionName: string; // e.g. "Harvard University"
  publicKeyPem: string;
  commitmentRootHash: string; // Merkle root of valid student commitments
  zkCircuitId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ZkIdentityCredential {
  credentialId: string;
  homeCampusId: string;
  userCommitmentHash: string; // Blinded hash of student ID + secret
  signature: string; // Home university cryptographic signature over commitment
  expiresAt: string;
  issuedAt: string;
}

export interface ZkProofPayload {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: {
    commitmentRoot: string;
    nullifierHash: string; // Prevents double-spend / replay attacks
    hostCampusId: string;
    sessionTimestamp: number;
  };
}

export interface AnonymousMacSessionRequest {
  hostCampusId: string;
  randomizedMacAddress: string;
  proofPayload: ZkProofPayload;
  requestedDurationMinutes?: number;
}

export interface AnonymousMacSessionResponse {
  sessionId: string;
  hostCampusId: string;
  assignedMacAddress: string;
  anonymousVlanId: number;
  nullifierHash: string;
  isAuthorized: boolean;
  expiresAt: string;
  sessionToken: string;
}

export interface MacAddressRotationPayload {
  sessionId: string;
  currentMacAddress: string;
  newMacAddress: string;
  rotationProof: {
    nullifierHash: string;
    sessionSignature: string;
  };
}

export interface ZkFederatedAuditRecord {
  id: string;
  nullifierHash: string;
  hostCampusId: string;
  verifiedAt: string;
  sessionStatus: "ACTIVE" | "EXPIRED" | "REVOKED";
  anonymizedTrafficBytes: number;
}

export interface ZkMacRandomizationConfig {
  autoRotateIntervalMinutes: number;
  preferredAnonymityLevel: "STANDARD" | "HIGH" | "PARANOID";
  enableCrossCampusRoaming: boolean;
  trustedCampuses: string[];
}
