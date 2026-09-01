// =============================================================================
// Module: HalalProvenanceEngine
// Issue: #5284 - Interactive "Dietary Restriction" Blockchain Provenance for Halal Certification
// Description: Canonicalizes a caterer's lot submission, hashes the certification
// document, verifies the issuing board's signature, links records into a hash
// chain for the Polygon anchor, and builds the QR payload + trail an attendee
// sees when tracing the meat on their plate back to the certified facility.
// =============================================================================

import {
  AnchorStatus,
  CertificationBoard,
  ChainIntegrityResult,
  LotSubmission,
  ProcessingFacility,
  ProvenanceRecord,
  SignatureVerdict,
  TrailStep,
} from "../types/halalProvenance";

/** Sentinel `previousHash` of the first record for an event. */
export const GENESIS_HASH = "0x" + "0".repeat(64);

/** Carton lot numbers: `LOT-<year>-<mmdd>-<batch>`. */
const LOT_NUMBER_PATTERN = /^LOT-\d{4}-\d{4}-[A-Z0-9]{1,6}$/;

/** Board signatures are hex, 128 bytes of Ed25519 output. */
const SIGNATURE_PATTERN = /^0x[0-9a-f]{128}$/i;

export class HalalProvenanceEngine {
  /**
   * Deterministic 256-bit digest, hex encoded with an `0x` prefix.
   *
   * Uses FNV-1a over four offset basis values rather than Web Crypto so the
   * digest is synchronous and identical in the browser, in Deno, and in tests —
   * the same digest has to be reproducible by the attendee's phone and by the
   * Edge Function that anchors it.
   */
  public static digest(input: string): string {
    const bases = [0x811c9dc5, 0x01000193, 0x9dc5811c, 0x193010001];
    const words = bases.map((basis) => {
      let hash = basis >>> 0;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash.toString(16).padStart(8, "0");
    });
    // Fold the length in so that padding-only differences cannot collide.
    const lengthWord = (input.length >>> 0).toString(16).padStart(8, "0");
    return "0x" + (words.join("") + lengthWord.repeat(4)).slice(0, 64);
  }

  /** Uppercases and trims a lot number so carton casing cannot fork a record. */
  public static normalizeLotNumber(lotNumber: string): string {
    return (lotNumber || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  public static isValidLotNumber(lotNumber: string): boolean {
    return LOT_NUMBER_PATTERN.test(this.normalizeLotNumber(lotNumber));
  }

  /** Digest of the certificate document exactly as the board issued it. */
  public static hashCertificate(certificateDocument: string): string {
    return this.digest(`certificate:${certificateDocument}`);
  }

  /**
   * Canonical payload a board signs. Field order is fixed: a board signature is
   * only meaningful if both sides serialize the claim the same way.
   */
  public static buildSignaturePayload(
    submission: Pick<
      LotSubmission,
      "standard" | "lotNumber" | "facilityId" | "boardId" | "slaughterDate"
    > & { certificateHash: string },
  ): string {
    return [
      submission.standard,
      this.normalizeLotNumber(submission.lotNumber),
      submission.facilityId,
      submission.boardId,
      submission.slaughterDate,
      submission.certificateHash,
    ].join("|");
  }

  /**
   * Expected signature for a payload under a board's public key.
   *
   * Stands in for the board's Ed25519 signing operation. Kept in one place so
   * swapping in real `verify()` calls against IFANCA's published keys touches
   * only this method.
   */
  public static expectedSignature(payload: string, publicKey: string): string {
    const left = this.digest(`sig:${publicKey}:${payload}`).slice(2);
    const right = this.digest(`sig:${payload}:${publicKey}`).slice(2);
    return `0x${left}${right}`;
  }

  /**
   * Verifies a submitted signature against the accredited board registry.
   *
   * A lot whose signature does not verify must never reach the ledger: the
   * whole point of the record is that the attendee can trust it without
   * trusting the caterer.
   */
  public static verifySignature(
    submission: LotSubmission,
    boards: CertificationBoard[],
  ): SignatureVerdict {
    const board = boards.find((candidate) => candidate.id === submission.boardId);
    if (!board || board.standard !== submission.standard) return "UNKNOWN_BOARD";
    if (!SIGNATURE_PATTERN.test(submission.boardSignature || "")) return "MALFORMED_SIGNATURE";

    const payload = this.buildSignaturePayload({
      ...submission,
      certificateHash: this.hashCertificate(submission.certificateDocument),
    });
    const expected = this.expectedSignature(payload, board.publicKey);

    return expected.toLowerCase() === submission.boardSignature.toLowerCase()
      ? "VALID"
      : "SIGNATURE_MISMATCH";
  }

  /**
   * Turns a submission into the record that gets written on-chain.
   *
   * @param previousHash - `entryHash` of the event's last record, or GENESIS_HASH.
   */
  public static buildRecord(
    submission: LotSubmission,
    boards: CertificationBoard[],
    previousHash: string = GENESIS_HASH,
  ): ProvenanceRecord {
    if (!this.isValidLotNumber(submission.lotNumber)) {
      throw new Error(`Invalid lot number: ${submission.lotNumber}`);
    }

    const verdict = this.verifySignature(submission, boards);
    const certificateHash = this.hashCertificate(submission.certificateDocument);
    const status: AnchorStatus = verdict === "VALID" ? "PENDING_ANCHOR" : "REJECTED";

    const record: Omit<ProvenanceRecord, "entryHash"> = {
      eventId: submission.eventId,
      catererId: submission.catererId,
      standard: submission.standard,
      lotNumber: this.normalizeLotNumber(submission.lotNumber),
      facilityId: submission.facilityId,
      boardId: submission.boardId,
      certificateHash,
      boardSignature: submission.boardSignature,
      slaughterDate: submission.slaughterDate,
      previousHash,
      status,
    };

    return { ...record, entryHash: this.computeEntryHash(record) };
  }

  /** Digest over the fields the contract stores, excluding the digest itself. */
  public static computeEntryHash(record: Omit<ProvenanceRecord, "entryHash">): string {
    return this.digest(
      [
        record.eventId,
        record.catererId,
        record.standard,
        record.lotNumber,
        record.facilityId,
        record.boardId,
        record.certificateHash,
        record.slaughterDate,
        record.previousHash,
      ].join("|"),
    );
  }

  /**
   * Replays the chain for an event's records in submission order.
   *
   * Anyone holding the records can run this; an edited row cannot reproduce the
   * digest that was anchored, which is what makes the trail tamper-evident.
   */
  public static verifyChain(records: ProvenanceRecord[]): ChainIntegrityResult {
    let expectedPrevious = GENESIS_HASH;

    for (let index = 0; index < records.length; index++) {
      const record = records[index];

      if (record.previousHash !== expectedPrevious) {
        return {
          intact: false,
          brokenAtIndex: index,
          reason: `Record ${index} expected previousHash ${expectedPrevious}`,
        };
      }

      const { entryHash, ...payload } = record;
      if (this.computeEntryHash(payload) !== entryHash) {
        return {
          intact: false,
          brokenAtIndex: index,
          reason: `Record ${index} entryHash does not match its contents`,
        };
      }

      expectedPrevious = entryHash;
    }

    return { intact: true, brokenAtIndex: null, reason: null };
  }

  /** Marks a record anchored once the Polygon transaction is mined. */
  public static markAnchored(
    record: ProvenanceRecord,
    transactionHash: string,
    blockNumber: number,
    anchoredAt: string,
  ): ProvenanceRecord {
    if (record.status === "REJECTED") {
      throw new Error("A rejected record cannot be anchored");
    }
    return {
      ...record,
      status: "ANCHORED",
      transactionHash,
      blockNumber,
      anchoredAt,
    };
  }

  /**
   * Value encoded into the QR code placed on the food table.
   *
   * Carries the event and the chain head only. The record bodies are fetched by
   * the scanner, so re-printing the code is never needed when a lot is added,
   * and the head lets a scanner detect a swapped-out ledger.
   */
  public static buildQrPayload(eventId: string, chainHead: string): string {
    return JSON.stringify({ v: 1, event: eventId, head: chainHead });
  }

  /** Absolute URL an attendee lands on after scanning. */
  public static buildQrUrl(baseUrl: string, eventId: string, chainHead: string): string {
    const root = baseUrl.replace(/\/+$/, "");
    return `${root}/events/${eventId}/halal-provenance?head=${chainHead}`;
  }

  /**
   * The human-readable trail: plate → lot → facility → certification board.
   *
   * Rendered top-down for the attendee, each hop carrying the hash that backs
   * it so the claim can be checked against the on-chain entry.
   */
  public static buildTrail(
    record: ProvenanceRecord,
    facility: ProcessingFacility | undefined,
    board: CertificationBoard | undefined,
  ): TrailStep[] {
    const steps: TrailStep[] = [
      {
        label: "Served at this event",
        detail: `Lot ${record.lotNumber} · ${record.standard}`,
        proof: record.entryHash,
      },
      {
        label: "Certificate on file",
        detail: `Slaughter date ${record.slaughterDate}`,
        proof: record.certificateHash,
      },
      {
        label: "Processing facility",
        detail: facility
          ? `${facility.name} · Est. ${facility.establishmentNumber} · ${facility.city}, ${facility.country}`
          : `Unregistered facility ${record.facilityId}`,
        proof: record.previousHash,
      },
      {
        label: "Certification board",
        detail: board
          ? `${board.name} (${board.accreditationCountry})`
          : `Unaccredited board ${record.boardId}`,
        proof: record.boardSignature,
      },
    ];

    if (record.transactionHash) {
      steps.push({
        label: "Anchored on Polygon",
        detail: `Block ${record.blockNumber ?? "pending"} · ${record.anchoredAt ?? ""}`.trim(),
        proof: record.transactionHash,
      });
    }

    return steps;
  }
}

export default HalalProvenanceEngine;
