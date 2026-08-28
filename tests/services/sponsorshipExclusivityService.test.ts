/**
 * Test suite: Sponsorship Exclusivity Register (#5015)
 * File: tests/services/sponsorshipExclusivityService.test.ts
 *
 * The cases worth writing down are the ones a paragraph in a PDF and a string
 * comparison both miss: two brands under one drinks group that share nothing in
 * their names, a grant over financial services that a committee reads as being
 * about banks, a season-long promise broken for exactly one night in March, and
 * a first-refusal right treated as a block because it was stored as a boolean.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  SponsorshipExclusivityService,
  type ExclusivityGrant,
  type ProposedGrant,
} from "../../src/services/sponsorshipExclusivityService";

const SEASON_FROM = new Date("2028-09-01T00:00:00.000Z");
const SEASON_TO = new Date("2029-07-01T00:00:00.000Z");
const MARCH_NIGHT_FROM = new Date("2029-03-14T18:00:00.000Z");
const MARCH_NIGHT_TO = new Date("2029-03-15T02:00:00.000Z");
const NOW = new Date("2028-10-01T09:00:00.000Z");

function grant(
  overrides: Partial<ExclusivityGrant> &
    Pick<ExclusivityGrant, "grantId" | "brandId" | "categoryId">,
): ExclusivityGrant {
  return {
    scope: { level: "UNION_WIDE" },
    termFrom: SEASON_FROM,
    termTo: SEASON_TO,
    strength: "ABSOLUTE",
    blocksCompetitorsAtOrAboveTier: null,
    carveOutBrandIds: [],
    tier: 1,
    signedAt: new Date("2028-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function proposal(
  overrides: Partial<ProposedGrant> & Pick<ProposedGrant, "brandId" | "categoryId">,
): ProposedGrant {
  const { grantId: _ignored, ...base } = grant({
    grantId: "proposed",
    brandId: overrides.brandId,
    categoryId: overrides.categoryId,
  });
  return { ...base, ...overrides };
}

function build(): SponsorshipExclusivityService {
  const service = new SponsorshipExclusivityService();

  const categories: Array<[string, string, string | null]> = [
    ["cat-financial-services", "Financial services", null],
    ["cat-retail-banking", "Retail banking", "cat-financial-services"],
    ["cat-insurance", "Insurance", "cat-financial-services"],
    ["cat-investment-banking", "Investment banking", "cat-financial-services"],
    ["cat-beverages", "Beverages", null],
    ["cat-soft-drinks", "Soft drinks", "cat-beverages"],
    ["cat-energy-drinks", "Energy drinks", "cat-beverages"],
  ];
  for (const [categoryId, name, parentCategoryId] of categories) {
    service.registerCategory({ categoryId, name, parentCategoryId });
  }

  const brands: Array<[string, string, string | null]> = [
    ["brand-northbank", "Northbank", "group-northbank-holdings"],
    ["brand-meridian-capital", "Meridian Capital", "group-northbank-holdings"],
    ["brand-southbank", "Southbank", "group-southbank"],
    ["brand-quickcover", "Quickcover", null],
    // Two brands under one drinks group, sharing nothing in their names.
    ["brand-vault-cola", "Vault Cola", "group-fizzco"],
    ["brand-crystal-springs", "Crystal Springs", "group-fizzco"],
    ["brand-voltade", "Voltade", "group-voltade"],
    ["brand-voltade-zero", "Voltade Zero", "group-voltade"],
  ];
  for (const [brandId, name, parentGroupId] of brands) {
    service.registerBrand({ brandId, name, parentGroupId });
  }

  service.registerEvent({
    eventId: "event-ball",
    clubId: "club-rugby",
    seasonId: "season-2028-29",
    venueId: "venue-great-hall",
    startsAt: MARCH_NIGHT_FROM,
  });
  service.registerEvent({
    eventId: "event-careers-fair",
    clubId: "club-union",
    seasonId: "season-2028-29",
    venueId: "venue-sports-centre",
    startsAt: new Date("2028-11-05T09:00:00.000Z"),
  });
  service.registerEvent({
    eventId: "event-rugby-final",
    clubId: "club-rugby",
    seasonId: "season-2028-29",
    venueId: "venue-sports-centre",
    startsAt: new Date("2029-04-20T14:00:00.000Z"),
  });

  return service;
}

describe("SponsorshipExclusivityService — competitor is a relation, not a name", () => {
  let service: SponsorshipExclusivityService;

  beforeEach(() => {
    service = build();
  });

  test("two differently named brands under one group conflict", () => {
    service.signGrant(
      grant({ grantId: "grant-cola", brandId: "brand-vault-cola", categoryId: "cat-soft-drinks" }),
    );

    expect(service.isCompetitor("brand-vault-cola", "brand-crystal-springs")).toBe(true);

    const decision = service.checkProposed(
      proposal({
        brandId: "brand-crystal-springs",
        categoryId: "cat-soft-drinks",
        scope: { level: "EVENT", eventId: "event-ball" },
        termFrom: MARCH_NIGHT_FROM,
        termTo: MARCH_NIGHT_TO,
      }),
      NOW,
    );

    expect(decision.outcome).toBe("BLOCKED");
    expect(decision.permitted).toBe(false);
    expect(decision.conflicts[0].incumbentGrantId).toBe("grant-cola");
  });

  test("a brand does not conflict with itself on renewal", () => {
    service.signGrant(
      grant({ grantId: "grant-cola", brandId: "brand-vault-cola", categoryId: "cat-soft-drinks" }),
    );

    const decision = service.checkProposed(
      proposal({
        brandId: "brand-vault-cola",
        categoryId: "cat-soft-drinks",
        termFrom: new Date("2029-07-01T00:00:00.000Z"),
        termTo: new Date("2030-07-01T00:00:00.000Z"),
      }),
      NOW,
    );

    expect(decision.outcome).toBe("PERMITTED");
    expect(decision.conflicts).toHaveLength(0);
  });
});

describe("SponsorshipExclusivityService — categories bind up and down, not sideways", () => {
  let service: SponsorshipExclusivityService;

  beforeEach(() => {
    service = build();
  });

  test("a grant over the parent category precludes a child", () => {
    service.signGrant(
      grant({
        grantId: "grant-broad",
        brandId: "brand-northbank",
        categoryId: "cat-financial-services",
      }),
    );

    const decision = service.checkProposed(
      proposal({ brandId: "brand-quickcover", categoryId: "cat-insurance" }),
      NOW,
    );

    expect(decision.outcome).toBe("BLOCKED");
  });

  test("a grant over a child category does not preclude a sibling", () => {
    service.signGrant(
      grant({
        grantId: "grant-narrow",
        brandId: "brand-northbank",
        categoryId: "cat-retail-banking",
      }),
    );

    const decision = service.checkProposed(
      proposal({ brandId: "brand-quickcover", categoryId: "cat-insurance" }),
      NOW,
    );

    expect(decision.outcome).toBe("PERMITTED");
    expect(service.categoriesConflict("cat-retail-banking", "cat-insurance")).toBe(false);
  });

  test("conflict is symmetric across the hierarchy", () => {
    expect(service.categoriesConflict("cat-insurance", "cat-financial-services")).toBe(true);
    expect(service.categoriesConflict("cat-financial-services", "cat-insurance")).toBe(true);
    expect(service.categoriesConflict("cat-soft-drinks", "cat-energy-drinks")).toBe(false);
  });
});

describe("SponsorshipExclusivityService — scope decides whether a conflict is one", () => {
  let service: SponsorshipExclusivityService;

  beforeEach(() => {
    service = build();
  });

  test("a venue grant reaches an event held at that venue", () => {
    service.signGrant(
      grant({
        grantId: "grant-hall",
        brandId: "brand-vault-cola",
        categoryId: "cat-beverages",
        scope: { level: "VENUE", venueId: "venue-great-hall" },
      }),
    );

    const decision = service.checkProposed(
      proposal({
        brandId: "brand-voltade",
        categoryId: "cat-energy-drinks",
        scope: { level: "EVENT", eventId: "event-ball" },
        termFrom: MARCH_NIGHT_FROM,
        termTo: MARCH_NIGHT_TO,
      }),
      NOW,
    );

    expect(decision.outcome).toBe("BLOCKED");
  });

  test("the same grant does not reach an event somewhere else", () => {
    service.signGrant(
      grant({
        grantId: "grant-hall",
        brandId: "brand-vault-cola",
        categoryId: "cat-beverages",
        scope: { level: "VENUE", venueId: "venue-great-hall" },
      }),
    );

    const decision = service.checkProposed(
      proposal({
        brandId: "brand-voltade",
        categoryId: "cat-energy-drinks",
        scope: { level: "EVENT", eventId: "event-careers-fair" },
        termFrom: new Date("2028-11-05T00:00:00.000Z"),
        termTo: new Date("2028-11-06T00:00:00.000Z"),
      }),
      NOW,
    );

    expect(decision.outcome).toBe("PERMITTED");
  });

  test("a club season grant reaches that club's events and not another club's", () => {
    service.signGrant(
      grant({
        grantId: "grant-rugby",
        brandId: "brand-northbank",
        categoryId: "cat-retail-banking",
        scope: { level: "CLUB_SEASON", clubId: "club-rugby", seasonId: "season-2028-29" },
      }),
    );

    const rugbyFinal = service.checkProposed(
      proposal({
        brandId: "brand-southbank",
        categoryId: "cat-retail-banking",
        scope: { level: "EVENT", eventId: "event-rugby-final" },
        termFrom: new Date("2029-04-20T00:00:00.000Z"),
        termTo: new Date("2029-04-21T00:00:00.000Z"),
      }),
      NOW,
    );
    expect(rugbyFinal.outcome).toBe("BLOCKED");

    const careersFair = service.checkProposed(
      proposal({
        brandId: "brand-southbank",
        categoryId: "cat-retail-banking",
        scope: { level: "EVENT", eventId: "event-careers-fair" },
        termFrom: new Date("2028-11-05T00:00:00.000Z"),
        termTo: new Date("2028-11-06T00:00:00.000Z"),
      }),
      NOW,
    );
    expect(careersFair.outcome).toBe("PERMITTED");
  });

  test("a union-wide grant reaches everything", () => {
    service.signGrant(
      grant({
        grantId: "grant-union",
        brandId: "brand-northbank",
        categoryId: "cat-retail-banking",
        scope: { level: "UNION_WIDE" },
      }),
    );

    const decision = service.checkProposed(
      proposal({
        brandId: "brand-southbank",
        categoryId: "cat-retail-banking",
        scope: { level: "EVENT", eventId: "event-careers-fair" },
        termFrom: new Date("2028-11-05T00:00:00.000Z"),
        termTo: new Date("2028-11-06T00:00:00.000Z"),
      }),
      NOW,
    );

    expect(decision.outcome).toBe("BLOCKED");
  });
});

describe("SponsorshipExclusivityService — terms intersect, partially is enough", () => {
  let service: SponsorshipExclusivityService;

  beforeEach(() => {
    service = build();
  });

  test("a season-long promise is broken by one night inside it", () => {
    service.signGrant(
      grant({
        grantId: "grant-season",
        brandId: "brand-northbank",
        categoryId: "cat-retail-banking",
      }),
    );

    const decision = service.checkProposed(
      proposal({
        brandId: "brand-southbank",
        categoryId: "cat-retail-banking",
        scope: { level: "EVENT", eventId: "event-ball" },
        termFrom: MARCH_NIGHT_FROM,
        termTo: MARCH_NIGHT_TO,
      }),
      NOW,
    );

    expect(decision.outcome).toBe("BLOCKED");
    expect(decision.conflicts[0].reasons).toContain("Terms intersect.");
  });

  test("a term that begins where another ends does not overlap it", () => {
    const boundary = new Date("2029-01-01T00:00:00.000Z");
    expect(
      service.termsOverlap(SEASON_FROM, boundary, boundary, new Date("2029-06-01T00:00:00.000Z")),
    ).toBe(false);

    service.signGrant(
      grant({
        grantId: "grant-autumn",
        brandId: "brand-northbank",
        categoryId: "cat-retail-banking",
        termFrom: SEASON_FROM,
        termTo: boundary,
      }),
    );

    const decision = service.checkProposed(
      proposal({
        brandId: "brand-southbank",
        categoryId: "cat-retail-banking",
        termFrom: boundary,
        termTo: new Date("2029-06-01T00:00:00.000Z"),
      }),
      NOW,
    );

    expect(decision.outcome).toBe("PERMITTED");
  });

  test("an expired grant protects nothing", () => {
    service.signGrant(
      grant({
        grantId: "grant-last-year",
        brandId: "brand-northbank",
        categoryId: "cat-retail-banking",
        termFrom: new Date("2027-09-01T00:00:00.000Z"),
        termTo: new Date("2028-08-01T00:00:00.000Z"),
      }),
    );

    const decision = service.checkProposed(
      proposal({ brandId: "brand-southbank", categoryId: "cat-retail-banking" }),
      NOW,
    );

    expect(decision.outcome).toBe("PERMITTED");
  });
});

describe("SponsorshipExclusivityService — exclusivity has strengths", () => {
  let service: SponsorshipExclusivityService;

  beforeEach(() => {
    service = build();
  });

  function signTierLimited(): void {
    service.signGrant(
      grant({
        grantId: "grant-tier",
        brandId: "brand-northbank",
        categoryId: "cat-retail-banking",
        strength: "ABOVE_TIER",
        // No competitor at tier 2 or better.
        blocksCompetitorsAtOrAboveTier: 2,
      }),
    );
  }

  test("a tier-limited grant blocks a headline competitor", () => {
    signTierLimited();

    const decision = service.checkProposed(
      proposal({ brandId: "brand-southbank", categoryId: "cat-retail-banking", tier: 1 }),
      NOW,
    );

    expect(decision.outcome).toBe("BLOCKED");
    expect(decision.conflicts[0].effect).toBe("BLOCK");
  });

  test("the same grant permits a small one, and still reports it", () => {
    signTierLimited();

    const decision = service.checkProposed(
      proposal({ brandId: "brand-southbank", categoryId: "cat-retail-banking", tier: 4 }),
      NOW,
    );

    expect(decision.outcome).toBe("PERMITTED");
    expect(decision.permitted).toBe(true);
    // Permitted is not the same as invisible.
    expect(decision.conflicts).toHaveLength(1);
    expect(decision.conflicts[0].effect).toBe("PERMITTED_BELOW_TIER");
  });

  test("first refusal is an obligation to offer, not a block", () => {
    service.signGrant(
      grant({
        grantId: "grant-first-refusal",
        brandId: "brand-northbank",
        categoryId: "cat-retail-banking",
        strength: "FIRST_REFUSAL",
      }),
    );

    const decision = service.checkProposed(
      proposal({ brandId: "brand-southbank", categoryId: "cat-retail-banking" }),
      NOW,
    );

    expect(decision.outcome).toBe("OFFER_REQUIRED");
    expect(decision.permitted).toBe(true);
    expect(decision.conflicts[0].effect).toBe("OFFER_REQUIRED");
  });

  test("a named carve-out permits the deal it was negotiated for", () => {
    service.signGrant(
      grant({
        grantId: "grant-carved",
        brandId: "brand-vault-cola",
        categoryId: "cat-beverages",
        carveOutBrandIds: ["brand-voltade"],
      }),
    );

    const decision = service.checkProposed(
      proposal({ brandId: "brand-voltade", categoryId: "cat-energy-drinks" }),
      NOW,
    );

    expect(decision.outcome).toBe("PERMITTED");
    expect(decision.conflicts[0].effect).toBe("PERMITTED_BY_CARVE_OUT");
  });

  test("a carve-out extends to the carved-out brand's group", () => {
    service.signGrant(
      grant({
        grantId: "grant-carved",
        brandId: "brand-vault-cola",
        categoryId: "cat-beverages",
        carveOutBrandIds: ["brand-voltade"],
      }),
    );

    // A sibling brand under the same parent. A carve-out that did not follow
    // the group would be worthless the moment the group re-branded.
    const decision = service.checkProposed(
      proposal({ brandId: "brand-voltade-zero", categoryId: "cat-energy-drinks" }),
      NOW,
    );

    expect(decision.outcome).toBe("PERMITTED");
    expect(decision.conflicts[0].effect).toBe("PERMITTED_BY_CARVE_OUT");
  });
});

describe("SponsorshipExclusivityService — sweeping deals entered after the fact", () => {
  let service: SponsorshipExclusivityService;

  beforeEach(() => {
    service = build();

    service.signGrant(
      grant({
        grantId: "grant-01",
        brandId: "brand-northbank",
        categoryId: "cat-financial-services",
        signedAt: new Date("2028-08-01T00:00:00.000Z"),
      }),
    );
    service.signGrant(
      grant({
        grantId: "grant-02",
        brandId: "brand-southbank",
        categoryId: "cat-retail-banking",
        scope: { level: "EVENT", eventId: "event-ball" },
        termFrom: MARCH_NIGHT_FROM,
        termTo: MARCH_NIGHT_TO,
        signedAt: new Date("2028-09-15T00:00:00.000Z"),
      }),
    );
    service.signGrant(
      grant({
        grantId: "grant-03",
        brandId: "brand-quickcover",
        categoryId: "cat-insurance",
        scope: { level: "CLUB_SEASON", clubId: "club-rugby", seasonId: "season-2028-29" },
        signedAt: new Date("2028-09-20T00:00:00.000Z"),
      }),
    );
    service.signGrant(
      grant({
        grantId: "grant-04",
        brandId: "brand-voltade",
        categoryId: "cat-beverages",
        scope: { level: "VENUE", venueId: "venue-great-hall" },
        strength: "FIRST_REFUSAL",
        signedAt: new Date("2028-08-05T00:00:00.000Z"),
      }),
    );
    service.signGrant(
      grant({
        grantId: "grant-05",
        brandId: "brand-vault-cola",
        categoryId: "cat-soft-drinks",
        scope: { level: "EVENT", eventId: "event-ball" },
        termFrom: MARCH_NIGHT_FROM,
        termTo: MARCH_NIGHT_TO,
        signedAt: new Date("2028-10-01T00:00:00.000Z"),
      }),
    );
  });

  test("the sweep finds the breaches and ranks the serious ones first", () => {
    const findings = service.sweep(NOW);

    expect(findings).toHaveLength(3);
    // Absolute union-wide promises outrank a first-refusal right over a venue.
    expect(findings[0].effect).toBe("BLOCK");
    expect(findings[1].effect).toBe("BLOCK");
    expect(findings[2].effect).toBe("OFFER_REQUIRED");
    expect(findings[2].incumbentGrantId).toBe("grant-04");

    const severities = findings.map((finding) => finding.severity);
    expect(severities).toEqual([...severities].sort((a, b) => b - a));
  });

  test("the later signature is the challenger and the earlier promise the incumbent", () => {
    const findings = service.sweep(NOW);
    const ballConflict = findings.find((finding) => finding.challengerGrantId === "grant-02");

    expect(ballConflict?.incumbentGrantId).toBe("grant-01");
    expect(ballConflict?.incumbentBrandId).toBe("brand-northbank");
    expect(ballConflict?.challengerBrandId).toBe("brand-southbank");
  });

  test("an undispositioned conflict stays outstanding", () => {
    expect(service.outstandingConflicts(NOW)).toHaveLength(3);
    expect(service.sweep(NOW).every((finding) => finding.disposition === "OUTSTANDING")).toBe(true);
  });

  test("dispositioning a conflict takes it off the outstanding list without hiding it", () => {
    const [first] = service.sweep(NOW);
    service.disposition(first.conflictId, "WAIVED_BY_INCUMBENT");

    const outstanding = service.outstandingConflicts(NOW);
    expect(outstanding).toHaveLength(2);
    expect(outstanding.map((finding) => finding.conflictId)).not.toContain(first.conflictId);

    // Still in the register, with what was done about it.
    const swept = service.sweep(NOW).find((finding) => finding.conflictId === first.conflictId);
    expect(swept?.disposition).toBe("WAIVED_BY_INCUMBENT");
  });
});
