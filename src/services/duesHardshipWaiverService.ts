/**
 * Module: Club Dues Hardship Waiver & Sliding-Scale Assessment
 * File: src/services/duesHardshipWaiverService.ts
 * Scope: Lets a student request a dues reduction on ability-to-pay grounds
 *        without disclosing their financial circumstances to the undergraduate
 *        treasurer who reviews it (#4388).
 *
 * Two design constraints drive everything below.
 *
 * The first is that the treasurer is a peer. They will sit next to the
 * applicant next week. So the reviewable record is keyed by an opaque case
 * reference and the applicant's identity lives in a separate map that the
 * review path never reads. Separating them at the type level is what makes the
 * guarantee checkable rather than aspirational.
 *
 * The second is that the outcome must not depend on the treasurer's mood. The
 * scale is published and deterministic: identical bands always produce an
 * identical assessment, which is what makes a decline defensible and an
 * approval free of any suggestion of favouritism.
 *
 * Money is handled in integer minor units throughout. There is no floating
 * point arithmetic anywhere on the currency path.
 */

/** Financial aid already held by the applicant. */
export type AidBand = "NONE" | "PARTIAL" | "FULL";

/** People financially dependent on the applicant or their income. */
export type DependantBand = "NONE" | "ONE_TO_TWO" | "THREE_PLUS";

export type WaiverTier = "T0" | "T1" | "T2" | "T3" | "T4";

export type CaseStatus = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";

export interface HardshipIndicators {
  aidBand: AidBand;
  dependantBand: DependantBand;
  /**
   * A self-declared circumstance the bands do not capture — a sudden change in
   * family situation, for instance. Deliberately a boolean: the moment this
   * becomes free text, sensitive detail starts flowing to the reviewer.
   */
  exceptionalCircumstance: boolean;
}

/** What the treasurer is allowed to see. Contains no applicant identity. */
export interface ReviewableCase {
  caseReference: string;
  clubId: string;
  duesCycleId: string;
  tier: WaiverTier;
  waiverBasisPoints: number;
  fullDuesMinor: number;
  assessedAmountMinor: number;
  waivedAmountMinor: number;
  status: CaseStatus;
  submittedAt: Date;
  decidedAt: Date | null;
}

/** The identity half of a case. Never returned by a review-path method. */
interface CaseIdentity {
  caseReference: string;
  applicantUserId: string;
  indicators: HardshipIndicators;
}

export interface HardshipDecision {
  caseReference: string;
  outcome: "APPROVED" | "DECLINED";
  reason: string;
  decidedBy: string;
  decidedAt: Date;
}

export interface TierRollup {
  tier: WaiverTier;
  caseCount: number;
  approvedCount: number;
  totalWaivedMinor: number;
  totalAssessedMinor: number;
}

export interface RedactedClubSummary {
  clubId: string;
  duesCycleId: string;
  totalCases: number;
  approvedCases: number;
  pendingCases: number;
  totalWaivedMinor: number;
  totalAssessedMinor: number;
  byTier: TierRollup[];
}

export interface SubmitRequest {
  applicantUserId: string;
  clubId: string;
  duesCycleId: string;
  indicators: HardshipIndicators;
  fullDuesMinor: number;
  /** The floor below which a waiver may not push the assessment. */
  minimumContributionMinor: number;
  submittedAt: Date;
}

/** Basis points waived, i.e. 10000 = the whole dues amount. */
const AID_BAND_POINTS: Record<AidBand, number> = {
  NONE: 0,
  PARTIAL: 3000,
  FULL: 5500,
};

const DEPENDANT_BAND_POINTS: Record<DependantBand, number> = {
  NONE: 0,
  ONE_TO_TWO: 1500,
  THREE_PLUS: 2500,
};

const EXCEPTIONAL_CIRCUMSTANCE_POINTS = 1000;

/** Waiver is capped short of 100%: every member contributes something. */
export const MAX_WAIVER_BASIS_POINTS = 9000;

/** Tier bands, ordered from most to least relief. */
const TIER_BANDS: ReadonlyArray<{ minPoints: number; tier: WaiverTier }> = [
  { minPoints: 7500, tier: "T4" },
  { minPoints: 5500, tier: "T3" },
  { minPoints: 3000, tier: "T2" },
  { minPoints: 1000, tier: "T1" },
  { minPoints: 0, tier: "T0" },
];

const AID_BANDS: readonly AidBand[] = ["NONE", "PARTIAL", "FULL"];
const DEPENDANT_BANDS: readonly DependantBand[] = ["NONE", "ONE_TO_TWO", "THREE_PLUS"];

export class DuesHardshipWaiverService {
  /** Reviewable half, keyed by case reference. */
  private readonly cases: Map<string, ReviewableCase>;
  /** Identity half. Never joined to `cases` on a review-path read. */
  private readonly identities: Map<string, CaseIdentity>;
  private readonly decisions: Map<string, HardshipDecision>;
  private sequence: number;

  constructor() {
    this.cases = new Map();
    this.identities = new Map();
    this.decisions = new Map();
    this.sequence = 0;
  }

  // ---------------------------------------------------------------------------
  // Scale
  // ---------------------------------------------------------------------------

  /**
   * The published scale. Two students with identical bands always receive the
   * identical figure, which is the whole point: the treasurer is approving an
   * arithmetic result, not exercising discretion over a peer's finances.
   */
  public assessWaiverBasisPoints(indicators: HardshipIndicators): number {
    this.assertValidIndicators(indicators);

    const raw =
      AID_BAND_POINTS[indicators.aidBand] +
      DEPENDANT_BAND_POINTS[indicators.dependantBand] +
      (indicators.exceptionalCircumstance ? EXCEPTIONAL_CIRCUMSTANCE_POINTS : 0);

    return Math.min(raw, MAX_WAIVER_BASIS_POINTS);
  }

  public tierFor(waiverBasisPoints: number): WaiverTier {
    const band = TIER_BANDS.find((entry) => waiverBasisPoints >= entry.minPoints);
    return band ? band.tier : "T0";
  }

  /**
   * Applies the waiver and then the floor.
   *
   * Order matters. The floor is a hard minimum contribution the club sets, so a
   * T4 assessment on small dues lands on the floor rather than at zero, and the
   * waived amount reported is the amount actually forgone, not the amount the
   * scale would have forgone in the absence of a floor.
   */
  public assessAmount(
    fullDuesMinor: number,
    waiverBasisPoints: number,
    minimumContributionMinor: number,
  ): { assessedAmountMinor: number; waivedAmountMinor: number } {
    this.assertMinorUnits(fullDuesMinor, "Full dues");
    this.assertMinorUnits(minimumContributionMinor, "Minimum contribution");

    if (minimumContributionMinor > fullDuesMinor) {
      throw new Error("The minimum contribution cannot exceed the full dues amount.");
    }
    if (waiverBasisPoints < 0 || waiverBasisPoints > MAX_WAIVER_BASIS_POINTS) {
      throw new Error(`A waiver must be between 0 and ${MAX_WAIVER_BASIS_POINTS} basis points.`);
    }

    // Integer arithmetic end to end. Rounding up the assessment means any
    // rounding error favours the club's balance rather than silently widening
    // the waiver.
    const scaledAssessment = Math.ceil((fullDuesMinor * (10000 - waiverBasisPoints)) / 10000);
    const assessedAmountMinor = Math.max(scaledAssessment, minimumContributionMinor);

    return {
      assessedAmountMinor,
      waivedAmountMinor: fullDuesMinor - assessedAmountMinor,
    };
  }

  // ---------------------------------------------------------------------------
  // Submission
  // ---------------------------------------------------------------------------

  public submitRequest(request: SubmitRequest): ReviewableCase {
    if (!request.applicantUserId) {
      throw new Error("A hardship request requires an applicant.");
    }
    if (!request.clubId || !request.duesCycleId) {
      throw new Error("A hardship request requires a club and a dues cycle.");
    }

    const duplicate = this.findOpenCaseFor(
      request.applicantUserId,
      request.clubId,
      request.duesCycleId,
    );
    if (duplicate) {
      throw new Error("An open hardship request already exists for this applicant and dues cycle.");
    }

    const waiverBasisPoints = this.assessWaiverBasisPoints(request.indicators);
    const { assessedAmountMinor, waivedAmountMinor } = this.assessAmount(
      request.fullDuesMinor,
      waiverBasisPoints,
      request.minimumContributionMinor,
    );

    this.sequence += 1;
    const caseReference = this.mintCaseReference(request.clubId, this.sequence);

    const reviewable: ReviewableCase = {
      caseReference,
      clubId: request.clubId,
      duesCycleId: request.duesCycleId,
      tier: this.tierFor(waiverBasisPoints),
      waiverBasisPoints,
      fullDuesMinor: request.fullDuesMinor,
      assessedAmountMinor,
      waivedAmountMinor,
      status: "PENDING",
      submittedAt: request.submittedAt,
      decidedAt: null,
    };

    this.cases.set(caseReference, reviewable);
    this.identities.set(caseReference, {
      caseReference,
      applicantUserId: request.applicantUserId,
      indicators: { ...request.indicators },
    });

    return { ...reviewable };
  }

  /**
   * The treasurer's queue. Returns reviewable records only, so there is no code
   * path on which a reviewer receives an applicant id or their raw bands.
   */
  public getReviewQueue(clubId: string, duesCycleId?: string): ReviewableCase[] {
    return Array.from(this.cases.values())
      .filter((entry) => entry.clubId === clubId && entry.status === "PENDING")
      .filter((entry) => duesCycleId === undefined || entry.duesCycleId === duesCycleId)
      .sort((a, b) => {
        // Deepest need first, then oldest, so a queue worked top-down reaches
        // the students in the most difficulty soonest.
        const byNeed = b.waiverBasisPoints - a.waiverBasisPoints;
        if (byNeed !== 0) {
          return byNeed;
        }
        const byAge = a.submittedAt.getTime() - b.submittedAt.getTime();
        return byAge !== 0 ? byAge : a.caseReference.localeCompare(b.caseReference);
      })
      .map((entry) => ({ ...entry }));
  }

  public getCase(caseReference: string): ReviewableCase | undefined {
    const entry = this.cases.get(caseReference);
    return entry ? { ...entry } : undefined;
  }

  /**
   * Resolves the applicant behind a case. Deliberately separate from every
   * review-path read, and intended for the billing side that has to apply the
   * assessed amount to an account.
   */
  public resolveApplicant(caseReference: string): string | undefined {
    return this.identities.get(caseReference)?.applicantUserId;
  }

  /** A student's own view of their case. */
  public getCasesForApplicant(applicantUserId: string): ReviewableCase[] {
    return Array.from(this.identities.values())
      .filter((identity) => identity.applicantUserId === applicantUserId)
      .map((identity) => this.cases.get(identity.caseReference))
      .filter((entry): entry is ReviewableCase => entry !== undefined)
      .map((entry) => ({ ...entry }));
  }

  // ---------------------------------------------------------------------------
  // Decision
  // ---------------------------------------------------------------------------

  public decide(
    caseReference: string,
    outcome: "APPROVED" | "DECLINED",
    reason: string,
    decidedBy: string,
    decidedAt: Date,
  ): HardshipDecision {
    const entry = this.cases.get(caseReference);
    if (!entry) {
      throw new Error(`Unknown hardship case '${caseReference}'.`);
    }
    if (entry.status !== "PENDING") {
      throw new Error(
        `Case ${caseReference} was already resolved as ${entry.status} and cannot be re-decided.`,
      );
    }
    if (!reason || reason.trim().length < 8) {
      // A decline with no stated reason is unappealable, so a reason is
      // mandatory on both outcomes rather than only on declines.
      throw new Error("A decision requires a recorded reason of at least 8 characters.");
    }
    if (!decidedBy) {
      throw new Error("A decision requires the reviewer's identity.");
    }
    if (this.identities.get(caseReference)?.applicantUserId === decidedBy) {
      throw new Error("A reviewer cannot decide their own hardship request.");
    }

    const decision: HardshipDecision = {
      caseReference,
      outcome,
      reason: reason.trim(),
      decidedBy,
      decidedAt,
    };

    this.decisions.set(caseReference, decision);
    this.cases.set(caseReference, { ...entry, status: outcome, decidedAt });

    return { ...decision };
  }

  public getDecision(caseReference: string): HardshipDecision | undefined {
    const decision = this.decisions.get(caseReference);
    return decision ? { ...decision } : undefined;
  }

  /** Withdrawal is the applicant's own action and needs no reviewer. */
  public withdraw(caseReference: string, applicantUserId: string, withdrawnAt: Date): void {
    const entry = this.cases.get(caseReference);
    if (!entry) {
      throw new Error(`Unknown hardship case '${caseReference}'.`);
    }
    if (this.identities.get(caseReference)?.applicantUserId !== applicantUserId) {
      throw new Error("Only the applicant may withdraw their own hardship request.");
    }
    if (entry.status !== "PENDING") {
      throw new Error(`Case ${caseReference} is already resolved as ${entry.status}.`);
    }

    this.cases.set(caseReference, { ...entry, status: "WITHDRAWN", decidedAt: withdrawnAt });
  }

  // ---------------------------------------------------------------------------
  // Reporting
  // ---------------------------------------------------------------------------

  /**
   * Budget planning figures for the club, aggregated per tier.
   *
   * Counts and totals only. A per-applicant breakdown would re-identify people
   * in a small club, which is precisely what the case reference exists to
   * prevent, so this deliberately has no way to express one.
   */
  public buildRedactedSummary(clubId: string, duesCycleId: string): RedactedClubSummary {
    const scoped = Array.from(this.cases.values()).filter(
      (entry) => entry.clubId === clubId && entry.duesCycleId === duesCycleId,
    );

    const byTier: TierRollup[] = (["T0", "T1", "T2", "T3", "T4"] as WaiverTier[]).map((tier) => {
      const inTier = scoped.filter((entry) => entry.tier === tier);
      const approved = inTier.filter((entry) => entry.status === "APPROVED");

      return {
        tier,
        caseCount: inTier.length,
        approvedCount: approved.length,
        totalWaivedMinor: approved.reduce((sum, entry) => sum + entry.waivedAmountMinor, 0),
        totalAssessedMinor: approved.reduce((sum, entry) => sum + entry.assessedAmountMinor, 0),
      };
    });

    return {
      clubId,
      duesCycleId,
      totalCases: scoped.length,
      approvedCases: scoped.filter((entry) => entry.status === "APPROVED").length,
      pendingCases: scoped.filter((entry) => entry.status === "PENDING").length,
      totalWaivedMinor: byTier.reduce((sum, rollup) => sum + rollup.totalWaivedMinor, 0),
      totalAssessedMinor: byTier.reduce((sum, rollup) => sum + rollup.totalAssessedMinor, 0),
      byTier,
    };
  }

  /**
   * The published scale, rendered for the club handbook. Publishing it is what
   * lets an applicant check their own assessment rather than having to trust it.
   */
  public describeScale(): string[] {
    const lines: string[] = [
      "Dues hardship scale (basis points waived, 10000 = full dues):",
      ...AID_BANDS.map((band) => `  Financial aid ${band}: ${AID_BAND_POINTS[band]}`),
      ...DEPENDANT_BANDS.map((band) => `  Dependants ${band}: ${DEPENDANT_BAND_POINTS[band]}`),
      `  Exceptional circumstance: ${EXCEPTIONAL_CIRCUMSTANCE_POINTS}`,
      `  Maximum waiver: ${MAX_WAIVER_BASIS_POINTS} (every member contributes something)`,
      "The assessed amount never falls below the club's minimum contribution.",
    ];
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private findOpenCaseFor(
    applicantUserId: string,
    clubId: string,
    duesCycleId: string,
  ): ReviewableCase | undefined {
    for (const identity of this.identities.values()) {
      if (identity.applicantUserId !== applicantUserId) {
        continue;
      }
      const entry = this.cases.get(identity.caseReference);
      if (
        entry &&
        entry.clubId === clubId &&
        entry.duesCycleId === duesCycleId &&
        entry.status === "PENDING"
      ) {
        return entry;
      }
    }
    return undefined;
  }

  /**
   * Case references are sequential per club rather than derived from anything
   * about the applicant. A reference computed from a user id would leak the
   * very identity the reference exists to hide.
   */
  private mintCaseReference(clubId: string, sequence: number): string {
    const clubToken = clubId
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-4)
      .toUpperCase();
    return `HW-${clubToken || "CLUB"}-${String(sequence).padStart(4, "0")}`;
  }

  private assertValidIndicators(indicators: HardshipIndicators): void {
    if (!AID_BANDS.includes(indicators.aidBand)) {
      throw new Error(`Unknown aid band '${indicators.aidBand}'.`);
    }
    if (!DEPENDANT_BANDS.includes(indicators.dependantBand)) {
      throw new Error(`Unknown dependant band '${indicators.dependantBand}'.`);
    }
    if (typeof indicators.exceptionalCircumstance !== "boolean") {
      throw new Error("The exceptional circumstance indicator must be a boolean.");
    }
  }

  private assertMinorUnits(value: number, label: string): void {
    if (!Number.isInteger(value)) {
      throw new Error(`${label} must be an integer number of minor units.`);
    }
    if (value < 0) {
      throw new Error(`${label} cannot be negative.`);
    }
  }
}

export const duesHardshipWaiverService = new DuesHardshipWaiverService();
