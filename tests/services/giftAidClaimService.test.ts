/**
 * Test suite: Gift Aid Declaration Validity and Claim Eligibility (#5258)
 * File: tests/services/giftAidClaimService.test.ts
 *
 * The cases worth writing down are the ones an `is_gift_aid` boolean cannot
 * hold: the declaration signed today that makes an eighteen-month-old donation
 * claimable, the cancellation that must not reach backwards, the benefit that
 * is a penny over the limit and fails the whole donation rather than the
 * excess, the declaration signed in March whose retrospective reach is a tax
 * year earlier than a calendar subtraction suggests, and the rate change that
 * must not re-rate five years of history.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  GiftAidClaimService,
  benefitLimitPence,
  taxYearStart,
  taxYearEnd,
  type Donation,
} from "../../src/services/giftAidClaimService";

const ASOF = new Date("2029-08-01T00:00:00.000Z");

function donation(
  overrides: Partial<Donation> & Pick<Donation, "donationId" | "receivedOn" | "amountPence">,
): Donation {
  return {
    donorId: "d-alice",
    donorType: "INDIVIDUAL",
    kind: "DONATION",
    benefitValuePence: 0,
    ...overrides,
  };
}

function build(): GiftAidClaimService {
  const service = new GiftAidClaimService();

  service.registerRateBand({
    effectiveFrom: new Date("2015-04-06T00:00:00.000Z"),
    effectiveTo: new Date("2027-04-06T00:00:00.000Z"),
    basicRatePercent: 20,
  });
  service.registerRateBand({
    effectiveFrom: new Date("2027-04-06T00:00:00.000Z"),
    effectiveTo: null,
    basicRatePercent: 22,
  });

  return service;
}

describe("tax year arithmetic", () => {
  test("a date in June sits in the tax year that opened that April", () => {
    expect(taxYearStart(new Date("2029-06-01T00:00:00.000Z")).toISOString()).toBe(
      "2029-04-06T00:00:00.000Z",
    );
  });

  test("a date in March sits in the tax year that opened the previous April", () => {
    expect(taxYearStart(new Date("2029-03-01T00:00:00.000Z")).toISOString()).toBe(
      "2028-04-06T00:00:00.000Z",
    );
  });

  test("5 April is the last day of the year that opened the previous April", () => {
    expect(taxYearStart(new Date("2029-04-05T00:00:00.000Z")).toISOString()).toBe(
      "2028-04-06T00:00:00.000Z",
    );
  });

  test("6 April opens a new year", () => {
    expect(taxYearStart(new Date("2029-04-06T00:00:00.000Z")).toISOString()).toBe(
      "2029-04-06T00:00:00.000Z",
    );
  });

  test("the year closes on the following 6 April, exclusive", () => {
    expect(taxYearEnd(new Date("2029-06-01T00:00:00.000Z")).toISOString()).toBe(
      "2030-04-06T00:00:00.000Z",
    );
  });
});

describe("the tiered benefit limit", () => {
  test("a quarter of a donation at or below the first tier", () => {
    expect(benefitLimitPence(100_00)).toBe(25_00);
    expect(benefitLimitPence(40_00)).toBe(10_00);
  });

  test("a twentieth of the amount above the first tier, on top", () => {
    // £500: a quarter of the first £100, a twentieth of the remaining £400.
    expect(benefitLimitPence(500_00)).toBe(45_00);
  });

  test("an overall ceiling however large the donation", () => {
    expect(benefitLimitPence(100_000_00)).toBe(2_500_00);
    expect(benefitLimitPence(1_000_000_00)).toBe(2_500_00);
  });
});

describe("the basic rate in force when the donation was received", () => {
  let service: GiftAidClaimService;

  beforeEach(() => {
    service = build();
  });

  test("the rate on the last day of the old band is the old rate", () => {
    expect(service.basicRateOn(new Date("2027-04-05T00:00:00.000Z"))).toBe(20);
  });

  test("the rate on the first day of the new band is the new rate", () => {
    expect(service.basicRateOn(new Date("2027-04-06T00:00:00.000Z"))).toBe(22);
  });

  test("a date no band covers is an error rather than a guess", () => {
    expect(() => service.basicRateOn(new Date("2001-01-01T00:00:00.000Z"))).toThrow(
      /No basic rate band/,
    );
  });

  test("repayment is grossed up at that rate and rounded down", () => {
    // 20%: a quarter of the donation.
    expect(service.repaymentPence(100_00, new Date("2026-06-01T00:00:00.000Z"))).toBe(25_00);
    // 22%: 22/78ths, which does not divide evenly and must round down.
    expect(service.repaymentPence(200_00, new Date("2029-07-01T00:00:00.000Z"))).toBe(5641);
  });
});

describe("a declaration reaches backwards as well as forwards", () => {
  let service: GiftAidClaimService;

  beforeEach(() => {
    service = build();
    service.registerDeclaration({
      declarationId: "decl-1",
      donorId: "d-alice",
      signedOn: new Date("2029-06-01T00:00:00.000Z"),
      enduring: true,
      cancelledOn: null,
      method: "ONLINE",
    });
  });

  test("the retrospective floor is four tax years before the one it was signed in", () => {
    expect(service.retrospectiveFloor(new Date("2029-06-01T00:00:00.000Z")).toISOString()).toBe(
      "2025-04-06T00:00:00.000Z",
    );
  });

  test("a donation inside the reach becomes claimable once the paperwork arrives", () => {
    service.recordDonation(
      donation({
        donationId: "don-back",
        receivedOn: new Date("2025-05-01T00:00:00.000Z"),
        amountPence: 100_00,
      }),
    );

    const assessment = service.assess("don-back", ASOF);
    expect(assessment.status).toBe("CLAIMABLE");
    expect(assessment.declarationId).toBe("decl-1");
    expect(assessment.repaymentPence).toBe(25_00);
  });

  test("a donation before the floor is not reached, however enduring the declaration", () => {
    service.recordDonation(
      donation({
        donationId: "don-far",
        receivedOn: new Date("2025-03-01T00:00:00.000Z"),
        amountPence: 100_00,
      }),
    );

    expect(service.assess("don-far", ASOF).status).toBe("NO_DECLARATION_IN_FORCE");
  });

  test("a declaration signed in March reaches a tax year further back than a calendar subtraction", () => {
    const service2 = build();
    service2.registerDeclaration({
      declarationId: "decl-march",
      donorId: "d-alice",
      signedOn: new Date("2029-03-01T00:00:00.000Z"),
      enduring: true,
      cancelledOn: null,
      method: "WRITTEN",
    });
    // Four calendar years back from March 2029 is March 2025; four tax years
    // back from the 2028/29 year is 6 April 2024, which is earlier.
    service2.recordDonation(
      donation({
        donationId: "don-2024",
        receivedOn: new Date("2024-06-01T00:00:00.000Z"),
        amountPence: 100_00,
      }),
    );

    // Assessed in March 2029, while the claim window on a 2024/25 donation is
    // still open — it closes on 6 April 2029, which is its own separate fact.
    const inWindow = new Date("2029-03-15T00:00:00.000Z");
    expect(service2.assess("don-2024", inWindow).status).toBe("CLAIMABLE");
    expect(service2.assess("don-2024", new Date("2029-04-06T00:00:00.000Z")).status).toBe(
      "CLAIM_WINDOW_EXPIRED",
    );
    // The same donation is out of reach of a declaration signed after 6 April.
    expect(service.declarationInForce("d-alice", new Date("2024-06-01T00:00:00.000Z"))).toBeNull();
  });

  test("a single-donation declaration does not reach back at all", () => {
    const service2 = build();
    service2.registerDeclaration({
      declarationId: "decl-single",
      donorId: "d-alice",
      signedOn: new Date("2029-06-01T00:00:00.000Z"),
      enduring: false,
      cancelledOn: null,
      method: "WRITTEN",
    });
    service2.recordDonation(
      donation({
        donationId: "don-prior",
        receivedOn: new Date("2029-05-01T00:00:00.000Z"),
        amountPence: 100_00,
      }),
    );

    expect(service2.assess("don-prior", ASOF).status).toBe("NO_DECLARATION_IN_FORCE");
  });
});

describe("cancellation stops the future and leaves the past alone", () => {
  let service: GiftAidClaimService;

  beforeEach(() => {
    service = build();
    service.registerDeclaration({
      declarationId: "decl-bob",
      donorId: "d-bob",
      signedOn: new Date("2028-01-01T00:00:00.000Z"),
      enduring: true,
      cancelledOn: null,
      method: "ONLINE",
    });
    service.cancelDeclaration("decl-bob", new Date("2029-03-01T00:00:00.000Z"));

    service.recordDonation(
      donation({
        donationId: "don-before",
        donorId: "d-bob",
        receivedOn: new Date("2029-02-01T00:00:00.000Z"),
        amountPence: 80_00,
      }),
    );
    service.recordDonation(
      donation({
        donationId: "don-after",
        donorId: "d-bob",
        receivedOn: new Date("2029-04-01T00:00:00.000Z"),
        amountPence: 80_00,
      }),
    );
  });

  test("a donation given while the declaration was live stays claimable", () => {
    expect(service.assess("don-before", ASOF).status).toBe("CLAIMABLE");
  });

  test("a donation given afterwards is not covered", () => {
    expect(service.assess("don-after", ASOF).status).toBe("NO_DECLARATION_IN_FORCE");
  });

  test("the day of cancellation is already outside the cover", () => {
    expect(service.declarationInForce("d-bob", new Date("2029-03-01T00:00:00.000Z"))).toBeNull();
  });

  test("cancelling before the signature is refused rather than stored", () => {
    expect(() =>
      service.cancelDeclaration("decl-bob", new Date("2027-01-01T00:00:00.000Z")),
    ).toThrow(/cannot be cancelled before it was signed/);
  });
});

describe("benefit is a cliff rather than a deduction", () => {
  let service: GiftAidClaimService;

  beforeEach(() => {
    service = build();
    service.registerDeclaration({
      declarationId: "decl-1",
      donorId: "d-alice",
      signedOn: new Date("2028-01-01T00:00:00.000Z"),
      enduring: true,
      cancelledOn: null,
      method: "ONLINE",
    });
  });

  test("benefit exactly at the limit leaves the donation claimable", () => {
    service.recordDonation(
      donation({
        donationId: "don-at-limit",
        receivedOn: new Date("2029-01-01T00:00:00.000Z"),
        amountPence: 100_00,
        benefitValuePence: 25_00,
      }),
    );
    expect(service.assess("don-at-limit", ASOF).status).toBe("CLAIMABLE");
  });

  test("a penny over the limit fails the whole donation, not the excess", () => {
    service.recordDonation(
      donation({
        donationId: "don-over",
        receivedOn: new Date("2029-01-01T00:00:00.000Z"),
        amountPence: 100_00,
        benefitValuePence: 25_01,
      }),
    );

    const assessment = service.assess("don-over", ASOF);
    expect(assessment.status).toBe("BENEFIT_EXCEEDS_LIMIT");
    expect(assessment.repaymentPence).toBe(0);
    expect(assessment.reason).toContain("whole donation fails");
  });

  test("the second tier gives a larger donation more headroom", () => {
    service.recordDonation(
      donation({
        donationId: "don-large",
        receivedOn: new Date("2029-01-01T00:00:00.000Z"),
        amountPence: 500_00,
        benefitValuePence: 45_00,
      }),
    );
    expect(service.assess("don-large", ASOF).status).toBe("CLAIMABLE");
  });
});

describe("payments outside the scheme however much paperwork exists", () => {
  let service: GiftAidClaimService;

  beforeEach(() => {
    service = build();
    service.registerDeclaration({
      declarationId: "decl-1",
      donorId: "d-alice",
      signedOn: new Date("2028-01-01T00:00:00.000Z"),
      enduring: true,
      cancelledOn: null,
      method: "ONLINE",
    });
  });

  test("a company donation is relieved elsewhere", () => {
    service.recordDonation(
      donation({
        donationId: "don-co",
        donorType: "COMPANY",
        receivedOn: new Date("2029-01-01T00:00:00.000Z"),
        amountPence: 500_00,
      }),
    );
    expect(service.assess("don-co", ASOF).status).toBe("DONOR_NOT_ELIGIBLE");
  });

  test("a membership subscription is not a gift", () => {
    service.recordDonation(
      donation({
        donationId: "don-sub",
        kind: "MEMBERSHIP_SUBSCRIPTION",
        receivedOn: new Date("2029-01-01T00:00:00.000Z"),
        amountPence: 30_00,
      }),
    );
    expect(service.assess("don-sub", ASOF).status).toBe("PAYMENT_KIND_EXCLUDED");
  });

  test("a purchase is not a gift", () => {
    service.recordDonation(
      donation({
        donationId: "don-buy",
        kind: "GOODS_OR_SERVICES",
        receivedOn: new Date("2029-01-01T00:00:00.000Z"),
        amountPence: 30_00,
      }),
    );
    expect(service.assess("don-buy", ASOF).status).toBe("PAYMENT_KIND_EXCLUDED");
  });

  test("the exclusion is checked before the declaration, so the reason is the real one", () => {
    service.recordDonation(
      donation({
        donationId: "don-sub-nodecl",
        donorId: "d-nobody-signed",
        kind: "MEMBERSHIP_SUBSCRIPTION",
        receivedOn: new Date("2029-01-01T00:00:00.000Z"),
        amountPence: 30_00,
      }),
    );
    expect(service.assess("don-sub-nodecl", ASOF).status).toBe("PAYMENT_KIND_EXCLUDED");
  });
});

describe("the claim window", () => {
  let service: GiftAidClaimService;

  beforeEach(() => {
    service = build();
    service.registerDeclaration({
      declarationId: "decl-1",
      donorId: "d-alice",
      signedOn: new Date("2024-01-01T00:00:00.000Z"),
      enduring: true,
      cancelledOn: null,
      method: "ONLINE",
    });
    service.recordDonation(
      donation({
        donationId: "don-2025",
        receivedOn: new Date("2025-05-01T00:00:00.000Z"),
        amountPence: 100_00,
      }),
    );
  });

  test("the window closes four years after the end of the donation's tax year", () => {
    // The last day the donation can be claimed, not the first day it cannot.
    // A caller putting this on a screen must not be a day late.
    expect(service.claimableUntil(new Date("2025-05-01T00:00:00.000Z")).toISOString()).toBe(
      "2030-04-05T00:00:00.000Z",
    );
  });

  test("the day the window names is itself still claimable", () => {
    const until = service.claimableUntil(new Date("2025-05-01T00:00:00.000Z"));
    expect(service.assess("don-2025", until).status).toBe("CLAIMABLE");
  });

  test("a donation assessed inside the window is claimable", () => {
    expect(service.assess("don-2025", new Date("2030-04-05T00:00:00.000Z")).status).toBe(
      "CLAIMABLE",
    );
  });

  test("the same donation a day later has expired", () => {
    const assessment = service.assess("don-2025", new Date("2030-04-06T00:00:00.000Z"));
    expect(assessment.status).toBe("CLAIM_WINDOW_EXPIRED");
    expect(assessment.reason).toContain("2030-04-05");
  });

  test("an expired donation is reported in the batch rather than dropped from it", () => {
    const batch = service.assembleClaim(
      "claim-1",
      ["don-2025"],
      new Date("2030-06-01T00:00:00.000Z"),
    );
    expect(batch.donationIds).toEqual([]);
    expect(batch.expired).toHaveLength(1);
    expect(batch.totalRepaymentPence).toBe(0);
  });
});

describe("assembling and submitting a claim", () => {
  let service: GiftAidClaimService;

  beforeEach(() => {
    service = build();
    service.registerDeclaration({
      declarationId: "decl-1",
      donorId: "d-alice",
      signedOn: new Date("2028-01-01T00:00:00.000Z"),
      enduring: true,
      cancelledOn: null,
      method: "ONLINE",
    });
    service.recordDonation(
      donation({
        donationId: "don-a",
        receivedOn: new Date("2029-01-01T00:00:00.000Z"),
        amountPence: 100_00,
      }),
    );
    service.recordDonation(
      donation({
        donationId: "don-b",
        receivedOn: new Date("2029-02-01T00:00:00.000Z"),
        amountPence: 200_00,
      }),
    );
    service.recordDonation(
      donation({
        donationId: "don-sub",
        kind: "MEMBERSHIP_SUBSCRIPTION",
        receivedOn: new Date("2029-02-01T00:00:00.000Z"),
        amountPence: 30_00,
      }),
    );
  });

  test("the batch totals only what is claimable and lists the rest", () => {
    const batch = service.assembleClaim("claim-1", ["don-a", "don-b", "don-sub"], ASOF);

    expect(batch.donationIds).toEqual(["don-a", "don-b"]);
    expect(batch.totalDonationPence).toBe(300_00);
    // 22% band: 2820 and 5641 pence, each rounded down.
    expect(batch.totalRepaymentPence).toBe(2820 + 5641);
    expect(batch.excluded.map((line) => line.donationId)).toEqual(["don-sub"]);
    expect(batch.lines.map((line) => line.repaymentPence)).toEqual([2820, 5641]);
  });

  test("a batch carrying anything unclaimable is rejected as a whole", () => {
    const validation = service.validateBatch(["don-a", "don-sub"], ASOF);
    expect(validation.valid).toBe(false);
    expect(validation.problems[0]).toContain("don-sub");
  });

  test("a donation listed twice is caught before submission", () => {
    const validation = service.validateBatch(["don-a", "don-a"], ASOF);
    expect(validation.valid).toBe(false);
    expect(validation.problems[0]).toContain("appears twice");
  });

  test("submission refuses rather than quietly dropping the bad rows", () => {
    expect(() => service.submitClaim("claim-1", ["don-a", "don-sub"], ASOF)).toThrow(
      /cannot be submitted/,
    );
  });

  test("a submitted donation cannot be claimed a second time", () => {
    service.submitClaim("claim-1", ["don-a"], ASOF);

    const assessment = service.assess("don-a", ASOF);
    expect(assessment.status).toBe("ALREADY_CLAIMED");
    expect(assessment.reason).toContain("claim-1");
    expect(service.validateBatch(["don-a"], ASOF).valid).toBe(false);
  });

  test("assessing a donor returns every donation in the order received", () => {
    const assessments = service.assessDonor("d-alice", ASOF);
    expect(assessments.map((a) => a.donationId)).toEqual(["don-a", "don-b", "don-sub"]);
  });
});

describe("a declaration later found invalid", () => {
  let service: GiftAidClaimService;

  beforeEach(() => {
    service = build();
    service.registerDeclaration({
      declarationId: "decl-1",
      donorId: "d-alice",
      signedOn: new Date("2028-01-01T00:00:00.000Z"),
      enduring: true,
      cancelledOn: null,
      method: "VERBAL_CONFIRMED",
    });
    service.recordDonation(
      donation({
        donationId: "don-a",
        receivedOn: new Date("2029-01-01T00:00:00.000Z"),
        amountPence: 100_00,
      }),
    );
    service.submitClaim("claim-1", ["don-a"], ASOF);
  });

  test("what was already claimed on it is reversed", () => {
    const reversal = service.invalidateDeclaration("decl-1", new Date("2029-09-01T00:00:00.000Z"));

    expect(reversal.donationIds).toEqual(["don-a"]);
    expect(reversal.totalRepaymentPence).toBe(2820);
  });

  test("the donation returns to being unclaimed rather than staying claimed", () => {
    service.invalidateDeclaration("decl-1", new Date("2029-09-01T00:00:00.000Z"));
    expect(service.assess("don-a", ASOF).status).toBe("NO_DECLARATION_IN_FORCE");
  });

  test("a donation a second declaration also covers is left alone", () => {
    service.registerDeclaration({
      declarationId: "decl-2",
      donorId: "d-alice",
      signedOn: new Date("2029-01-15T00:00:00.000Z"),
      enduring: true,
      cancelledOn: null,
      method: "WRITTEN",
    });

    const reversal = service.invalidateDeclaration("decl-1", new Date("2029-09-01T00:00:00.000Z"));
    expect(reversal.donationIds).toEqual([]);
    expect(reversal.totalRepaymentPence).toBe(0);
    expect(service.assess("don-a", ASOF).status).toBe("ALREADY_CLAIMED");
  });

  test("the reversal gives back what was claimed, not what today's rate would give", () => {
    // The rate moves between the claim and the discovery. A reversal computed
    // from the current bands would hand back a different number from the one
    // that was actually taken.
    service.registerRateBand({
      effectiveFrom: new Date("2028-06-01T00:00:00.000Z"),
      effectiveTo: null,
      basicRatePercent: 30,
    });
    // The recomputation this replaces would now say 30%.
    expect(service.repaymentPence(100_00, new Date("2029-01-01T00:00:00.000Z"))).toBe(4285);

    const reversal = service.invalidateDeclaration("decl-1", new Date("2029-09-01T00:00:00.000Z"));

    // 22% on a £100 donation received in January 2029, as claimed.
    expect(reversal.totalRepaymentPence).toBe(2820);
    // 30% would have been 4285, which is not what the charity received.
    expect(reversal.totalRepaymentPence).not.toBe(4285);
  });

  test("the claimed amount is reported back on the already-claimed assessment", () => {
    expect(service.assess("don-a", ASOF).repaymentPence).toBe(2820);
  });

  test("invalidating something that does not exist is an error", () => {
    expect(() => service.invalidateDeclaration("decl-nope", ASOF)).toThrow(/Unknown declaration/);
  });
});

describe("inputs that cannot be interpreted", () => {
  let service: GiftAidClaimService;

  beforeEach(() => {
    service = build();
  });

  test("a donation of nothing is rejected", () => {
    expect(() =>
      service.recordDonation(
        donation({ donationId: "don-zero", receivedOn: ASOF, amountPence: 0 }),
      ),
    ).toThrow(/positive amount/);
  });

  test("negative benefit is rejected rather than treated as generosity", () => {
    expect(() =>
      service.recordDonation(
        donation({
          donationId: "don-neg",
          receivedOn: ASOF,
          amountPence: 100_00,
          benefitValuePence: -1,
        }),
      ),
    ).toThrow(/negative benefit/);
  });

  test("a declaration cancelled before it was signed is refused on the way in", () => {
    expect(() =>
      service.registerDeclaration({
        declarationId: "decl-bad",
        donorId: "d-alice",
        signedOn: new Date("2029-06-01T00:00:00.000Z"),
        enduring: true,
        cancelledOn: new Date("2029-01-01T00:00:00.000Z"),
        method: "ONLINE",
      }),
    ).toThrow(/cannot be cancelled before it was signed/);
  });

  test("assessing a donation that does not exist is an error", () => {
    expect(() => service.assess("don-ghost", ASOF)).toThrow(/Unknown donation/);
  });
});
