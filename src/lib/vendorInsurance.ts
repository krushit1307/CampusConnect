/**
 * Vendor Certificate of Insurance compliance (#3397).
 *
 * `vendorMarketplace.ts` approves vendors into a directory and hands them a
 * storefront. Nothing asks them for proof of insurance, which is the single
 * most common reason a campus event is stopped by risk management on the
 * morning of.
 *
 * The check has four parts, and a certificate can fail any of them
 * independently:
 *
 *   1. coverage limits, which differ by what the vendor is actually doing —
 *      a photographer and a propane food truck are not the same exposure;
 *   2. the policy period, which must cover load-in and teardown and not just
 *      the published event hours;
 *   3. endorsements — naming the institution as additional insured is a
 *      specific endorsement, not something implied by having a policy at all;
 *   4. expiry, since a certificate accepted in March lapses before a
 *      September event and nobody re-reads it.
 *
 * Limits are whole dollars. Every function is pure with the clock injected so
 * policy-period arithmetic is testable.
 */

export type CoverageLine =
  "GENERAL_LIABILITY" | "AUTO_LIABILITY" | "WORKERS_COMP" | "LIQUOR_LIABILITY" | "UMBRELLA_EXCESS";

export type VendorCategory =
  | "PHOTOGRAPHY_MEDIA"
  | "PERFORMER"
  | "EQUIPMENT_RENTAL"
  | "CATERING_COLD"
  | "CATERING_HOT_FOOD"
  | "FOOD_TRUCK_PROPANE"
  | "AMUSEMENT_INFLATABLE"
  | "ALCOHOL_SERVICE";

export type Endorsement =
  "ADDITIONAL_INSURED" | "WAIVER_OF_SUBROGATION" | "PRIMARY_NON_CONTRIBUTORY";

export type ComplianceStatus =
  | "COMPLIANT"
  | "NO_CERTIFICATE"
  | "EXPIRED"
  | "NOT_YET_EFFECTIVE"
  | "LAPSES_BEFORE_EVENT"
  | "INSUFFICIENT_COVERAGE"
  | "MISSING_ENDORSEMENT";

export interface CategoryRequirement {
  category: VendorCategory;
  label: string;
  /** Required per-occurrence limit for each line the category demands. */
  limits: Partial<Record<CoverageLine, number>>;
  endorsements: ReadonlyArray<Endorsement>;
  /** Why the limit is what it is, surfaced to the officer chasing the vendor. */
  rationale: string;
}

/**
 * Minimums by risk category.
 *
 * A flat threshold across all vendors is wrong in both directions: it prices a
 * student photographer out of working with clubs while being nowhere near
 * enough for an inflatable operator. These are the figures institutions
 * commonly ask for; they are configuration, not physics, and the whole table
 * is exported so a campus can substitute its own.
 */
export const CATEGORY_REQUIREMENTS: Record<VendorCategory, CategoryRequirement> = {
  PHOTOGRAPHY_MEDIA: {
    category: "PHOTOGRAPHY_MEDIA",
    label: "Photography / videography",
    limits: { GENERAL_LIABILITY: 1_000_000 },
    endorsements: ["ADDITIONAL_INSURED"],
    rationale: "Low physical exposure; the risk is trip hazards from cabling and equipment.",
  },
  PERFORMER: {
    category: "PERFORMER",
    label: "Performer / DJ / band",
    limits: { GENERAL_LIABILITY: 1_000_000 },
    endorsements: ["ADDITIONAL_INSURED"],
    rationale: "Rigging, staging and crowd interaction at ground level.",
  },
  EQUIPMENT_RENTAL: {
    category: "EQUIPMENT_RENTAL",
    label: "Equipment rental / staging",
    limits: { GENERAL_LIABILITY: 1_000_000, AUTO_LIABILITY: 1_000_000 },
    endorsements: ["ADDITIONAL_INSURED", "WAIVER_OF_SUBROGATION"],
    rationale: "Equipment is delivered by vehicle and erected on campus by the vendor's crew.",
  },
  CATERING_COLD: {
    category: "CATERING_COLD",
    label: "Catering (no on-site cooking)",
    limits: { GENERAL_LIABILITY: 1_000_000, AUTO_LIABILITY: 500_000 },
    endorsements: ["ADDITIONAL_INSURED"],
    rationale: "Food-borne illness exposure without an open flame on site.",
  },
  CATERING_HOT_FOOD: {
    category: "CATERING_HOT_FOOD",
    label: "Catering with on-site cooking",
    limits: { GENERAL_LIABILITY: 2_000_000, AUTO_LIABILITY: 1_000_000, WORKERS_COMP: 500_000 },
    endorsements: ["ADDITIONAL_INSURED", "WAIVER_OF_SUBROGATION"],
    rationale: "Open flame and hot surfaces in a space not designed as a kitchen.",
  },
  FOOD_TRUCK_PROPANE: {
    category: "FOOD_TRUCK_PROPANE",
    label: "Food truck (propane)",
    limits: { GENERAL_LIABILITY: 2_000_000, AUTO_LIABILITY: 1_000_000, WORKERS_COMP: 500_000 },
    endorsements: ["ADDITIONAL_INSURED", "WAIVER_OF_SUBROGATION"],
    rationale: "A pressurised fuel cylinder inside a vehicle parked among pedestrians.",
  },
  AMUSEMENT_INFLATABLE: {
    category: "AMUSEMENT_INFLATABLE",
    label: "Amusement / inflatable / climbing",
    limits: { GENERAL_LIABILITY: 5_000_000, AUTO_LIABILITY: 1_000_000, WORKERS_COMP: 500_000 },
    endorsements: ["ADDITIONAL_INSURED", "WAIVER_OF_SUBROGATION", "PRIMARY_NON_CONTRIBUTORY"],
    rationale: "Falls from height and entrapment; the highest-severity claims on campus.",
  },
  ALCOHOL_SERVICE: {
    category: "ALCOHOL_SERVICE",
    label: "Alcohol service",
    limits: { GENERAL_LIABILITY: 2_000_000, LIQUOR_LIABILITY: 2_000_000 },
    endorsements: ["ADDITIONAL_INSURED", "PRIMARY_NON_CONTRIBUTORY"],
    rationale: "Dram-shop liability is excluded from a standard general liability policy.",
  },
};

export const ALL_COVERAGE_LINES: ReadonlyArray<CoverageLine> = [
  "GENERAL_LIABILITY",
  "AUTO_LIABILITY",
  "WORKERS_COMP",
  "LIQUOR_LIABILITY",
  "UMBRELLA_EXCESS",
];

/**
 * Lines an excess/umbrella policy sits above.
 *
 * Workers' compensation is statutory and is deliberately excluded: an umbrella
 * does not top up a statutory benefit, and pretending otherwise would pass a
 * vendor who is not actually covered.
 */
export const UMBRELLA_APPLIES_TO: ReadonlyArray<CoverageLine> = [
  "GENERAL_LIABILITY",
  "AUTO_LIABILITY",
  "LIQUOR_LIABILITY",
];

export interface InsuranceCertificate {
  id: string;
  vendorId: string;
  issuer: string;
  policyNumber: string;
  /** Per-occurrence limits in whole dollars. An absent line means no cover. */
  limits: Partial<Record<CoverageLine, number>>;
  endorsements: ReadonlyArray<Endorsement>;
  effectiveFrom: string;
  effectiveUntil: string;
  /** Who accepted it and when, for the audit trail. */
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

export interface EventWindow {
  eventId: string;
  startsAt: string;
  endsAt: string;
  /** Hours before the start when the vendor is already on site. */
  loadInHours?: number;
  /** Hours after the end before the vendor is gone. */
  teardownHours?: number;
}

export interface CoverageFinding {
  line: CoverageLine;
  required: number;
  /** What the certificate provides for this line once the umbrella is applied. */
  provided: number;
  /** Limit on the primary policy alone, before any umbrella. */
  primary: number;
  shortfall: number;
  satisfied: boolean;
}

export interface ComplianceResult {
  status: ComplianceStatus;
  compliant: boolean;
  vendorId: string;
  findings: CoverageFinding[];
  missingEndorsements: Endorsement[];
  /** The interval the vendor is actually on site, which is wider than the event. */
  operationalWindow: { from: string; to: string };
  reasons: string[];
}

const MS_PER_HOUR = 3_600_000;

function toTime(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
}

function formatDollars(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/**
 * Merges the requirements of everything a vendor is doing.
 *
 * A caterer who also runs a bar is held to the higher of the two on every
 * shared line and to the union of the endorsements. Taking the first matching
 * category instead would let a vendor pick the cheapest hat they are wearing.
 */
export function requirementsFor(categories: ReadonlyArray<VendorCategory>): {
  limits: Partial<Record<CoverageLine, number>>;
  endorsements: Endorsement[];
} {
  const limits: Partial<Record<CoverageLine, number>> = {};
  const endorsements = new Set<Endorsement>();

  for (const category of categories) {
    const requirement = CATEGORY_REQUIREMENTS[category];
    if (!requirement) continue;

    for (const line of ALL_COVERAGE_LINES) {
      const required = requirement.limits[line];
      if (required === undefined) continue;
      limits[line] = Math.max(limits[line] ?? 0, required);
    }

    for (const endorsement of requirement.endorsements) {
      endorsements.add(endorsement);
    }
  }

  return { limits, endorsements: [...endorsements].sort() };
}

/**
 * Coverage available per line once an excess policy is taken into account.
 *
 * A vendor carrying $1M primary and a $4M umbrella genuinely has $5M available
 * for a general liability claim. Testing each line in isolation would reject
 * them, which is a false negative that teaches clubs to work around the check.
 */
export function effectiveCoverage(
  certificate: InsuranceCertificate,
): Partial<Record<CoverageLine, number>> {
  const umbrella = certificate.limits.UMBRELLA_EXCESS ?? 0;
  const effective: Partial<Record<CoverageLine, number>> = {};

  for (const line of ALL_COVERAGE_LINES) {
    const primary = certificate.limits[line] ?? 0;

    if (line === "UMBRELLA_EXCESS") {
      effective[line] = primary;
      continue;
    }

    // An umbrella sits *above* an underlying policy. With no primary cover on
    // a line there is nothing for it to sit above, so it must not be counted.
    const applies = UMBRELLA_APPLIES_TO.includes(line) && primary > 0;
    effective[line] = applies ? primary + umbrella : primary;
  }

  return effective;
}

/**
 * The interval the vendor is actually on campus.
 *
 * Load-in the night before and teardown the following morning are inside the
 * university's exposure and outside the published event hours. A certificate
 * lapsing at midnight on the event day does not cover the 6am teardown, and
 * that is a real gap rather than a technicality.
 */
export function operationalWindow(event: EventWindow): { from: string; to: string } {
  const loadIn = event.loadInHours ?? 12;
  const teardown = event.teardownHours ?? 12;

  return {
    from: new Date(toTime(event.startsAt) - loadIn * MS_PER_HOUR).toISOString(),
    to: new Date(toTime(event.endsAt) + teardown * MS_PER_HOUR).toISOString(),
  };
}

function coverageFindings(
  certificate: InsuranceCertificate,
  required: Partial<Record<CoverageLine, number>>,
): CoverageFinding[] {
  const effective = effectiveCoverage(certificate);

  return ALL_COVERAGE_LINES.filter((line) => (required[line] ?? 0) > 0).map((line) => {
    const requiredAmount = required[line] ?? 0;
    const provided = effective[line] ?? 0;

    return {
      line,
      required: requiredAmount,
      provided,
      primary: certificate.limits[line] ?? 0,
      shortfall: Math.max(0, requiredAmount - provided),
      satisfied: provided >= requiredAmount,
    };
  });
}

/**
 * Evaluates a certificate against what the vendor is doing and when.
 *
 * Failures are reported per line and per endorsement rather than as a single
 * "non-compliant", because a student officer cannot act on the latter but can
 * act on "auto liability is $500,000 and a food truck needs $1,000,000".
 */
export function evaluateCertificate(params: {
  certificate: InsuranceCertificate | null;
  categories: ReadonlyArray<VendorCategory>;
  event: EventWindow;
  vendorId: string;
  /** ISO timestamp used as "now". Injected so expiry is testable. */
  now: string;
}): ComplianceResult {
  const { certificate, categories, event, vendorId, now } = params;
  const window = operationalWindow(event);
  const { limits: requiredLimits, endorsements: requiredEndorsements } =
    requirementsFor(categories);

  if (!certificate) {
    return {
      status: "NO_CERTIFICATE",
      compliant: false,
      vendorId,
      findings: [],
      missingEndorsements: [...requiredEndorsements],
      operationalWindow: window,
      reasons: ["No certificate of insurance is on file for this vendor."],
    };
  }

  const findings = coverageFindings(certificate, requiredLimits);
  const missingEndorsements = requiredEndorsements.filter(
    (endorsement) => !certificate.endorsements.includes(endorsement),
  );

  const nowMs = toTime(now);
  const fromMs = toTime(certificate.effectiveFrom);
  const untilMs = toTime(certificate.effectiveUntil);
  const windowFrom = toTime(window.from);
  const windowTo = toTime(window.to);

  const reasons: string[] = [];

  // Already lapsed. Reported ahead of everything else because it is the state
  // a certificate silently drifts into after being accepted months earlier.
  if (untilMs <= nowMs) {
    reasons.push(
      `Policy ${certificate.policyNumber} expired on ${certificate.effectiveUntil} and is no longer evidence of anything.`,
    );
    return {
      status: "EXPIRED",
      compliant: false,
      vendorId,
      findings,
      missingEndorsements,
      operationalWindow: window,
      reasons,
    };
  }

  if (fromMs > windowFrom) {
    reasons.push(
      `Cover does not begin until ${certificate.effectiveFrom}, after the vendor is due on site at ${window.from}.`,
    );
    return {
      status: "NOT_YET_EFFECTIVE",
      compliant: false,
      vendorId,
      findings,
      missingEndorsements,
      operationalWindow: window,
      reasons,
    };
  }

  if (untilMs < windowTo) {
    reasons.push(
      `Cover ends ${certificate.effectiveUntil}, before teardown completes at ${window.to}.`,
    );
    return {
      status: "LAPSES_BEFORE_EVENT",
      compliant: false,
      vendorId,
      findings,
      missingEndorsements,
      operationalWindow: window,
      reasons,
    };
  }

  const deficient = findings.filter((finding) => !finding.satisfied);
  if (deficient.length > 0) {
    for (const finding of deficient) {
      reasons.push(
        `${finding.line.replace(/_/g, " ").toLowerCase()} is ${formatDollars(finding.provided)}; ` +
          `this vendor requires ${formatDollars(finding.required)} ` +
          `(short by ${formatDollars(finding.shortfall)}).`,
      );
    }
    return {
      status: "INSUFFICIENT_COVERAGE",
      compliant: false,
      vendorId,
      findings,
      missingEndorsements,
      operationalWindow: window,
      reasons,
    };
  }

  if (missingEndorsements.length > 0) {
    for (const endorsement of missingEndorsements) {
      reasons.push(
        `The certificate does not carry the ${endorsement.replace(/_/g, " ").toLowerCase()} endorsement.`,
      );
    }
    return {
      status: "MISSING_ENDORSEMENT",
      compliant: false,
      vendorId,
      findings,
      missingEndorsements,
      operationalWindow: window,
      reasons,
    };
  }

  return {
    status: "COMPLIANT",
    compliant: true,
    vendorId,
    findings,
    missingEndorsements: [],
    operationalWindow: window,
    reasons: [],
  };
}

/**
 * The gate itself, for the vendor confirmation path.
 *
 * Returns a refusal rather than a warning. A warning gets clicked past, and
 * the whole point is that this one should not be.
 */
export function canConfirmVendor(params: {
  certificate: InsuranceCertificate | null;
  categories: ReadonlyArray<VendorCategory>;
  event: EventWindow;
  vendorId: string;
  now: string;
}): { allowed: boolean; status: ComplianceStatus; reasons: string[] } {
  const result = evaluateCertificate(params);
  return { allowed: result.compliant, status: result.status, reasons: result.reasons };
}

export interface ExpiringCertificate {
  certificate: InsuranceCertificate;
  expiresAt: string;
  daysRemaining: number;
}

/**
 * Certificates lapsing inside the given window, most urgent first.
 *
 * Approving a vendor in March for a September event is normal, and so is the
 * policy renewing in July. Without this the gap is only discovered by the
 * check failing on the day.
 */
export function findExpiringCertificates(
  certificates: InsuranceCertificate[],
  now: string,
  withinDays = 45,
): ExpiringCertificate[] {
  const nowMs = toTime(now);
  const horizon = nowMs + withinDays * 24 * MS_PER_HOUR;

  return certificates
    .filter((certificate) => {
      const untilMs = toTime(certificate.effectiveUntil);
      return !Number.isNaN(untilMs) && untilMs > nowMs && untilMs <= horizon;
    })
    .map((certificate) => ({
      certificate,
      expiresAt: certificate.effectiveUntil,
      daysRemaining: Math.floor((toTime(certificate.effectiveUntil) - nowMs) / (24 * MS_PER_HOUR)),
    }))
    .sort(
      (a, b) =>
        toTime(a.expiresAt) - toTime(b.expiresAt) ||
        a.certificate.id.localeCompare(b.certificate.id),
    );
}

export interface VendorBooking {
  vendorId: string;
  categories: ReadonlyArray<VendorCategory>;
  certificate: InsuranceCertificate | null;
}

/**
 * Every vendor on one event, so an organiser sees the whole picture at once
 * rather than discovering the blockers one confirmation at a time.
 */
export function auditEventVendors(
  bookings: ReadonlyArray<VendorBooking>,
  event: EventWindow,
  now: string,
): { results: ComplianceResult[]; blocking: ComplianceResult[]; allClear: boolean } {
  const results = bookings
    .map((booking) =>
      evaluateCertificate({
        certificate: booking.certificate,
        categories: booking.categories,
        event,
        vendorId: booking.vendorId,
        now,
      }),
    )
    .sort((a, b) => a.vendorId.localeCompare(b.vendorId));

  const blocking = results.filter((result) => !result.compliant);

  return { results, blocking, allClear: blocking.length === 0 };
}
