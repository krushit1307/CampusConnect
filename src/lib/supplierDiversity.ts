// =============================================================================
// Supplier Diversity (MWBE) Compliance (#5291)
// Matches a vendor's EIN/name against the state's official MWBE directory at
// onboarding, turns a directory hit into a verifiable badge, boosts certified
// vendors in organizer search, and aggregates escrow payouts into the
// minority/women-owned spend ratio the federal grant is conditioned on.
// =============================================================================

/** Ownership classes the state directory certifies. */
export type MwbeCategory =
  "MINORITY_OWNED" | "WOMEN_OWNED" | "MINORITY_WOMEN_OWNED" | "DISADVANTAGED";

/** Outcome of a directory lookup. Only VERIFIED counts toward the mandate. */
export type CertificationStatus = "VERIFIED" | "EXPIRED" | "NOT_FOUND" | "INVALID_EIN";

/** How the directory row was matched, which is what an auditor asks about. */
export type MatchMethod = "EIN" | "LEGAL_NAME" | "NONE";

/** A row as published by the state MWBE directory. */
export interface MwbeDirectoryEntry {
  certificateNumber: string;
  legalName: string;
  /** Federal EIN, `XX-XXXXXXX`. */
  ein: string;
  category: MwbeCategory;
  issuingRegistry: string;
  /** ISO date the certificate lapses. */
  expiresOn: string;
}

/** What the platform knows about a vendor when onboarding them. */
export interface VendorIdentity {
  vendorId: string;
  legalName: string;
  ein: string;
}

/** Verified certification stored against the vendor profile. */
export interface MwbeCertification {
  vendorId: string;
  status: CertificationStatus;
  certified: boolean;
  category: MwbeCategory | null;
  certificateNumber: string | null;
  issuingRegistry: string | null;
  expiresOn: string | null;
  matchMethod: MatchMethod;
  /** Audit sentence explaining why the badge was or was not granted. */
  evidence: string;
  verifiedAt: string;
}

/** A vendor as listed in organizer search results. */
export interface VendorSearchCandidate {
  vendorId: string;
  legalName: string;
  category?: MwbeCategory | null;
  mwbeCertified: boolean;
  /** Existing relevance from the search backend; higher is better. */
  relevanceScore: number;
  averageRating?: number;
}

/** One released escrow payout, i.e. money that has actually left the university. */
export interface EscrowPayout {
  contractId: string;
  vendorId: string;
  vendorName: string;
  amountUsd: number;
  releasedAt: string;
  mwbeCertified: boolean;
  category?: MwbeCategory | null;
}

export type ComplianceVerdict = "ACHIEVED" | "AT_RISK" | "NON_COMPLIANT";

/** Aggregate report for the Dean, in the shape #5291 asks for. */
export interface DiversitySpendReport {
  totalSpendUsd: number;
  mwbeSpendUsd: number;
  /** MWBE share of total spend, as a percentage rounded to one decimal. */
  mwbePercent: number;
  mandatePercent: number;
  verdict: ComplianceVerdict;
  /** Additional MWBE spend needed to reach the mandate, in dollars. */
  shortfallUsd: number;
  payoutCount: number;
  mwbePayoutCount: number;
  spendByCategoryUsd: Record<MwbeCategory, number>;
  /** Headline line for the dashboard, e.g. the sentence quoted in the issue. */
  headline: string;
}

/** Federal grant floor: 15% of campus spending must go to MWBE suppliers. */
export const MWBE_MANDATE_PERCENT = 15;

/**
 * Margin under which the mandate is met but not comfortably.
 *
 * A report that flips between "Achieved" and "Non-compliant" on a single invoice
 * gives the Dean no warning, so the band between the mandate and one point above
 * it reports AT_RISK.
 */
export const MWBE_AT_RISK_MARGIN_PERCENT = 1;

const EIN_PATTERN = /^\d{2}-\d{7}$/;

const round2 = (value: number): number => Math.round(value * 100) / 100;

const EMPTY_CATEGORY_SPEND = (): Record<MwbeCategory, number> => ({
  MINORITY_OWNED: 0,
  WOMEN_OWNED: 0,
  MINORITY_WOMEN_OWNED: 0,
  DISADVANTAGED: 0,
});

/** Formats digits as a federal EIN, so `123456789` and `12-3456789` agree. */
export function normalizeEin(ein: string): string {
  const digits = (ein || "").replace(/\D/g, "");
  if (digits.length !== 9) return "";
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function isValidEin(ein: string): boolean {
  return EIN_PATTERN.test(normalizeEin(ein));
}

/**
 * Canonical form for name comparison.
 *
 * Strips punctuation and the corporate suffixes vendors write inconsistently, so
 * "Rivera & Daughters Catering, LLC." and "Rivera and Daughters Catering LLC"
 * resolve to the same directory row.
 */
export function normalizeBusinessName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(llc|l l c|inc|incorporated|corp|corporation|co|company|ltd|limited|lp|llp)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the certificate is still in force on `asOf`. */
export function isCertificateActive(entry: MwbeDirectoryEntry, asOf: Date = new Date()): boolean {
  const expiry = Date.parse(entry.expiresOn);
  if (Number.isNaN(expiry)) return false;
  return expiry >= asOf.getTime();
}

/**
 * Finds the directory row for a vendor.
 *
 * EIN is tried first and wins outright: two businesses can share a trading name,
 * but an EIN identifies one taxpayer, and a badge attached to the wrong vendor is
 * a false compliance claim rather than a cosmetic bug.
 */
export function matchDirectoryEntry(
  identity: VendorIdentity,
  directory: MwbeDirectoryEntry[],
): { entry: MwbeDirectoryEntry | null; method: MatchMethod } {
  const ein = normalizeEin(identity.ein);
  if (ein) {
    const byEin = directory.find((entry) => normalizeEin(entry.ein) === ein);
    if (byEin) return { entry: byEin, method: "EIN" };
  }

  const name = normalizeBusinessName(identity.legalName);
  if (name) {
    const byName = directory.filter((entry) => normalizeBusinessName(entry.legalName) === name);
    // An ambiguous name match is no match: picking one of two identically named
    // businesses would certify a vendor the state never certified.
    if (byName.length === 1) return { entry: byName[0], method: "LEGAL_NAME" };
  }

  return { entry: null, method: "NONE" };
}

/**
 * Resolves a vendor's certification against the directory at onboarding.
 *
 * @param asOf - Evaluation date, so an expired certificate is reported as EXPIRED
 *               rather than silently counted toward the mandate.
 */
export function certifyVendor(
  identity: VendorIdentity,
  directory: MwbeDirectoryEntry[],
  asOf: Date = new Date(),
): MwbeCertification {
  const verifiedAt = asOf.toISOString();

  if (!isValidEin(identity.ein)) {
    return {
      vendorId: identity.vendorId,
      status: "INVALID_EIN",
      certified: false,
      category: null,
      certificateNumber: null,
      issuingRegistry: null,
      expiresOn: null,
      matchMethod: "NONE",
      evidence: `EIN "${identity.ein}" is not a valid federal EIN (XX-XXXXXXX), so the directory could not be queried.`,
      verifiedAt,
    };
  }

  const { entry, method } = matchDirectoryEntry(identity, directory);

  if (!entry) {
    return {
      vendorId: identity.vendorId,
      status: "NOT_FOUND",
      certified: false,
      category: null,
      certificateNumber: null,
      issuingRegistry: null,
      expiresOn: null,
      matchMethod: "NONE",
      evidence: `No MWBE directory record matched EIN ${normalizeEin(identity.ein)} or legal name "${identity.legalName}".`,
      verifiedAt,
    };
  }

  const active = isCertificateActive(entry, asOf);

  return {
    vendorId: identity.vendorId,
    status: active ? "VERIFIED" : "EXPIRED",
    certified: active,
    category: entry.category,
    certificateNumber: entry.certificateNumber,
    issuingRegistry: entry.issuingRegistry,
    expiresOn: entry.expiresOn,
    matchMethod: method,
    evidence: active
      ? `Matched by ${method === "EIN" ? "EIN" : "legal name"} to ${entry.issuingRegistry} certificate ${entry.certificateNumber}, valid to ${entry.expiresOn}.`
      : `${entry.issuingRegistry} certificate ${entry.certificateNumber} expired on ${entry.expiresOn}; the vendor must recertify before the badge is restored.`,
    verifiedAt,
  };
}

/**
 * Orders organizer search results with certified vendors first.
 *
 * Boosting is a reordering, never a filter: a non-certified vendor stays visible
 * and reachable, because the mandate is a spending target and not a procurement
 * ban. Ties keep the backend's relevance order, then rating, then name, so the
 * list is stable between renders.
 */
export function rankVendorSearchResults(
  candidates: VendorSearchCandidate[],
): VendorSearchCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.mwbeCertified !== b.mwbeCertified) return a.mwbeCertified ? -1 : 1;
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if ((b.averageRating ?? 0) !== (a.averageRating ?? 0)) {
      return (b.averageRating ?? 0) - (a.averageRating ?? 0);
    }
    return a.legalName.localeCompare(b.legalName);
  });
}

/** Human label for a badge, used by search results and the compliance report. */
export function describeCategory(category: MwbeCategory | null | undefined): string {
  switch (category) {
    case "MINORITY_OWNED":
      return "Minority-Owned";
    case "WOMEN_OWNED":
      return "Women-Owned";
    case "MINORITY_WOMEN_OWNED":
      return "Minority & Women-Owned";
    case "DISADVANTAGED":
      return "Disadvantaged Business";
    default:
      return "Not certified";
  }
}

/**
 * Aggregates released escrow payouts into the report the Dean asked for.
 *
 * Only released payouts count. Contracted-but-unpaid money would let the
 * university report compliance on spending it has not made, which is exactly the
 * claim a grant audit tests.
 */
export function buildDiversitySpendReport(
  payouts: EscrowPayout[],
  mandatePercent: number = MWBE_MANDATE_PERCENT,
): DiversitySpendReport {
  const rows = (Array.isArray(payouts) ? payouts : []).filter(
    (payout) => Number(payout.amountUsd) > 0,
  );

  const totalSpendUsd = round2(rows.reduce((total, payout) => total + Number(payout.amountUsd), 0));
  const mwbeRows = rows.filter((payout) => payout.mwbeCertified);
  const mwbeSpendUsd = round2(
    mwbeRows.reduce((total, payout) => total + Number(payout.amountUsd), 0),
  );

  const spendByCategoryUsd = EMPTY_CATEGORY_SPEND();
  for (const payout of mwbeRows) {
    if (payout.category) {
      spendByCategoryUsd[payout.category] = round2(
        spendByCategoryUsd[payout.category] + Number(payout.amountUsd),
      );
    }
  }

  const mwbePercent =
    totalSpendUsd > 0 ? Math.round((mwbeSpendUsd / totalSpendUsd) * 1000) / 10 : 0;
  const requiredUsd = round2((totalSpendUsd * mandatePercent) / 100);
  const shortfallUsd = round2(Math.max(0, requiredUsd - mwbeSpendUsd));

  let verdict: ComplianceVerdict;
  if (mwbePercent < mandatePercent) verdict = "NON_COMPLIANT";
  else if (mwbePercent < mandatePercent + MWBE_AT_RISK_MARGIN_PERCENT) verdict = "AT_RISK";
  else verdict = "ACHIEVED";

  const verdictLabel =
    verdict === "ACHIEVED" ? "Achieved" : verdict === "AT_RISK" ? "At risk" : "Not met";

  return {
    totalSpendUsd,
    mwbeSpendUsd,
    mwbePercent,
    mandatePercent,
    verdict,
    shortfallUsd,
    payoutCount: rows.length,
    mwbePayoutCount: mwbeRows.length,
    spendByCategoryUsd,
    headline:
      `Total Spend: $${totalSpendUsd.toLocaleString("en-US")}. ` +
      `MWBE Spend: $${mwbeSpendUsd.toLocaleString("en-US")} (${mwbePercent}%). ` +
      `Federal Compliance: ${verdictLabel}.`,
  };
}
