// =============================================================================
// Unit Tests: HalalProvenanceEngine
// Issue: #5284 - Interactive "Dietary Restriction" Blockchain Provenance for Halal Certification
// Description: Asserts lot canonicalization, certificate hashing, board signature
// verification, hash-chain immutability, QR payload construction, and the trail
// an attendee sees when tracing a plate back to the certified facility.
// =============================================================================

import { describe, it, expect } from "vitest";
import { GENESIS_HASH, HalalProvenanceEngine } from "../halalProvenance";
import { CertificationBoard, LotSubmission, ProcessingFacility } from "../../types/halalProvenance";

const IFANCA: CertificationBoard = {
  id: "ifanca",
  name: "Islamic Food and Nutrition Council of America",
  standard: "HALAL",
  publicKey: "0xifanca_public_key",
  accreditationCountry: "US",
};

const OU_KOSHER: CertificationBoard = {
  id: "ou-kosher",
  name: "Orthodox Union",
  standard: "KOSHER",
  publicKey: "0xou_public_key",
  accreditationCountry: "US",
};

const BOARDS = [IFANCA, OU_KOSHER];

const FACILITY: ProcessingFacility = {
  id: "facility-crescent-poultry",
  name: "Crescent Poultry Co.",
  establishmentNumber: "P-31427",
  city: "Dearborn",
  country: "US",
  certifiedBy: "ifanca",
};

const CERTIFICATE_DOCUMENT = JSON.stringify({
  certificateId: "IFANCA-2026-88213",
  facility: "P-31427",
  species: "chicken",
  method: "hand-slaughtered, no stunning",
});

/** A submission whose signature verifies against IFANCA's key. */
const signedSubmission = (overrides: Partial<LotSubmission> = {}): LotSubmission => {
  const base: LotSubmission = {
    eventId: "event-msa-iftar",
    catererId: "caterer-noor",
    standard: "HALAL",
    lotNumber: "LOT-2026-0918-A7",
    facilityId: FACILITY.id,
    boardId: IFANCA.id,
    certificateDocument: CERTIFICATE_DOCUMENT,
    boardSignature: "0x" + "0".repeat(128),
    slaughterDate: "2026-09-14",
    ...overrides,
  };

  const payload = HalalProvenanceEngine.buildSignaturePayload({
    ...base,
    certificateHash: HalalProvenanceEngine.hashCertificate(base.certificateDocument),
  });

  return {
    ...base,
    boardSignature:
      overrides.boardSignature ??
      HalalProvenanceEngine.expectedSignature(payload, IFANCA.publicKey),
  };
};

describe("HalalProvenanceEngine (#5284)", () => {
  describe("lot numbers", () => {
    it("normalizes carton casing and stray whitespace", () => {
      expect(HalalProvenanceEngine.normalizeLotNumber("  lot-2026-0918-a7 ")).toBe(
        "LOT-2026-0918-A7",
      );
    });

    it("accepts the printed carton format and rejects anything else", () => {
      expect(HalalProvenanceEngine.isValidLotNumber("LOT-2026-0918-A7")).toBe(true);
      expect(HalalProvenanceEngine.isValidLotNumber("lot-2026-0918-a7")).toBe(true);
      expect(HalalProvenanceEngine.isValidLotNumber("BATCH-88")).toBe(false);
      expect(HalalProvenanceEngine.isValidLotNumber("")).toBe(false);
    });
  });

  describe("certificate hashing", () => {
    it("is deterministic for identical documents", () => {
      expect(HalalProvenanceEngine.hashCertificate(CERTIFICATE_DOCUMENT)).toBe(
        HalalProvenanceEngine.hashCertificate(CERTIFICATE_DOCUMENT),
      );
    });

    it("changes when a single character of the certificate changes", () => {
      const tampered = CERTIFICATE_DOCUMENT.replace("chicken", "chickeo");
      expect(HalalProvenanceEngine.hashCertificate(tampered)).not.toBe(
        HalalProvenanceEngine.hashCertificate(CERTIFICATE_DOCUMENT),
      );
    });

    it("produces a 32-byte hex digest", () => {
      expect(HalalProvenanceEngine.hashCertificate(CERTIFICATE_DOCUMENT)).toMatch(
        /^0x[0-9a-f]{64}$/,
      );
    });
  });

  describe("board signature verification", () => {
    it("accepts a certificate signed by the accredited board", () => {
      expect(HalalProvenanceEngine.verifySignature(signedSubmission(), BOARDS)).toBe("VALID");
    });

    it("rejects a board that is not in the registry", () => {
      expect(
        HalalProvenanceEngine.verifySignature(
          signedSubmission({ boardId: "self-certified" }),
          BOARDS,
        ),
      ).toBe("UNKNOWN_BOARD");
    });

    it("rejects a Kosher board vouching for a Halal claim", () => {
      expect(
        HalalProvenanceEngine.verifySignature(signedSubmission({ boardId: OU_KOSHER.id }), BOARDS),
      ).toBe("UNKNOWN_BOARD");
    });

    it("rejects a malformed signature", () => {
      expect(
        HalalProvenanceEngine.verifySignature(
          signedSubmission({ boardSignature: "not-hex" }),
          BOARDS,
        ),
      ).toBe("MALFORMED_SIGNATURE");
    });

    it("rejects a signature that does not cover the submitted certificate", () => {
      const submission = signedSubmission();
      const swapped: LotSubmission = {
        ...submission,
        certificateDocument: CERTIFICATE_DOCUMENT.replace("chicken", "beef"),
      };
      expect(HalalProvenanceEngine.verifySignature(swapped, BOARDS)).toBe("SIGNATURE_MISMATCH");
    });

    it("rejects a signature lifted from a different lot", () => {
      const other = signedSubmission({ lotNumber: "LOT-2026-0918-B2" });
      const replay = signedSubmission({ boardSignature: other.boardSignature });
      expect(HalalProvenanceEngine.verifySignature(replay, BOARDS)).toBe("SIGNATURE_MISMATCH");
    });
  });

  describe("record construction", () => {
    it("marks a verified submission ready to anchor", () => {
      const record = HalalProvenanceEngine.buildRecord(signedSubmission(), BOARDS);

      expect(record.status).toBe("PENDING_ANCHOR");
      expect(record.lotNumber).toBe("LOT-2026-0918-A7");
      expect(record.previousHash).toBe(GENESIS_HASH);
      expect(record.entryHash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("marks an unverifiable submission rejected instead of anchoring it", () => {
      const record = HalalProvenanceEngine.buildRecord(
        signedSubmission({ boardId: "self-certified" }),
        BOARDS,
      );

      expect(record.status).toBe("REJECTED");
      expect(() =>
        HalalProvenanceEngine.markAnchored(record, "0xdead", 1, "2026-09-18T00:00:00Z"),
      ).toThrow("A rejected record cannot be anchored");
    });

    it("refuses a lot number that is not in carton format", () => {
      expect(() =>
        HalalProvenanceEngine.buildRecord(signedSubmission({ lotNumber: "BATCH-88" }), BOARDS),
      ).toThrow("Invalid lot number: BATCH-88");
    });
  });

  describe("chain immutability", () => {
    const buildChain = () => {
      const first = HalalProvenanceEngine.buildRecord(signedSubmission(), BOARDS);
      const second = HalalProvenanceEngine.buildRecord(
        signedSubmission({ lotNumber: "LOT-2026-0918-B2" }),
        BOARDS,
        first.entryHash,
      );
      return [first, second];
    };

    it("verifies a chain built in submission order", () => {
      expect(HalalProvenanceEngine.verifyChain(buildChain())).toEqual({
        intact: true,
        brokenAtIndex: null,
        reason: null,
      });
    });

    it("detects an edited record body", () => {
      const chain = buildChain();
      const tampered = [{ ...chain[0], lotNumber: "LOT-2026-0918-Z9" }, chain[1]];

      const result = HalalProvenanceEngine.verifyChain(tampered);
      expect(result.intact).toBe(false);
      expect(result.brokenAtIndex).toBe(0);
      expect(result.reason).toContain("entryHash does not match");
    });

    it("detects a record spliced out of the chain", () => {
      const chain = buildChain();

      const result = HalalProvenanceEngine.verifyChain([chain[1]]);
      expect(result.intact).toBe(false);
      expect(result.brokenAtIndex).toBe(0);
      expect(result.reason).toContain("expected previousHash");
    });

    it("treats an empty ledger as intact", () => {
      expect(HalalProvenanceEngine.verifyChain([]).intact).toBe(true);
    });
  });

  describe("QR payload", () => {
    it("encodes the event and the chain head", () => {
      const payload = HalalProvenanceEngine.buildQrPayload("event-msa-iftar", GENESIS_HASH);

      expect(JSON.parse(payload)).toEqual({
        v: 1,
        event: "event-msa-iftar",
        head: GENESIS_HASH,
      });
    });

    it("builds a scannable URL without duplicating slashes", () => {
      expect(
        HalalProvenanceEngine.buildQrUrl(
          "https://campusconnect.app/",
          "event-msa-iftar",
          GENESIS_HASH,
        ),
      ).toBe(
        `https://campusconnect.app/events/event-msa-iftar/halal-provenance?head=${GENESIS_HASH}`,
      );
    });
  });

  describe("attendee trail", () => {
    it("traces the plate back to the certification board", () => {
      const record = HalalProvenanceEngine.buildRecord(signedSubmission(), BOARDS);
      const trail = HalalProvenanceEngine.buildTrail(record, FACILITY, IFANCA);

      expect(trail.map((step) => step.label)).toEqual([
        "Served at this event",
        "Certificate on file",
        "Processing facility",
        "Certification board",
      ]);
      expect(trail[2].detail).toContain("Crescent Poultry Co.");
      expect(trail[2].detail).toContain("P-31427");
      expect(trail[3].detail).toContain("Islamic Food and Nutrition Council of America");
    });

    it("adds the Polygon anchor once the transaction is mined", () => {
      const record = HalalProvenanceEngine.markAnchored(
        HalalProvenanceEngine.buildRecord(signedSubmission(), BOARDS),
        "0xabc123",
        62_481_902,
        "2026-09-18T17:05:00Z",
      );

      const trail = HalalProvenanceEngine.buildTrail(record, FACILITY, IFANCA);
      const anchor = trail[trail.length - 1];

      expect(anchor.label).toBe("Anchored on Polygon");
      expect(anchor.detail).toContain("62481902");
      expect(anchor.proof).toBe("0xabc123");
    });

    it("flags an unregistered facility or board instead of implying trust", () => {
      const record = HalalProvenanceEngine.buildRecord(signedSubmission(), BOARDS);
      const trail = HalalProvenanceEngine.buildTrail(record, undefined, undefined);

      expect(trail[2].detail).toContain("Unregistered facility");
      expect(trail[3].detail).toContain("Unaccredited board");
    });
  });
});
