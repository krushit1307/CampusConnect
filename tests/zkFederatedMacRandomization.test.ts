import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTrustAnchor,
  getTrustAnchor,
  normalizeMacAddress,
  generateRandomLocallyAdministeredMac,
  generateZkRoamingProof,
  verifyZkRoamingProof,
  createAnonymousMacSession,
  rotateAnonymousMacSession,
  getAnonymousMacSession,
  revokeAnonymousMacSession,
  getDefaultZkMacConfig,
} from "@/lib/network/zkFederatedMacManager";
import { ZkIdentityCredential, ZkFederationTrustAnchor } from "@/types/zkFederatedMac";

describe("Zero-Knowledge Identity Federation & Dynamic MAC Randomization (#5143)", () => {
  const mockHomeCampus = "harvard.edu";
  const mockHostCampus = "mit.edu";

  const mockTrustAnchor: ZkFederationTrustAnchor = {
    id: "anchor-001",
    campusId: mockHomeCampus,
    institutionName: "Harvard University",
    publicKeyPem:
      "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...\n-----END PUBLIC KEY-----",
    commitmentRootHash: "root-anchor-harvard.edu-2026",
    zkCircuitId: "eduroam-zkp-v1",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockCredential: ZkIdentityCredential = {
    credentialId: "cred-98765",
    homeCampusId: mockHomeCampus,
    userCommitmentHash: "commit-hash-abc123xyz",
    signature: "rsa-sig-harvard-auth-server",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    issuedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    registerTrustAnchor(mockTrustAnchor);
  });

  describe("Trust Anchors & Utility Methods", () => {
    it("should register and retrieve university trust anchors", () => {
      const anchor = getTrustAnchor(mockHomeCampus);
      expect(anchor).toBeDefined();
      expect(anchor?.institutionName).toBe("Harvard University");
    });

    it("should normalize MAC addresses to standard format", () => {
      expect(normalizeMacAddress("aabbccddeeff")).toBe("AA:BB:CC:DD:EE:FF");
      expect(normalizeMacAddress("AA-BB-CC-DD-EE-FF")).toBe("AA:BB:CC:DD:EE:FF");
    });

    it("should throw error for invalid MAC address input", () => {
      expect(() => normalizeMacAddress("invalid-mac")).toThrow();
    });

    it("should generate valid locally-administered random MAC addresses", () => {
      const mac = generateRandomLocallyAdministeredMac();
      expect(mac).toMatch(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/);
      // Check locally administered bit (2nd char must be 2, 6, A, or E)
      expect(["2", "6", "A", "E"]).toContain(mac[1]);
    });
  });

  describe("Zero-Knowledge Proof Generation & Verification", () => {
    it("should generate valid ZK proof payload without revealing student identity", async () => {
      const proofPayload = await generateZkRoamingProof(
        mockCredential,
        mockHostCampus,
        "secret-user-salt",
      );

      expect(proofPayload.proof).toBeDefined();
      expect(proofPayload.proof.protocol).toBe("groth16");
      expect(proofPayload.publicSignals.hostCampusId).toBe(mockHostCampus);
      expect(proofPayload.publicSignals.nullifierHash).toMatch(/^nullifier-zk-/);
    });

    it("should verify valid ZK proof against host campus", async () => {
      const proofPayload = await generateZkRoamingProof(
        mockCredential,
        mockHostCampus,
        "unique-salt-1",
      );
      const verification = await verifyZkRoamingProof(proofPayload, mockHostCampus);

      expect(verification.isValid).toBe(true);
    });

    it("should reject proof if host campus ID does not match", async () => {
      const proofPayload = await generateZkRoamingProof(
        mockCredential,
        mockHostCampus,
        "unique-salt-2",
      );
      const verification = await verifyZkRoamingProof(proofPayload, "stanford.edu");

      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain("mismatch");
    });

    it("should detect double-spend / replay attack on nullifier reuse", async () => {
      const proofPayload = await generateZkRoamingProof(
        mockCredential,
        mockHostCampus,
        "unique-salt-3",
      );

      // Create session first time
      await createAnonymousMacSession({
        hostCampusId: mockHostCampus,
        randomizedMacAddress: generateRandomLocallyAdministeredMac(),
        proofPayload,
      });

      // Second attempt with same nullifier hash should be rejected
      const secondVerification = await verifyZkRoamingProof(proofPayload, mockHostCampus);
      expect(secondVerification.isValid).toBe(false);
      expect(secondVerification.reason).toContain("Replay attack detected");
    });
  });

  describe("Anonymous RADIUS & Dynamic MAC Sessions", () => {
    it("should grant anonymous network session with isolated VLAN", async () => {
      const macAddress = generateRandomLocallyAdministeredMac();
      const proofPayload = await generateZkRoamingProof(
        mockCredential,
        mockHostCampus,
        "unique-salt-4",
      );

      const session = await createAnonymousMacSession({
        hostCampusId: mockHostCampus,
        randomizedMacAddress: macAddress,
        proofPayload,
      });

      expect(session.isAuthorized).toBe(true);
      expect(session.assignedMacAddress).toBe(macAddress);
      expect(session.anonymousVlanId).toBe(204);
      expect(session.sessionToken).toBeTruthy();
    });

    it("should rotate MAC address for active anonymous session", async () => {
      const initialMac = generateRandomLocallyAdministeredMac();
      const proofPayload = await generateZkRoamingProof(
        mockCredential,
        mockHostCampus,
        "unique-salt-5",
      );

      const session = await createAnonymousMacSession({
        hostCampusId: mockHostCampus,
        randomizedMacAddress: initialMac,
        proofPayload,
      });

      const newMac = generateRandomLocallyAdministeredMac();
      const rotated = await rotateAnonymousMacSession({
        sessionId: session.sessionId,
        currentMacAddress: initialMac,
        newMacAddress: newMac,
        rotationProof: {
          nullifierHash: session.nullifierHash,
          sessionSignature: "sig-rotation",
        },
      });

      expect(rotated.assignedMacAddress).toBe(newMac);
    });

    it("should revoke anonymous network roaming session", async () => {
      const proofPayload = await generateZkRoamingProof(
        mockCredential,
        mockHostCampus,
        "unique-salt-6",
      );
      const session = await createAnonymousMacSession({
        hostCampusId: mockHostCampus,
        randomizedMacAddress: generateRandomLocallyAdministeredMac(),
        proofPayload,
      });

      const revoked = revokeAnonymousMacSession(session.sessionId);
      expect(revoked).toBe(true);

      const fetched = getAnonymousMacSession(session.sessionId);
      expect(fetched?.isAuthorized).toBe(false);
    });

    it("should return default privacy and MAC config", () => {
      const config = getDefaultZkMacConfig();
      expect(config.preferredAnonymityLevel).toBe("HIGH");
      expect(config.trustedCampuses).toContain("mit.edu");
    });
  });
});
