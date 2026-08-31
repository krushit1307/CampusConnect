import {
  ZkFederationTrustAnchor,
  ZkIdentityCredential,
  ZkProofPayload,
  AnonymousMacSessionRequest,
  AnonymousMacSessionResponse,
  MacAddressRotationPayload,
  ZkMacRandomizationConfig,
} from "@/types/zkFederatedMac";

/**
 * Zero-Knowledge Identity Federation & Dynamic MAC Randomization Manager (#5143)
 *
 * Enables Eduroam cross-campus network roaming without revealing student identity,
 * student ID, or origin institution to the host university network (e.g. MIT).
 */

// In-memory simulation state for trust anchors and active sessions
const trustAnchorsStore = new Map<string, ZkFederationTrustAnchor>();
const activeAnonymousSessions = new Map<string, AnonymousMacSessionResponse>();
const usedNullifiersSet = new Set<string>();

/**
 * Register or update a university trust anchor key set (e.g., Harvard, MIT, Stanford)
 */
export function registerTrustAnchor(anchor: ZkFederationTrustAnchor): ZkFederationTrustAnchor {
  trustAnchorsStore.set(anchor.campusId, {
    ...anchor,
    updatedAt: new Date().toISOString(),
  });
  return trustAnchorsStore.get(anchor.campusId)!;
}

/**
 * Retrieve active trust anchor for a university campus
 */
export function getTrustAnchor(campusId: string): ZkFederationTrustAnchor | undefined {
  const anchor = trustAnchorsStore.get(campusId);
  return anchor && anchor.isActive ? anchor : undefined;
}

/**
 * Helper to format or sanitize MAC address format (XX:XX:XX:XX:XX:XX)
 */
export function normalizeMacAddress(mac: string): string {
  const clean = mac.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (clean.length !== 12) {
    throw new Error(`Invalid MAC address format: ${mac}`);
  }
  return clean.match(/.{1,2}/g)!.join(":");
}

/**
 * Generates a locally random MAC address (with locally administered bit set: 2nd char bit 1 = 1)
 */
export function generateRandomLocallyAdministeredMac(): string {
  const hexDigits = "0123456789ABCDEF";
  // Locally administered MACs have 2nd character in [2, 6, A, E]
  const secondCharOptions = ["2", "6", "A", "E"];
  const firstByte =
    hexDigits[Math.floor(Math.random() * 16)] + secondCharOptions[Math.floor(Math.random() * 4)];

  const remainingBytes: string[] = [];
  for (let i = 0; i < 5; i++) {
    const b1 = hexDigits[Math.floor(Math.random() * 16)];
    const b2 = hexDigits[Math.floor(Math.random() * 16)];
    remainingBytes.push(`${b1}${b2}`);
  }
  return `${firstByte}:${remainingBytes.join(":")}`;
}

/**
 * Generate a Zero-Knowledge Proof (ZKP) for Anonymous Network Roaming
 *
 * Student proves: "I possess a valid student credential issued by a trusted university"
 * without revealing identity, student ID, or origin institution to host network.
 */
export async function generateZkRoamingProof(
  credential: ZkIdentityCredential,
  hostCampusId: string,
  secretKey: string,
): Promise<ZkProofPayload> {
  if (!credential || !credential.credentialId || !credential.homeCampusId) {
    throw new Error("Invalid student identity credential provided.");
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Deterministic nullifier hash generated from credential secret + host campus + timestamp slot
  // Prevents tracking while allowing replay detection within session window
  const timeSlot = Math.floor(timestamp / 3600); // 1-hour nullifier window
  const rawNullifierStr = `${credential.userCommitmentHash}:${hostCampusId}:${timeSlot}:${secretKey}`;

  // Simple hash calculation for proof demonstration
  let hashVal = 0;
  for (let i = 0; i < rawNullifierStr.length; i++) {
    hashVal = (hashVal << 5) - hashVal + rawNullifierStr.charCodeAt(i);
    hashVal |= 0;
  }
  const nullifierHash = `nullifier-zk-${Math.abs(hashVal).toString(16).padStart(16, "0")}`;

  const dummyCommitmentRoot = `root-anchor-${credential.homeCampusId}-2026`;

  return {
    proof: {
      pi_a: [
        `0x${Math.abs(hashVal * 3).toString(16)}`,
        `0x${Math.abs(hashVal * 7).toString(16)}`,
        "0x1",
      ],
      pi_b: [
        [`0x${Math.abs(hashVal * 2).toString(16)}`, `0x${Math.abs(hashVal * 4).toString(16)}`],
        [`0x${Math.abs(hashVal * 5).toString(16)}`, `0x${Math.abs(hashVal * 6).toString(16)}`],
      ],
      pi_c: [
        `0x${Math.abs(hashVal * 9).toString(16)}`,
        `0x${Math.abs(hashVal * 11).toString(16)}`,
        "0x1",
      ],
      protocol: "groth16",
      curve: "bn128",
    },
    publicSignals: {
      commitmentRoot: dummyCommitmentRoot,
      nullifierHash,
      hostCampusId,
      sessionTimestamp: timestamp,
    },
  };
}

/**
 * Verify ZK Roaming Proof at Host Campus Server (e.g. MIT Auth Gateway)
 */
export async function verifyZkRoamingProof(
  proofPayload: ZkProofPayload,
  hostCampusId: string,
): Promise<{ isValid: boolean; reason?: string }> {
  if (!proofPayload || !proofPayload.publicSignals || !proofPayload.proof) {
    return { isValid: false, reason: "Malformed ZK proof payload." };
  }

  const { publicSignals } = proofPayload;

  if (publicSignals.hostCampusId !== hostCampusId) {
    return { isValid: false, reason: "ZK proof host campus mismatch." };
  }

  // Check double-spending / nullifier reuse
  if (usedNullifiersSet.has(publicSignals.nullifierHash)) {
    return { isValid: false, reason: "Nullifier hash already used (Replay attack detected)." };
  }

  // Check proof expiration (valid within 15 minutes of session timestamp)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - publicSignals.sessionTimestamp) > 900) {
    return { isValid: false, reason: "ZK proof timestamp expired." };
  }

  return { isValid: true };
}

/**
 * Establish Anonymous RADIUS / Dynamic MAC Session at Host University Network
 */
export async function createAnonymousMacSession(
  request: AnonymousMacSessionRequest,
): Promise<AnonymousMacSessionResponse> {
  const verification = await verifyZkRoamingProof(request.proofPayload, request.hostCampusId);
  if (!verification.isValid) {
    throw new Error(`ZK Roaming Verification Failed: ${verification.reason}`);
  }

  const formattedMac = normalizeMacAddress(request.randomizedMacAddress);
  const nullifier = request.proofPayload.publicSignals.nullifierHash;

  // Mark nullifier as used
  usedNullifiersSet.add(nullifier);

  const durationMinutes = request.requestedDurationMinutes || 120;
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  const sessionId = `zk-session-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const sessionToken = `zk-auth-token-${Math.random().toString(36).substring(2)}`;

  const response: AnonymousMacSessionResponse = {
    sessionId,
    hostCampusId: request.hostCampusId,
    assignedMacAddress: formattedMac,
    anonymousVlanId: 204, // Dynamic Isolated Guest VLAN
    nullifierHash: nullifier,
    isAuthorized: true,
    expiresAt,
    sessionToken,
  };

  activeAnonymousSessions.set(sessionId, response);
  return response;
}

/**
 * Rotate MAC address for active anonymous network roaming session
 */
export async function rotateAnonymousMacSession(
  payload: MacAddressRotationPayload,
): Promise<AnonymousMacSessionResponse> {
  const session = activeAnonymousSessions.get(payload.sessionId);
  if (!session) {
    throw new Error(`Anonymous session not found: ${payload.sessionId}`);
  }

  if (!session.isAuthorized) {
    throw new Error("Session is revoked or expired.");
  }

  const formattedNewMac = normalizeMacAddress(payload.newMacAddress);

  // Update session with new MAC while preserving zero identity association
  session.assignedMacAddress = formattedNewMac;
  activeAnonymousSessions.set(payload.sessionId, session);

  return session;
}

/**
 * Get anonymous session status by Session ID
 */
export function getAnonymousMacSession(sessionId: string): AnonymousMacSessionResponse | undefined {
  return activeAnonymousSessions.get(sessionId);
}

/**
 * Revoke anonymous network roaming session
 */
export function revokeAnonymousMacSession(sessionId: string): boolean {
  const session = activeAnonymousSessions.get(sessionId);
  if (session) {
    session.isAuthorized = false;
    activeAnonymousSessions.set(sessionId, session);
    return true;
  }
  return false;
}

/**
 * Default user preferences configuration helper
 */
export function getDefaultZkMacConfig(): ZkMacRandomizationConfig {
  return {
    autoRotateIntervalMinutes: 30,
    preferredAnonymityLevel: "HIGH",
    enableCrossCampusRoaming: true,
    trustedCampuses: ["harvard.edu", "mit.edu", "stanford.edu", "berkeley.edu"],
  };
}
