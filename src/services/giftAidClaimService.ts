/**
 * Module: Gift Aid Declaration Validity and Claim Eligibility
 * File: src/services/giftAidClaimService.ts
 * Scope: Decides, per donation, whether a declaration was in force on the date
 *        that donation was made; applies the tiered benefit limit, the
 *        structural exclusions and the claim window; computes the repayment at
 *        the rate in force when the donation was received; assembles claim
 *        batches; and reverses what was already claimed when a declaration is
 *        later found invalid (#5258).
 *
 * The platform records what was given and by whom. It records nothing about
 * whether the money can be claimed on, and a `gift_aid BOOLEAN` column on the
 * donation is the wrong shape for the question in four separate ways.
 *
 * Eligibility is a property of the declaration, not of the payment. A
 * declaration covers a span of time, so the question about any donation is
 * whether a valid declaration was in force on the day it was made. The column
 * on the donation records an answer given at a moment when the answer was not
 * yet knowable.
 *
 * A declaration is retrospective and prospective at once. An enduring
 * declaration signed today covers the four tax years before the one it was
 * signed in, and everything after, so a donation from eighteen months ago
 * becomes claimable the moment the paperwork arrives. Nothing about the
 * donation changed; the answer did.
 *
 * Cancellation, by contrast, is not retrospective. A donor who cancels stops
 * future eligibility and leaves everything given while the declaration was live
 * untouched. Storing eligibility on the donation makes it very easy to sweep
 * both directions at once and reverse claims that were perfectly good.
 *
 * Benefit is a cliff, not a deduction. Above the tiered limit the whole
 * donation fails rather than the excess, because above the limit it was never
 * a gift. Netting off the excess produces a claim that is wrong by the entire
 * remaining amount.
 *
 * And repayment is computed at the basic rate in force on the day the donation
 * was received. Re-rating a five-year history against today's rate is a silent
 * error in a number nobody checks by hand.
 *
 * Money is in pence throughout. Repayment is rounded down: over-claiming is
 * recoverable with interest and under-claiming is not, so the rounding goes in
 * the direction that cannot cost anything.
 */

export type DonorType = "INDIVIDUAL" | "COMPANY";

export type PaymentKind =
  /** A gift with nothing given in return beyond permitted benefit. */
  | "DONATION"
  /** A subscription buying membership rights. Outside the scheme. */
  | "MEMBERSHIP_SUBSCRIPTION"
  /** A purchase. Outside the scheme regardless of what the donor signed. */
  | "GOODS_OR_SERVICES";

export type DeclarationMethod = "WRITTEN" | "ONLINE" | "VERBAL_CONFIRMED";

export type EligibilityStatus =
  | "CLAIMABLE"
  | "NO_DECLARATION_IN_FORCE"
  | "BENEFIT_EXCEEDS_LIMIT"
  | "DONOR_NOT_ELIGIBLE"
  | "PAYMENT_KIND_EXCLUDED"
  | "CLAIM_WINDOW_EXPIRED"
  | "ALREADY_CLAIMED";

export interface Declaration {
  declarationId: string;
  donorId: string;
  signedOn: Date;
  /**
   * An enduring declaration reaches back; a single-donation one does not. The
   * distinction is on the declaration because the donor made it there.
   */
  enduring: boolean;
  /** Null while live. Not retrospective: it stops future donations only. */
  cancelledOn: Date | null;
  method: DeclarationMethod;
}

export interface Donation {
  donationId: string;
  donorId: string;
  donorType: DonorType;
  kind: PaymentKind;
  amountPence: number;
  receivedOn: Date;
  /** Tickets, priority booking, a hamper. Zero where the gift bought nothing. */
  benefitValuePence: number;
}

export interface BasicRateBand {
  /** Inclusive. */
  effectiveFrom: Date;
  /** Exclusive. Null for the band still in force. */
  effectiveTo: Date | null;
  basicRatePercent: number;
}

export interface Assessment {
  donationId: string;
  donorId: string;
  status: EligibilityStatus;
  claimable: boolean;
  amountPence: number;
  repaymentPence: number;
  /** The declaration relied on, so a later invalidation can find what it funded. */
  declarationId: string | null;
  /** The last date a claim can include this donation. */
  claimableUntil: Date;
  reason: string;
}

export interface ClaimBatch {
  claimId: string;
  assembledOn: Date;
  donationIds: string[];
  /** The claimable assessments themselves, carrying the amount each contributed. */
  lines: Assessment[];
  totalDonationPence: number;
  totalRepaymentPence: number;
  /** Reported rather than dropped: an expired donation is a fact, not an absence. */
  expired: Assessment[];
  excluded: Assessment[];
}

export interface BatchValidation {
  valid: boolean;
  problems: string[];
}

/**
 * What a claim actually took, kept because it is what a reversal has to give
 * back. Recomputing it later re-rates the donation against whatever the rate
 * bands say by then, which is the error the stored rate on `gift_aid_claim_lines`
 * exists to prevent.
 */
export interface ClaimedLine {
  claimId: string;
  repaymentPence: number;
  basicRatePercent: number;
}

export interface Reversal {
  declarationId: string;
  donationIds: string[];
  totalRepaymentPence: number;
  reason: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Benefit up to a quarter of the first £100 of a donation. */
const BENEFIT_FIRST_TIER_LIMIT_PENCE = 100_00;
const BENEFIT_FIRST_TIER_RATE = 0.25;
/** And a twentieth of anything above that. */
const BENEFIT_SECOND_TIER_RATE = 0.05;
/** With an overall ceiling however large the donation. */
const BENEFIT_ABSOLUTE_CAP_PENCE = 2_500_00;

/** An enduring declaration reaches back this many tax years before its own. */
const RETROSPECTIVE_TAX_YEARS = 4;
/** A claim must be made within this many years of the end of the donation's tax year. */
const CLAIM_WINDOW_YEARS = 4;

/** The UK tax year opens on 6 April. */
const TAX_YEAR_START_MONTH = 3; // April, zero-indexed.
const TAX_YEAR_START_DAY = 6;

/** 6 April opening the tax year that contains the date. */
export function taxYearStart(date: Date): Date {
  const year = date.getUTCFullYear();
  const openingThisYear = Date.UTC(year, TAX_YEAR_START_MONTH, TAX_YEAR_START_DAY);
  return date.getTime() >= openingThisYear
    ? new Date(openingThisYear)
    : new Date(Date.UTC(year - 1, TAX_YEAR_START_MONTH, TAX_YEAR_START_DAY));
}

/** 6 April closing it, exclusive. */
export function taxYearEnd(date: Date): Date {
  const start = taxYearStart(date);
  return new Date(Date.UTC(start.getUTCFullYear() + 1, TAX_YEAR_START_MONTH, TAX_YEAR_START_DAY));
}

/**
 * The most benefit a donation of this size may carry and still be a gift.
 * Tiered, and capped, and applied as a cliff rather than as a deduction.
 */
export function benefitLimitPence(amountPence: number): number {
  const firstTier = Math.min(amountPence, BENEFIT_FIRST_TIER_LIMIT_PENCE);
  const excess = Math.max(0, amountPence - BENEFIT_FIRST_TIER_LIMIT_PENCE);
  const limit = firstTier * BENEFIT_FIRST_TIER_RATE + excess * BENEFIT_SECOND_TIER_RATE;
  return Math.floor(Math.min(limit, BENEFIT_ABSOLUTE_CAP_PENCE));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class GiftAidClaimService {
  private readonly declarations: Declaration[] = [];
  private readonly donations = new Map<string, Donation>();
  private readonly rateBands: BasicRateBand[] = [];
  /**
   * donationId -> the line that claimed it. A second claim on the same donation
   * is refused, and the amount claimed is kept for the reversal.
   */
  private readonly claimed = new Map<string, ClaimedLine>();

  registerDeclaration(declaration: Declaration): void {
    if (
      declaration.cancelledOn !== null &&
      declaration.cancelledOn.getTime() < declaration.signedOn.getTime()
    ) {
      throw new Error(
        `Declaration ${declaration.declarationId} cannot be cancelled before it was signed`,
      );
    }
    this.declarations.push(declaration);
  }

  cancelDeclaration(declarationId: string, cancelledOn: Date): void {
    const declaration = this.declarations.find(
      (candidate) => candidate.declarationId === declarationId,
    );
    if (!declaration) throw new Error(`Unknown declaration ${declarationId}`);
    if (cancelledOn.getTime() < declaration.signedOn.getTime()) {
      throw new Error(`Declaration ${declarationId} cannot be cancelled before it was signed`);
    }
    declaration.cancelledOn = cancelledOn;
  }

  recordDonation(donation: Donation): void {
    if (donation.amountPence <= 0) {
      throw new Error(`Donation ${donation.donationId} must be a positive amount`);
    }
    if (donation.benefitValuePence < 0) {
      throw new Error(`Donation ${donation.donationId} cannot carry negative benefit`);
    }
    this.donations.set(donation.donationId, donation);
  }

  registerRateBand(band: BasicRateBand): void {
    this.rateBands.push(band);
  }

  /**
   * The basic rate in force on a date.
   *
   * Where more than one band covers the date, the one that came into force
   * latest wins. Bands should not overlap and the migration's exclusion
   * constraint stops them doing so in storage, but a correction registered
   * afterwards must not lose to the row it was correcting purely because that
   * row was inserted first.
   */
  basicRateOn(date: Date): number {
    const band = this.rateBands
      .filter(
        (candidate) =>
          candidate.effectiveFrom.getTime() <= date.getTime() &&
          (candidate.effectiveTo === null || candidate.effectiveTo.getTime() > date.getTime()),
      )
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];

    if (!band) throw new Error(`No basic rate band covers ${isoDate(date)}`);
    return band.basicRatePercent;
  }

  /**
   * The repayment on a donation, grossed up at the rate in force when it was
   * received. Rounded down, because an over-claim is recoverable with interest
   * and an under-claim costs nothing but itself.
   */
  repaymentPence(amountPence: number, receivedOn: Date): number {
    const rate = this.basicRateOn(receivedOn);
    return Math.floor((amountPence * rate) / (100 - rate));
  }

  /**
   * The earliest donation an enduring declaration signed on this date reaches.
   * Four tax years back from the start of the tax year it was signed in — a
   * calendar-year subtraction gets this wrong for every declaration signed
   * between January and early April.
   */
  retrospectiveFloor(signedOn: Date): Date {
    const start = taxYearStart(signedOn);
    return new Date(
      Date.UTC(
        start.getUTCFullYear() - RETROSPECTIVE_TAX_YEARS,
        TAX_YEAR_START_MONTH,
        TAX_YEAR_START_DAY,
      ),
    );
  }

  /**
   * The last day a claim may include a donation received on this date,
   * inclusive.
   *
   * The window runs four years from the end of the donation's tax year, and
   * that end is itself the exclusive 6 April. Returning that bare boundary
   * would name the first day the donation can no longer be claimed while
   * calling it the last day it can — a caller putting it on a screen files a
   * day late. The day before is subtracted here rather than left to whoever
   * reads the value.
   */
  claimableUntil(receivedOn: Date): Date {
    const end = taxYearEnd(receivedOn);
    const closes = Date.UTC(
      end.getUTCFullYear() + CLAIM_WINDOW_YEARS,
      end.getUTCMonth(),
      end.getUTCDate(),
    );
    return new Date(closes - MS_PER_DAY);
  }

  /**
   * The declaration in force on the date of a donation, if any.
   *
   * Two independent directions in one place: a declaration reaches back to its
   * retrospective floor and forward to its cancellation. Getting either wrong
   * moves money, and getting cancellation wrong moves money that was already
   * correctly claimed.
   */
  declarationInForce(donorId: string, on: Date): Declaration | null {
    const candidates = this.declarations.filter((declaration) => {
      if (declaration.donorId !== donorId) return false;

      // Cancellation is not retrospective: a donation on the day of
      // cancellation onwards is no longer covered, earlier ones stay covered.
      if (declaration.cancelledOn !== null && on.getTime() >= declaration.cancelledOn.getTime()) {
        return false;
      }

      if (on.getTime() >= declaration.signedOn.getTime()) return true;

      // Before the signature, only an enduring declaration reaches back, and
      // only as far as its floor.
      return (
        declaration.enduring &&
        on.getTime() >= this.retrospectiveFloor(declaration.signedOn).getTime()
      );
    });

    // Where several cover the date, the earliest signature is the one that has
    // covered the donation for longest and is the safest to rely on.
    return candidates.sort((a, b) => a.signedOn.getTime() - b.signedOn.getTime())[0] ?? null;
  }

  /**
   * One donation, assessed on its own terms. Every exclusion is checked before
   * the declaration, because a payment outside the scheme is outside it however
   * much paperwork the donor signed.
   */
  assess(donationId: string, asOf: Date): Assessment {
    const donation = this.donations.get(donationId);
    if (!donation) throw new Error(`Unknown donation ${donationId}`);

    const base = {
      donationId,
      donorId: donation.donorId,
      claimable: false,
      amountPence: donation.amountPence,
      repaymentPence: 0,
      declarationId: null as string | null,
      claimableUntil: this.claimableUntil(donation.receivedOn),
    };

    const existingClaim = this.claimed.get(donationId);
    if (existingClaim) {
      return {
        ...base,
        status: "ALREADY_CLAIMED",
        repaymentPence: existingClaim.repaymentPence,
        reason: `Included in claim ${existingClaim.claimId} for ${existingClaim.repaymentPence}p`,
      };
    }

    if (donation.donorType === "COMPANY") {
      return {
        ...base,
        status: "DONOR_NOT_ELIGIBLE",
        reason: "A company donation is relieved through corporation tax, not Gift Aid",
      };
    }

    if (donation.kind !== "DONATION") {
      return {
        ...base,
        status: "PAYMENT_KIND_EXCLUDED",
        reason:
          donation.kind === "MEMBERSHIP_SUBSCRIPTION"
            ? "A subscription buying membership rights is not a gift"
            : "A payment for goods or services is not a gift",
      };
    }

    const limit = benefitLimitPence(donation.amountPence);
    if (donation.benefitValuePence > limit) {
      return {
        ...base,
        status: "BENEFIT_EXCEEDS_LIMIT",
        reason:
          `Benefit of ${donation.benefitValuePence}p exceeds the ${limit}p limit for a ` +
          `${donation.amountPence}p donation, so the whole donation fails rather than the excess`,
      };
    }

    const declaration = this.declarationInForce(donation.donorId, donation.receivedOn);
    if (!declaration) {
      return {
        ...base,
        status: "NO_DECLARATION_IN_FORCE",
        reason: `No declaration covered ${donation.donorId} on ${isoDate(donation.receivedOn)}`,
      };
    }

    const until = this.claimableUntil(donation.receivedOn);
    if (asOf.getTime() > until.getTime()) {
      return {
        ...base,
        status: "CLAIM_WINDOW_EXPIRED",
        declarationId: declaration.declarationId,
        reason: `The claim window closed after ${isoDate(until)}`,
      };
    }

    return {
      ...base,
      status: "CLAIMABLE",
      claimable: true,
      repaymentPence: this.repaymentPence(donation.amountPence, donation.receivedOn),
      declarationId: declaration.declarationId,
      reason: `Covered by declaration ${declaration.declarationId} signed ${isoDate(declaration.signedOn)}`,
    };
  }

  /** Every donation for a donor, assessed, in the order received. */
  assessDonor(donorId: string, asOf: Date): Assessment[] {
    return [...this.donations.values()]
      .filter((donation) => donation.donorId === donorId)
      .sort((a, b) => a.receivedOn.getTime() - b.receivedOn.getTime())
      .map((donation) => this.assess(donation.donationId, asOf));
  }

  /**
   * Assembles a batch, separating what is claimable from what has expired and
   * what is excluded. Expiry is reported rather than filtered away, because a
   * donation that lapsed unclaimed is a thing somebody should see once.
   */
  assembleClaim(claimId: string, donationIds: string[], asOf: Date): ClaimBatch {
    const assessments = donationIds.map((donationId) => this.assess(donationId, asOf));

    const claimable = assessments.filter((assessment) => assessment.claimable);
    const expired = assessments.filter(
      (assessment) => assessment.status === "CLAIM_WINDOW_EXPIRED",
    );
    const excluded = assessments.filter(
      (assessment) => !assessment.claimable && assessment.status !== "CLAIM_WINDOW_EXPIRED",
    );

    return {
      claimId,
      assembledOn: asOf,
      donationIds: claimable.map((assessment) => assessment.donationId),
      lines: claimable,
      totalDonationPence: claimable.reduce((sum, a) => sum + a.amountPence, 0),
      totalRepaymentPence: claimable.reduce((sum, a) => sum + a.repaymentPence, 0),
      expired,
      excluded,
    };
  }

  /**
   * A batch is rejected as a whole if it carries anything that should not be in
   * it. Submitting the good rows and quietly dropping the bad ones is how a
   * claim gets submitted twice.
   */
  validateBatch(donationIds: string[], asOf: Date): BatchValidation {
    const problems: string[] = [];
    const seen = new Set<string>();

    for (const donationId of donationIds) {
      if (seen.has(donationId)) {
        problems.push(`${donationId} appears twice in the batch`);
        continue;
      }
      seen.add(donationId);

      const assessment = this.assess(donationId, asOf);
      if (!assessment.claimable) {
        problems.push(`${donationId}: ${assessment.status} — ${assessment.reason}`);
      }
    }

    return { valid: problems.length === 0, problems };
  }

  /** Marks a validated batch as claimed. Refuses anything not claimable. */
  submitClaim(claimId: string, donationIds: string[], asOf: Date): ClaimBatch {
    const validation = this.validateBatch(donationIds, asOf);
    if (!validation.valid) {
      throw new Error(`Claim ${claimId} cannot be submitted: ${validation.problems.join("; ")}`);
    }

    const batch = this.assembleClaim(claimId, donationIds, asOf);
    for (const assessment of batch.lines) {
      const donation = this.donations.get(assessment.donationId) as Donation;
      this.claimed.set(assessment.donationId, {
        claimId,
        repaymentPence: assessment.repaymentPence,
        basicRatePercent: this.basicRateOn(donation.receivedOn),
      });
    }
    return batch;
  }

  /**
   * A declaration later found invalid — never actually signed, or signed by
   * somebody who paid no tax — takes with it everything already claimed that
   * relied on it, and nothing else. A donation covered by a second declaration
   * survives, which is why the reliance is recorded per assessment.
   */
  invalidateDeclaration(declarationId: string, discoveredOn: Date): Reversal {
    const index = this.declarations.findIndex(
      (candidate) => candidate.declarationId === declarationId,
    );
    if (index === -1) throw new Error(`Unknown declaration ${declarationId}`);

    const [removed] = this.declarations.splice(index, 1);
    const affected: string[] = [];
    let total = 0;

    for (const [donationId, line] of this.claimed) {
      const donation = this.donations.get(donationId);
      if (!donation || donation.donorId !== removed.donorId) continue;

      // Reassess without the invalid declaration. Anything that still has one
      // was not funded by this declaration alone and is left alone.
      if (this.declarationInForce(donation.donorId, donation.receivedOn) === null) {
        affected.push(donationId);
        // The amount that was claimed, not a fresh computation. Recomputing
        // re-rates the donation against whatever the bands say today, which is
        // the error the stored rate on the claim line exists to prevent.
        total += line.repaymentPence;
      }
    }

    for (const donationId of affected) {
      this.claimed.delete(donationId);
    }

    return {
      declarationId,
      donationIds: affected.sort(),
      totalRepaymentPence: total,
      reason: `Declaration invalidated on ${isoDate(discoveredOn)}; no other declaration covers these donations`,
    };
  }
}
