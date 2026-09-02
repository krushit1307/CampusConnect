import { describe, it, expect, beforeEach } from "vitest";
import {
  AlumniEstateSmartContractEngine,
  EstateDonationTrust,
  OracleAttestation,
} from "../alumniEstateSmartContractEngine";

describe("Alumni Estate Smart Contract & Oracle Engine (#5354)", () => {
  let engine: AlumniEstateSmartContractEngine;

  beforeEach(() => {
    engine = new AlumniEstateSmartContractEngine();
  });

  it("1. Creates an estate donation trust with locked beneficiary wallet", () => {
    const res = engine.createTrust({
      id: "trust-test-1",
      donorId: "donor-1",
      donorName: "Dr. Evelyn Reed",
      beneficiaryId: "robotics-club",
      beneficiaryName: "Campus Robotics Club",
      beneficiaryWallet: "0x1234567890abcdef1234567890abcdef12345678",
      targetAmount: 1000000n,
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.beneficiaryWallet).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(res.data?.status).toBe("CREATED");
  });

  it("2. Beneficiary immutability & unauthorized recipient release rejection", async () => {
    const trustId = "trust-demo-robotics-5m";
    engine.fundTrust(trustId, 5000000n);

    const attestation: OracleAttestation = {
      donationId: trustId,
      eventHash: "0xevent123",
      verified: true,
      timestamp: new Date().toISOString(),
    };
    await engine.verifyOracleAttestation(trustId, attestation);

    // Attempt release to unauthorized attacker wallet
    const releaseRes = engine.releaseTrust(trustId, "0xATTACKER000000000000000000000000000000000");

    expect(releaseRes.success).toBe(false);
    expect(releaseRes.errorCode).toBe("UNAUTHORIZED_BENEFICIARY");
    expect(releaseRes.message).toContain("Release denied");

    const trust = engine.getTrust(trustId);
    expect(trust?.status).toBe("ORACLE_VERIFIED"); // Status remains unreleased
  });

  it("3 & 4. Valid funding updates state; zero/negative funding returns error", () => {
    const trustId = "trust-demo-robotics-5m";

    // Zero funding error
    const zeroRes = engine.fundTrust(trustId, 0n);
    expect(zeroRes.success).toBe(false);
    expect(zeroRes.errorCode).toBe("INVALID_FUNDING_AMOUNT");

    // Valid funding
    const fundRes = engine.fundTrust(trustId, 5000000n);
    expect(fundRes.success).toBe(true);
    expect(fundRes.data?.fundedAmount).toBe(5000000n);
    expect(fundRes.data?.status).toBe("WAITING_FOR_ORACLE");
  });

  it("5 & 6. Oracle attestation verification & tampered attestation rejection", async () => {
    const trustId = "trust-demo-robotics-5m";
    engine.fundTrust(trustId, 5000000n);

    // Unverified attestation error
    const invalidAttestation: OracleAttestation = {
      donationId: trustId,
      eventHash: "",
      verified: false,
      timestamp: new Date().toISOString(),
    };
    const failRes = await engine.verifyOracleAttestation(trustId, invalidAttestation);
    expect(failRes.success).toBe(false);
    expect(failRes.errorCode).toBe("INVALID_ORACLE_ATTESTATION");

    // Valid attestation
    const validAttestation: OracleAttestation = {
      donationId: trustId,
      eventHash: "0xhash999",
      verified: true,
      timestamp: new Date().toISOString(),
    };
    const passRes = await engine.verifyOracleAttestation(trustId, validAttestation);
    expect(passRes.success).toBe(true);
    expect(passRes.data?.oracleVerified).toBe(true);
    expect(passRes.data?.status).toBe("ORACLE_VERIFIED");
    expect(passRes.data?.attestationHash).toBeDefined();
  });

  it("7 & 8. Release requires oracle verification; succeeds when requirements met", async () => {
    const trustId = "trust-demo-robotics-5m";
    const lockedWallet = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

    // Attempt release prior to oracle verification
    const prematureRelease = engine.releaseTrust(trustId, lockedWallet);
    expect(prematureRelease.success).toBe(false);
    expect(prematureRelease.errorCode).toBe("ORACLE_NOT_VERIFIED");

    // Fund and verify oracle
    engine.fundTrust(trustId, 5000000n);
    await engine.verifyOracleAttestation(trustId, {
      donationId: trustId,
      eventHash: "0x123",
      verified: true,
      timestamp: new Date().toISOString(),
    });

    // Execute valid release
    const validRelease = engine.releaseTrust(trustId, lockedWallet);
    expect(validRelease.success).toBe(true);
    expect(validRelease.data?.status).toBe("RELEASED");
    expect(validRelease.data?.releasedAt).toBeDefined();
  });

  it("9. Double release protection: second release attempt fails", async () => {
    const trustId = "trust-demo-robotics-5m";
    const lockedWallet = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

    engine.fundTrust(trustId, 5000000n);
    await engine.verifyOracleAttestation(trustId, {
      donationId: trustId,
      eventHash: "0x123",
      verified: true,
      timestamp: new Date().toISOString(),
    });

    // First release
    const first = engine.releaseTrust(trustId, lockedWallet);
    expect(first.success).toBe(true);

    // Second release attempt
    const second = engine.releaseTrust(trustId, lockedWallet);
    expect(second.success).toBe(false);
    expect(second.errorCode).toBe("TRUST_ALREADY_RELEASED");
  });

  it("10. Monetary precision using integer bigint", () => {
    const res = engine.createTrust({
      id: "trust-bigint-test",
      donorId: "d-1",
      donorName: "Donor",
      beneficiaryId: "b-1",
      beneficiaryName: "Beneficiary",
      beneficiaryWallet: "0x1111111111111111111111111111111111111111",
      targetAmount: 5000000000000000000n, // 5 ETH in wei
    });

    expect(res.success).toBe(true);
    expect(res.data?.targetAmount).toBe(5000000000000000000n);
  });
});
