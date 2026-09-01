// =============================================================================
// Types: Halal/Kosher Provenance Ledger
// Issue: #5284 - Interactive "Dietary Restriction" Blockchain Provenance for Halal Certification
// Description: Domain types for lot-level meat provenance anchored to Polygon and
// traced back to an accredited religious certification board (IFANCA, OU, etc.).
// =============================================================================

/** Religious certification standard a lot is claimed to satisfy. */
export type DietaryStandard = "HALAL" | "KOSHER";

/** Lifecycle of a provenance record on its way to the immutable ledger. */
export type AnchorStatus = "DRAFT" | "PENDING_ANCHOR" | "ANCHORED" | "REJECTED";

/** Outcome of verifying a submitted certificate against a board's public key. */
export type SignatureVerdict =
  "VALID" | "UNKNOWN_BOARD" | "SIGNATURE_MISMATCH" | "MALFORMED_SIGNATURE";

/** An accredited certification board whose signatures the ledger accepts. */
export interface CertificationBoard {
  /** Stable slug used as the on-chain board identifier, e.g. `ifanca`. */
  id: string;
  name: string;
  standard: DietaryStandard;
  /** Board's Ed25519/secp256k1 public key, hex encoded. */
  publicKey: string;
  accreditationCountry: string;
}

/** Slaughterhouse / processing facility certified by a board. */
export interface ProcessingFacility {
  id: string;
  name: string;
  /** Government establishment number, e.g. USDA `P-1234`. */
  establishmentNumber: string;
  city: string;
  country: string;
  certifiedBy: string;
}

/** What a caterer submits for a single lot of meat. */
export interface LotSubmission {
  eventId: string;
  catererId: string;
  standard: DietaryStandard;
  /** Lot number printed on the carton, e.g. `LOT-2026-0918-A7`. */
  lotNumber: string;
  facilityId: string;
  boardId: string;
  /** Raw certificate document bytes as text (PDF/JSON export from the board). */
  certificateDocument: string;
  /** Board signature over the canonical certificate payload, hex encoded. */
  boardSignature: string;
  slaughterDate: string;
}

/** A submission that has been canonicalized and is ready to anchor. */
export interface ProvenanceRecord {
  eventId: string;
  catererId: string;
  standard: DietaryStandard;
  lotNumber: string;
  facilityId: string;
  boardId: string;
  /** SHA-256-style digest of the certificate document, `0x`-prefixed. */
  certificateHash: string;
  boardSignature: string;
  slaughterDate: string;
  /** Digest of the previous ledger entry, linking records into a chain. */
  previousHash: string;
  /** Digest of this entry, computed over its canonical payload. */
  entryHash: string;
  status: AnchorStatus;
  /** Polygon transaction hash, present once anchored. */
  transactionHash?: string;
  blockNumber?: number;
  anchoredAt?: string;
}

/** One hop shown to an attendee scanning the QR code. */
export interface TrailStep {
  label: string;
  detail: string;
  /** Hash proving this hop, shown so the attendee can compare with the chain. */
  proof: string;
}

/** Result of replaying the hash chain for an event's records. */
export interface ChainIntegrityResult {
  intact: boolean;
  /** Index of the first record whose links do not reproduce, or `null`. */
  brokenAtIndex: number | null;
  reason: string | null;
}
