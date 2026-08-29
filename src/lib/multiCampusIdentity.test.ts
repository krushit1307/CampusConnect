import { describe, it, expect } from "vitest";
import {
  generateIdentityMigrationToken,
  verifyIdentityMigrationToken,
  executeCrossCampusMigration,
  IdentityMigrationPayload,
} from "./multiCampusIdentity";

describe("Multi-Campus Identity Resolution Utility (#4293)", () => {
  const samplePayload: Omit<IdentityMigrationPayload, "iat" | "exp"> = {
    sourceCampusId: "uni-a-stanford",
    sourceUserId: "u-stanford-101",
    userHandle: "alice_v",
    gamificationPoints: 50000,
    eventRsvpsCount: 42,
    certificates: [
      { id: "cert-1", title: "Leadership Excellence 2025", issuerCampus: "Stanford", issuedAt: "2025-05-15" },
      { id: "cert-2", title: "Hackathon Champion 2025", issuerCampus: "Stanford", issuedAt: "2025-11-20" },
    ],
  };

  it("generates signed cryptographic JWT migration token", () => {
    const token = generateIdentityMigrationToken(samplePayload);
    expect(token).toBeTypeOf("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifies and decodes valid signed JWT migration token", () => {
    const token = generateIdentityMigrationToken(samplePayload);
    const decoded = verifyIdentityMigrationToken(token);

    expect(decoded.sourceCampusId).toBe("uni-a-stanford");
    expect(decoded.gamificationPoints).toBe(50000);
    expect(decoded.certificates).toHaveLength(2);
  });

  it("rejects tampered JWT migration token signature", () => {
    const token = generateIdentityMigrationToken(samplePayload);
    const parts = token.split(".");
    const tamperedToken = `${parts[0]}.${parts[1]}.invalid_signature_hash`;

    expect(() => verifyIdentityMigrationToken(tamperedToken)).toThrow(
      "Cryptographic signature verification failed. Token has been tampered with!"
    );
  });

  it("executes cross-campus migration, merges assets, and disables old account", () => {
    const token = generateIdentityMigrationToken(samplePayload);
    const result = executeCrossCampusMigration(token, "u-berkeley-202", "uni-b-berkeley");

    expect(result.success).toBe(true);
    expect(result.transferredPoints).toBe(50000);
    expect(result.transferredCertificatesCount).toBe(2);
    expect(result.oldAccountStatus).toBe("disabled");
    expect(result.message).toContain("Old account permanently disabled");
  });
});
