/**
 * Test suite: Contractor Site Access (#4923)
 * File: tests/services/contractorSiteAccessService.test.ts
 *
 * Every case here is one that a present-and-in-date check passes: a certificate
 * that lapses between approval and arrival, a policy that is current and below
 * the limit, a compliant company sending an apprentice who is not signed off,
 * a method statement reused for a job it was not written for, and two permits
 * that are each fine and jointly a bad afternoon.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  ContractorSiteAccessService,
  REQUIRED_EMPLOYERS_LIABILITY_PENCE,
  type AccessDecision,
  type Refusal,
  type RefusalKind,
} from "../../src/services/contractorSiteAccessService";

const MARQUEE_CO = "co-fenwick-marquees";
const SCAFFOLD_CO = "co-hartley-scaffolding";

const FITTER = "per-fitter-ali";
const APPRENTICE = "per-apprentice-jo";
const OUTSIDER = "per-scaffolder-sam";

const ACT_MARQUEE = "erect-marquee";
const ACT_HEIGHT = "work-at-height";
const ACT_HOT = "hot-work";
const ACT_FUEL = "fuel-handling";
const ACT_TIDY = "site-tidy";

const ZONE_LAWN = "zone-front-lawn";
const ZONE_BAY = "zone-loading-bay";

const WORKS = "works-ball-marquee";
const OTHER_WORKS = "works-generator-refuel";

const DOC_EL = "doc-marquee-el";
const DOC_PL = "doc-marquee-pl";
const DOC_RAMS = "doc-marquee-rams";
const COMP_STRUCTURES = "comp-ali-structures";

const MILLION = 100_000_000;

/** The morning the marquee goes up. */
const BUILD_START = new Date("2027-05-12T08:00:00.000Z");
const BUILD_END = new Date("2027-05-12T18:00:00.000Z");
const DAY = 86_400_000;
const HOUR = 3_600_000;

function day(offset: number): Date {
  return new Date(BUILD_START.getTime() + offset * DAY);
}

function hour(offset: number): Date {
  return new Date(BUILD_START.getTime() + offset * HOUR);
}

function kinds(decision: AccessDecision): RefusalKind[] {
  return decision.refusals.map((refusal) => refusal.kind);
}

function find(decision: AccessDecision, kind: RefusalKind): Refusal | undefined {
  return decision.refusals.find((refusal) => refusal.kind === kind);
}

function build(): ContractorSiteAccessService {
  const service = new ContractorSiteAccessService();

  service.registerCompany({ companyId: MARQUEE_CO, name: "Fenwick Marquees" });
  service.registerCompany({ companyId: SCAFFOLD_CO, name: "Hartley Scaffolding" });

  service.registerPerson({ personId: FITTER, companyId: MARQUEE_CO, name: "Ali Fitter" });
  service.registerPerson({ personId: APPRENTICE, companyId: MARQUEE_CO, name: "Jo Apprentice" });
  service.registerPerson({ personId: OUTSIDER, companyId: SCAFFOLD_CO, name: "Sam Scaffolder" });

  service.registerActivity({
    activityCode: ACT_MARQUEE,
    label: "Erect marquee",
    requiredIndemnityPence: 1 * MILLION,
    requiresRams: true,
    requiredCompetencies: ["temporary-structures"],
  });

  service.registerActivity({
    activityCode: ACT_HEIGHT,
    label: "Work at height",
    requiredIndemnityPence: 5 * MILLION,
    requiresRams: true,
    requiredCompetencies: ["ipaf"],
  });

  service.registerActivity({
    activityCode: ACT_HOT,
    label: "Hot work",
    requiredIndemnityPence: 1 * MILLION,
    requiresRams: true,
    requiredCompetencies: ["hot-work-ticket"],
  });

  service.registerActivity({
    activityCode: ACT_FUEL,
    label: "Fuel handling",
    requiredIndemnityPence: 1 * MILLION,
    requiresRams: false,
    requiredCompetencies: [],
  });

  service.registerActivity({
    activityCode: ACT_TIDY,
    label: "Site tidy",
    requiredIndemnityPence: 0,
    requiresRams: false,
    requiredCompetencies: [],
  });

  service.registerActivityConflict({
    activityA: ACT_HOT,
    activityB: ACT_FUEL,
    reason: "ignition source alongside a fuel transfer",
  });

  service.registerDocument({
    documentId: DOC_EL,
    companyId: MARQUEE_CO,
    kind: "EMPLOYERS_LIABILITY",
    reference: "EL/2027/8841",
    validFrom: day(-200),
    validUntil: day(200),
    indemnityLimitPence: REQUIRED_EMPLOYERS_LIABILITY_PENCE,
  });

  service.registerDocument({
    documentId: DOC_PL,
    companyId: MARQUEE_CO,
    kind: "PUBLIC_LIABILITY",
    reference: "PL/2027/1120",
    validFrom: day(-200),
    validUntil: day(200),
    indemnityLimitPence: 2 * MILLION,
  });

  service.registerDocument({
    documentId: DOC_RAMS,
    companyId: MARQUEE_CO,
    kind: "RAMS",
    reference: "RAMS-MARQUEE-8x12-GRASS",
    validFrom: day(-200),
    validUntil: day(200),
    coversActivities: [ACT_MARQUEE, ACT_HOT],
  });

  // Hartley hold insurance but have never filed a method statement.
  service.registerDocument({
    documentId: "doc-scaffold-el",
    companyId: SCAFFOLD_CO,
    kind: "EMPLOYERS_LIABILITY",
    reference: "EL/2027/2201",
    validFrom: day(-200),
    validUntil: day(200),
    indemnityLimitPence: REQUIRED_EMPLOYERS_LIABILITY_PENCE,
  });

  service.registerDocument({
    documentId: "doc-scaffold-pl",
    companyId: SCAFFOLD_CO,
    kind: "PUBLIC_LIABILITY",
    reference: "PL/2027/2202",
    validFrom: day(-200),
    validUntil: day(200),
    indemnityLimitPence: 5 * MILLION,
  });

  service.registerCompetency({
    competencyId: COMP_STRUCTURES,
    personId: FITTER,
    activityCode: "temporary-structures",
    certificateReference: "TS-4471",
    validFrom: day(-100),
    validUntil: day(100),
  });

  service.registerCompetency({
    competencyId: "comp-ali-hot-work",
    personId: FITTER,
    activityCode: "hot-work-ticket",
    certificateReference: "HW-9002",
    validFrom: day(-100),
    validUntil: day(100),
  });

  service.submitWorksOrder({
    worksId: WORKS,
    companyId: MARQUEE_CO,
    zoneId: ZONE_LAWN,
    description: "Erect 8m x 12m marquee for the summer ball",
    activityCodes: [ACT_MARQUEE],
    personnelIds: [FITTER],
    windowStart: BUILD_START,
    windowEnd: BUILD_END,
  });

  return service;
}

describe("ContractorSiteAccessService — the compliant baseline", () => {
  let service: ContractorSiteAccessService;

  beforeEach(() => {
    service = build();
  });

  test("grants access when the paperwork covers the window and the named person is competent", () => {
    const decision = service.evaluate(WORKS);

    expect(decision.granted).toBe(true);
    expect(decision.refusals).toEqual([]);
  });

  test("the decision reports the window it was evaluated over", () => {
    const decision = service.evaluate(WORKS);

    expect(decision.evaluatedFrom).toEqual(BUILD_START);
    expect(decision.evaluatedTo).toEqual(BUILD_END);
  });

  test("issues a permit and marks the works order permitted", () => {
    const result = service.issuePermit(WORKS, "user-estates-lead", hour(-24));

    expect(result.outcome).toBe("ISSUED");
    expect(result.permitId).not.toBeNull();
    expect(service.getWorksOrder(WORKS)?.status).toBe("PERMITTED");
    expect(service.getWorksOrder(WORKS)?.permitId).toBe(result.permitId);
  });

  test("the permit records the work it was issued against", () => {
    const result = service.issuePermit(WORKS, "user-estates-lead", hour(-24));
    const permit = service.getPermit(result.permitId as string);

    expect(permit?.activityCodes).toEqual([ACT_MARQUEE]);
    expect(permit?.personnelIds).toEqual([FITTER]);
    expect(permit?.windowStart).toEqual(BUILD_START);
    expect(permit?.zoneId).toBe(ZONE_LAWN);
  });

  test("a live permit shows in its zone during the window and not outside it", () => {
    service.issuePermit(WORKS, "user-estates-lead", hour(-24));

    expect(service.livePermitsInZone(ZONE_LAWN, hour(4))).toHaveLength(1);
    expect(service.livePermitsInZone(ZONE_LAWN, hour(-4))).toHaveLength(0);
    expect(service.livePermitsInZone(ZONE_BAY, hour(4))).toHaveLength(0);
  });
});

describe("ContractorSiteAccessService — validity is judged at the works window", () => {
  let service: ContractorSiteAccessService;

  function reissueEmployersLiability(validFrom: Date, validUntil: Date): void {
    service.registerDocument({
      documentId: DOC_EL,
      companyId: MARQUEE_CO,
      kind: "EMPLOYERS_LIABILITY",
      reference: "EL/2027/8841",
      validFrom,
      validUntil,
      indemnityLimitPence: REQUIRED_EMPLOYERS_LIABILITY_PENCE,
    });
  }

  beforeEach(() => {
    service = build();
  });

  test("refuses when the certificate lapsed between approval and arrival", () => {
    reissueEmployersLiability(day(-200), day(-12));

    const decision = service.evaluate(WORKS);

    expect(decision.granted).toBe(false);
    expect(kinds(decision)).toContain("DOCUMENT_EXPIRED");
  });

  test("names the instant the evidence stopped covering the work", () => {
    reissueEmployersLiability(day(-200), day(-12));

    const refusal = find(service.evaluate(WORKS), "DOCUMENT_EXPIRED");

    expect(refusal?.documentKind).toBe("EMPLOYERS_LIABILITY");
    expect(refusal?.lapsedAt).toEqual(day(-12));
  });

  test("a certificate that was valid on the day of approval still refuses on the day of work", () => {
    reissueEmployersLiability(day(-200), day(-12));

    // Valid when somebody opened the PDF in March.
    expect(service.isDocumentValidAt(DOC_EL, day(-30))).toBe(true);
    // Not valid for the thing it was approved for.
    expect(service.evaluate(WORKS).granted).toBe(false);
  });

  test("refuses a certificate that only starts after the works begin", () => {
    reissueEmployersLiability(day(5), day(200));

    const decision = service.evaluate(WORKS);

    expect(kinds(decision)).toContain("DOCUMENT_NOT_YET_VALID");
    expect(find(decision, "DOCUMENT_NOT_YET_VALID")?.lapsedAt).toBeNull();
  });

  test("refuses a certificate that lapses part-way through a two-day build", () => {
    service.amendWorksOrder(WORKS, { windowEnd: day(2) });
    reissueEmployersLiability(day(-200), day(1));

    expect(kinds(service.evaluate(WORKS))).toContain("DOCUMENT_EXPIRED");
  });

  test("a certificate covering the whole two-day build is accepted", () => {
    service.amendWorksOrder(WORKS, { windowEnd: day(2) });

    expect(service.evaluate(WORKS).granted).toBe(true);
  });

  test("isDocumentValidAt treats the expiry instant as exclusive", () => {
    expect(service.isDocumentValidAt(DOC_EL, day(199))).toBe(true);
    expect(service.isDocumentValidAt(DOC_EL, day(200))).toBe(false);
  });

  test("isDocumentValidAt is false for a document that does not exist", () => {
    expect(service.isDocumentValidAt("doc-imaginary", BUILD_START)).toBe(false);
  });

  test("documentCoversWindow refuses a certificate that falls one millisecond short", () => {
    reissueEmployersLiability(day(-200), new Date(BUILD_END.getTime() - 1));

    expect(service.documentCoversWindow(DOC_EL, BUILD_START, BUILD_END)).toBe(false);
    expect(service.documentCoversWindow(DOC_EL, BUILD_START, hour(9))).toBe(true);
  });

  test("refuses when the company holds no employers' liability certificate at all", () => {
    service.registerCompany({ companyId: "co-new", name: "Brand New Marquees" });
    service.registerPerson({ personId: "per-new", companyId: "co-new", name: "New Starter" });
    service.submitWorksOrder({
      worksId: "works-new",
      companyId: "co-new",
      zoneId: ZONE_LAWN,
      description: "Site tidy",
      activityCodes: [ACT_TIDY],
      personnelIds: ["per-new"],
      windowStart: BUILD_START,
      windowEnd: BUILD_END,
    });

    const refusal = find(service.evaluate("works-new"), "DOCUMENT_MISSING");

    expect(refusal?.documentKind).toBe("EMPLOYERS_LIABILITY");
    expect(refusal?.detail).toContain("Brand New Marquees");
  });
});

describe("ContractorSiteAccessService — indemnity limits", () => {
  let service: ContractorSiteAccessService;

  beforeEach(() => {
    service = build();
  });

  test("refuses a policy that is current and below the limit the activity demands", () => {
    service.amendWorksOrder(WORKS, { activityCodes: [ACT_MARQUEE, ACT_HEIGHT] });

    expect(kinds(service.evaluate(WORKS))).toContain("INSUFFICIENT_INDEMNITY");
  });

  test("reports the shortfall as an amount rather than a boolean", () => {
    service.amendWorksOrder(WORKS, { activityCodes: [ACT_MARQUEE, ACT_HEIGHT] });

    const refusal = find(service.evaluate(WORKS), "INSUFFICIENT_INDEMNITY");

    expect(refusal?.shortfallPence).toBe(3 * MILLION);
    expect(refusal?.detail).toContain("£3,000,000.00");
  });

  test("names the activity that demanded the higher limit", () => {
    service.amendWorksOrder(WORKS, { activityCodes: [ACT_MARQUEE, ACT_HEIGHT] });

    expect(find(service.evaluate(WORKS), "INSUFFICIENT_INDEMNITY")?.activityCode).toBe(ACT_HEIGHT);
  });

  test("two policies below the limit do not add up to one that meets it", () => {
    service.registerDocument({
      documentId: "doc-marquee-pl-2",
      companyId: MARQUEE_CO,
      kind: "PUBLIC_LIABILITY",
      reference: "PL/2027/1121",
      validFrom: day(-200),
      validUntil: day(200),
      indemnityLimitPence: 2 * MILLION,
    });
    service.amendWorksOrder(WORKS, { activityCodes: [ACT_HEIGHT] });

    expect(find(service.evaluate(WORKS), "INSUFFICIENT_INDEMNITY")?.shortfallPence).toBe(
      3 * MILLION,
    );
  });

  test("the highest single policy in force governs", () => {
    service.registerDocument({
      documentId: "doc-marquee-pl-2",
      companyId: MARQUEE_CO,
      kind: "PUBLIC_LIABILITY",
      reference: "PL/2027/1121",
      validFrom: day(-200),
      validUntil: day(200),
      indemnityLimitPence: 5 * MILLION,
    });
    service.amendWorksOrder(WORKS, { activityCodes: [ACT_HEIGHT], personnelIds: [FITTER] });

    expect(kinds(service.evaluate(WORKS))).not.toContain("INSUFFICIENT_INDEMNITY");
  });

  test("refuses when employers' liability is present but below the statutory figure", () => {
    service.registerDocument({
      documentId: DOC_EL,
      companyId: MARQUEE_CO,
      kind: "EMPLOYERS_LIABILITY",
      reference: "EL/2027/8841",
      validFrom: day(-200),
      validUntil: day(200),
      indemnityLimitPence: 1 * MILLION,
    });

    const refusal = find(service.evaluate(WORKS), "INSUFFICIENT_INDEMNITY");

    expect(refusal?.documentKind).toBe("EMPLOYERS_LIABILITY");
    expect(refusal?.shortfallPence).toBe(REQUIRED_EMPLOYERS_LIABILITY_PENCE - 1 * MILLION);
  });

  test("work demanding no cover needs no public liability certificate", () => {
    service.registerCompany({ companyId: "co-tidy", name: "Tidy Crew" });
    service.registerPerson({ personId: "per-tidy", companyId: "co-tidy", name: "Tidy Person" });
    service.registerDocument({
      documentId: "doc-tidy-el",
      companyId: "co-tidy",
      kind: "EMPLOYERS_LIABILITY",
      reference: "EL/2027/3300",
      validFrom: day(-200),
      validUntil: day(200),
      indemnityLimitPence: REQUIRED_EMPLOYERS_LIABILITY_PENCE,
    });
    service.submitWorksOrder({
      worksId: "works-tidy",
      companyId: "co-tidy",
      zoneId: ZONE_LAWN,
      description: "Clear the lawn after the ball",
      activityCodes: [ACT_TIDY],
      personnelIds: ["per-tidy"],
      windowStart: BUILD_START,
      windowEnd: BUILD_END,
    });

    expect(service.evaluate("works-tidy").granted).toBe(true);
  });

  test("refuses when the public liability certificate does not cover the window", () => {
    service.registerDocument({
      documentId: DOC_PL,
      companyId: MARQUEE_CO,
      kind: "PUBLIC_LIABILITY",
      reference: "PL/2027/1120",
      validFrom: day(-200),
      validUntil: day(-5),
      indemnityLimitPence: 2 * MILLION,
    });

    const refusal = find(service.evaluate(WORKS), "DOCUMENT_EXPIRED");

    expect(refusal?.documentKind).toBe("PUBLIC_LIABILITY");
  });
});

describe("ContractorSiteAccessService — competency is per person", () => {
  let service: ContractorSiteAccessService;

  beforeEach(() => {
    service = build();
  });

  test("a compliant company does not make an unticketed operative competent", () => {
    service.amendWorksOrder(WORKS, { personnelIds: [FITTER, APPRENTICE] });

    const decision = service.evaluate(WORKS);

    expect(decision.granted).toBe(false);
    expect(kinds(decision)).toEqual(["COMPETENCY_MISSING"]);
  });

  test("names the person and the work they are not signed off for", () => {
    service.amendWorksOrder(WORKS, { personnelIds: [FITTER, APPRENTICE] });

    const refusal = find(service.evaluate(WORKS), "COMPETENCY_MISSING");

    expect(refusal?.personId).toBe(APPRENTICE);
    expect(refusal?.activityCode).toBe(ACT_MARQUEE);
    expect(refusal?.detail).toContain("temporary-structures");
  });

  test("accepts when every named person holds the competency", () => {
    service.registerCompetency({
      competencyId: "comp-jo-structures",
      personId: APPRENTICE,
      activityCode: "temporary-structures",
      certificateReference: "TS-5510",
      validFrom: day(-10),
      validUntil: day(100),
    });
    service.amendWorksOrder(WORKS, { personnelIds: [FITTER, APPRENTICE] });

    expect(service.evaluate(WORKS).granted).toBe(true);
  });

  test("refuses a competency that lapses part-way through the works window", () => {
    service.registerCompetency({
      competencyId: COMP_STRUCTURES,
      personId: FITTER,
      activityCode: "temporary-structures",
      certificateReference: "TS-4471",
      validFrom: day(-100),
      validUntil: hour(2),
    });

    const refusal = find(service.evaluate(WORKS), "COMPETENCY_EXPIRED");

    expect(refusal?.personId).toBe(FITTER);
    expect(refusal?.lapsedAt).toEqual(hour(2));
  });

  test("refuses a competency issued after the works begin", () => {
    service.registerCompetency({
      competencyId: COMP_STRUCTURES,
      personId: FITTER,
      activityCode: "temporary-structures",
      certificateReference: "TS-4471",
      validFrom: hour(2),
      validUntil: day(100),
    });

    expect(kinds(service.evaluate(WORKS))).toContain("COMPETENCY_EXPIRED");
  });

  test("refuses an operative who is not registered at all", () => {
    service.amendWorksOrder(WORKS, { personnelIds: ["per-mate-from-the-pub"] });

    expect(kinds(service.evaluate(WORKS))).toEqual(["UNKNOWN_PERSONNEL"]);
  });

  test("refuses an operative employed by a different company", () => {
    service.amendWorksOrder(WORKS, { personnelIds: [FITTER, OUTSIDER] });

    const decision = service.evaluate(WORKS);

    expect(kinds(decision)).toContain("PERSONNEL_NOT_EMPLOYED_BY_COMPANY");
    expect(find(decision, "PERSONNEL_NOT_EMPLOYED_BY_COMPANY")?.detail).toContain(
      "Hartley Scaffolding",
    );
  });

  test("isCompetentAt is true inside the certificate window and false past it", () => {
    expect(service.isCompetentAt(FITTER, "temporary-structures", BUILD_START)).toBe(true);
    expect(service.isCompetentAt(FITTER, "temporary-structures", day(101))).toBe(false);
    expect(service.isCompetentAt(APPRENTICE, "temporary-structures", BUILD_START)).toBe(false);
  });

  test("a works order naming nobody is refused", () => {
    service.amendWorksOrder(WORKS, { personnelIds: [] });

    expect(kinds(service.evaluate(WORKS))).toContain("NO_PERSONNEL");
  });

  test("a works order describing no activity is refused", () => {
    service.amendWorksOrder(WORKS, { activityCodes: [] });

    expect(kinds(service.evaluate(WORKS))).toContain("NO_ACTIVITIES");
  });

  test("an activity with no registered requirement cannot be assessed", () => {
    service.amendWorksOrder(WORKS, { activityCodes: ["abseil-off-the-clock-tower"] });

    const refusal = find(service.evaluate(WORKS), "UNKNOWN_ACTIVITY");

    expect(refusal?.activityCode).toBe("abseil-off-the-clock-tower");
  });
});

describe("ContractorSiteAccessService — RAMS scope", () => {
  let service: ContractorSiteAccessService;

  beforeEach(() => {
    service = build();
  });

  test("refuses an activity that has drifted outside the approved method statement", () => {
    service.amendWorksOrder(WORKS, { activityCodes: [ACT_MARQUEE, ACT_HEIGHT] });

    const refusal = find(service.evaluate(WORKS), "RAMS_SCOPE_GAP");

    expect(refusal?.activityCode).toBe(ACT_HEIGHT);
    expect(refusal?.documentKind).toBe("RAMS");
  });

  test("accepts when the RAMS covers every activity that needs one", () => {
    service.amendWorksOrder(WORKS, { activityCodes: [ACT_MARQUEE, ACT_HOT] });

    expect(service.evaluate(WORKS).granted).toBe(true);
  });

  test("an activity that needs no RAMS needs no scope cover", () => {
    service.amendWorksOrder(WORKS, { activityCodes: [ACT_FUEL] });

    expect(kinds(service.evaluate(WORKS))).not.toContain("RAMS_SCOPE_GAP");
  });

  test("refuses when there is no method statement on file at all", () => {
    service.submitWorksOrder({
      worksId: "works-scaffold",
      companyId: SCAFFOLD_CO,
      zoneId: ZONE_LAWN,
      description: "Camera tower",
      activityCodes: [ACT_MARQUEE],
      personnelIds: [OUTSIDER],
      windowStart: BUILD_START,
      windowEnd: BUILD_END,
    });

    const refusal = find(service.evaluate("works-scaffold"), "DOCUMENT_MISSING");

    expect(refusal?.documentKind).toBe("RAMS");
  });

  test("a RAMS that does not cover the works window is an expiry, not a scope gap", () => {
    service.registerDocument({
      documentId: DOC_RAMS,
      companyId: MARQUEE_CO,
      kind: "RAMS",
      reference: "RAMS-MARQUEE-8x12-GRASS",
      validFrom: day(-200),
      validUntil: day(-2),
      coversActivities: [ACT_MARQUEE, ACT_HOT],
    });

    const decision = service.evaluate(WORKS);

    expect(find(decision, "DOCUMENT_EXPIRED")?.documentKind).toBe("RAMS");
    expect(kinds(decision)).not.toContain("RAMS_SCOPE_GAP");
  });

  test("a RAMS with no declared activity scope covers nothing", () => {
    service.registerDocument({
      documentId: DOC_RAMS,
      companyId: MARQUEE_CO,
      kind: "RAMS",
      reference: "RAMS-GENERIC",
      validFrom: day(-200),
      validUntil: day(200),
    });

    expect(kinds(service.evaluate(WORKS))).toContain("RAMS_SCOPE_GAP");
  });
});

describe("ContractorSiteAccessService — permits that know about each other", () => {
  let service: ContractorSiteAccessService;

  function submitFuelWorks(zoneId: string, windowStart: Date, windowEnd: Date): void {
    service.submitWorksOrder({
      worksId: OTHER_WORKS,
      companyId: MARQUEE_CO,
      zoneId,
      description: "Refuel the generator",
      activityCodes: [ACT_FUEL],
      personnelIds: [FITTER],
      windowStart,
      windowEnd,
    });
  }

  function permitHotWorkInBay(): string {
    service.submitWorksOrder({
      worksId: "works-hot-cutting",
      companyId: MARQUEE_CO,
      zoneId: ZONE_BAY,
      description: "Cut and weld staging brackets",
      activityCodes: [ACT_HOT],
      personnelIds: [FITTER],
      windowStart: BUILD_START,
      windowEnd: BUILD_END,
    });
    const result = service.issuePermit("works-hot-cutting", "user-estates-lead", hour(-24));
    expect(result.outcome).toBe("ISSUED");
    return result.permitId as string;
  }

  beforeEach(() => {
    service = build();
  });

  test("refuses work that conflicts with a live permit in the same zone", () => {
    permitHotWorkInBay();
    submitFuelWorks(ZONE_BAY, BUILD_START, BUILD_END);

    const decision = service.evaluate(OTHER_WORKS);

    expect(decision.granted).toBe(false);
    expect(kinds(decision)).toEqual(["PERMIT_CONFLICT"]);
  });

  test("names the permit on the other side of the conflict and why", () => {
    const permitId = permitHotWorkInBay();
    submitFuelWorks(ZONE_BAY, BUILD_START, BUILD_END);

    const refusal = find(service.evaluate(OTHER_WORKS), "PERMIT_CONFLICT");

    expect(refusal?.conflictingPermitId).toBe(permitId);
    expect(refusal?.detail).toContain("ignition source");
  });

  test("the same two activities in different zones do not conflict", () => {
    permitHotWorkInBay();
    submitFuelWorks(ZONE_LAWN, BUILD_START, BUILD_END);

    expect(service.evaluate(OTHER_WORKS).granted).toBe(true);
  });

  test("the same two activities at different times do not conflict", () => {
    permitHotWorkInBay();
    submitFuelWorks(ZONE_BAY, day(3), new Date(day(3).getTime() + 4 * HOUR));

    expect(service.evaluate(OTHER_WORKS).granted).toBe(true);
  });

  test("windows that merely touch at an endpoint do not overlap", () => {
    permitHotWorkInBay();
    submitFuelWorks(ZONE_BAY, BUILD_END, new Date(BUILD_END.getTime() + 4 * HOUR));

    expect(service.evaluate(OTHER_WORKS).granted).toBe(true);
  });

  test("a voided permit stops conflicting with anything", () => {
    permitHotWorkInBay();
    submitFuelWorks(ZONE_BAY, BUILD_START, BUILD_END);
    expect(service.evaluate(OTHER_WORKS).granted).toBe(false);

    service.cancelWorksOrder("works-hot-cutting", "Fabricator cancelled");

    expect(service.evaluate(OTHER_WORKS).granted).toBe(true);
  });

  test("unrelated activities share a zone happily", () => {
    permitHotWorkInBay();
    service.submitWorksOrder({
      worksId: "works-bay-tidy",
      companyId: MARQUEE_CO,
      zoneId: ZONE_BAY,
      description: "Sweep the bay",
      activityCodes: [ACT_TIDY],
      personnelIds: [FITTER],
      windowStart: BUILD_START,
      windowEnd: BUILD_END,
    });

    expect(service.evaluate("works-bay-tidy").granted).toBe(true);
  });

  test("a conflict is detected whichever activity was permitted first", () => {
    submitFuelWorks(ZONE_BAY, BUILD_START, BUILD_END);
    expect(service.issuePermit(OTHER_WORKS, "user-estates-lead", hour(-24)).outcome).toBe("ISSUED");

    service.submitWorksOrder({
      worksId: "works-hot-cutting",
      companyId: MARQUEE_CO,
      zoneId: ZONE_BAY,
      description: "Cut and weld staging brackets",
      activityCodes: [ACT_HOT],
      personnelIds: [FITTER],
      windowStart: BUILD_START,
      windowEnd: BUILD_END,
    });

    expect(kinds(service.evaluate("works-hot-cutting"))).toContain("PERMIT_CONFLICT");
  });

  test("a works order does not conflict with its own permit", () => {
    permitHotWorkInBay();

    expect(kinds(service.evaluate("works-hot-cutting"))).not.toContain("PERMIT_CONFLICT");
  });
});

describe("ContractorSiteAccessService — issue, amend and void", () => {
  let service: ContractorSiteAccessService;

  beforeEach(() => {
    service = build();
  });

  test("refuses to issue a permit when evaluation fails, and hands back the reasons", () => {
    service.amendWorksOrder(WORKS, { personnelIds: [APPRENTICE] });

    const result = service.issuePermit(WORKS, "user-estates-lead", hour(-24));

    expect(result.outcome).toBe("REFUSED_ACCESS_DENIED");
    expect(result.permitId).toBeNull();
    expect(result.decision?.refusals).toHaveLength(1);
    expect(service.getWorksOrder(WORKS)?.status).toBe("SUBMITTED");
  });

  test("refuses to issue a second permit for the same works order", () => {
    const first = service.issuePermit(WORKS, "user-estates-lead", hour(-24));

    const second = service.issuePermit(WORKS, "user-duty-manager", hour(-2));

    expect(second.outcome).toBe("REFUSED_ALREADY_PERMITTED");
    expect(second.permitId).toBe(first.permitId);
  });

  test("adding an activity after issue voids the permit", () => {
    const issued = service.issuePermit(WORKS, "user-estates-lead", hour(-24));

    const amendment = service.amendWorksOrder(WORKS, {
      activityCodes: [ACT_MARQUEE, ACT_HOT],
    });

    expect(amendment.voidedPermitId).toBe(issued.permitId);
    expect(service.getPermit(issued.permitId as string)?.status).toBe("VOIDED");
  });

  test("adding a person after issue voids the permit", () => {
    const issued = service.issuePermit(WORKS, "user-estates-lead", hour(-24));

    service.amendWorksOrder(WORKS, { personnelIds: [FITTER, APPRENTICE] });

    expect(service.getPermit(issued.permitId as string)?.status).toBe("VOIDED");
  });

  test("extending the window after issue voids the permit", () => {
    const issued = service.issuePermit(WORKS, "user-estates-lead", hour(-24));

    service.amendWorksOrder(WORKS, { windowEnd: day(2) });

    expect(service.getPermit(issued.permitId as string)?.status).toBe("VOIDED");
    expect(service.getPermit(issued.permitId as string)?.voidedReason).toContain("amended");
  });

  test("a voided permit returns the works order to submitted so it must be re-permitted", () => {
    service.issuePermit(WORKS, "user-estates-lead", hour(-24));
    service.amendWorksOrder(WORKS, { windowEnd: day(2) });

    expect(service.getWorksOrder(WORKS)?.status).toBe("SUBMITTED");
    expect(service.getWorksOrder(WORKS)?.permitId).toBeNull();
  });

  test("an amended order that is still compliant can be re-permitted", () => {
    const first = service.issuePermit(WORKS, "user-estates-lead", hour(-24));
    service.amendWorksOrder(WORKS, { activityCodes: [ACT_MARQUEE, ACT_HOT] });

    const second = service.issuePermit(WORKS, "user-estates-lead", hour(-2));

    expect(second.outcome).toBe("ISSUED");
    expect(second.permitId).not.toBe(first.permitId);
  });

  test("amending an order that holds no permit voids nothing", () => {
    const amendment = service.amendWorksOrder(WORKS, { activityCodes: [ACT_HOT] });

    expect(amendment.amended).toBe(true);
    expect(amendment.voidedPermitId).toBeNull();
  });

  test("cancelling the works order voids a live permit", () => {
    const issued = service.issuePermit(WORKS, "user-estates-lead", hour(-24));

    expect(service.cancelWorksOrder(WORKS, "Ball postponed")).toBe(true);
    expect(service.getPermit(issued.permitId as string)?.status).toBe("VOIDED");
    expect(service.getPermit(issued.permitId as string)?.voidedReason).toBe("Ball postponed");
  });

  test("a cancelled works order cannot be permitted or amended", () => {
    service.cancelWorksOrder(WORKS, "Ball postponed");

    expect(service.issuePermit(WORKS, "user-estates-lead", hour(-2)).outcome).toBe(
      "REFUSED_WORKS_CANCELLED",
    );
    expect(service.amendWorksOrder(WORKS, { activityCodes: [ACT_HOT] }).amended).toBe(false);
  });

  test("cancelling twice reports no second change", () => {
    service.cancelWorksOrder(WORKS, "Ball postponed");

    expect(service.cancelWorksOrder(WORKS, "Ball postponed again")).toBe(false);
  });

  test("refuses to issue against a works order that does not exist", () => {
    expect(service.issuePermit("works-imaginary", "user-estates-lead", hour(-2)).outcome).toBe(
      "REFUSED_UNKNOWN_WORKS",
    );
  });

  test("rejects an amendment that inverts the window", () => {
    expect(() => service.amendWorksOrder(WORKS, { windowEnd: hour(-4) })).toThrow(
      /ends at or before/,
    );
  });
});

describe("ContractorSiteAccessService — reporting every reason", () => {
  let service: ContractorSiteAccessService;

  beforeEach(() => {
    service = build();
  });

  test("collects every refusal rather than stopping at the first", () => {
    service.amendWorksOrder(WORKS, {
      activityCodes: [ACT_MARQUEE, ACT_HEIGHT],
      personnelIds: [FITTER, APPRENTICE],
    });

    const decision = service.evaluate(WORKS);
    const found = new Set(kinds(decision));

    expect(found).toContain("INSUFFICIENT_INDEMNITY");
    expect(found).toContain("RAMS_SCOPE_GAP");
    expect(found).toContain("COMPETENCY_MISSING");
    expect(decision.refusals.length).toBeGreaterThanOrEqual(4);
  });

  test("a granted decision carries no refusals", () => {
    const decision = service.evaluate(WORKS);

    expect(decision.granted).toBe(true);
    expect(decision.refusals).toHaveLength(0);
  });

  test("throws rather than granting when the works order does not exist", () => {
    expect(() => service.evaluate("works-imaginary")).toThrow(/does not exist/);
  });
});

describe("ContractorSiteAccessService — registration guards", () => {
  let service: ContractorSiteAccessService;

  beforeEach(() => {
    service = build();
  });

  test("rejects a person attached to a company that does not exist", () => {
    expect(() =>
      service.registerPerson({ personId: "per-x", companyId: "co-ghost", name: "X" }),
    ).toThrow(/unknown company/);
  });

  test("rejects a document attached to a company that does not exist", () => {
    expect(() =>
      service.registerDocument({
        documentId: "doc-x",
        companyId: "co-ghost",
        kind: "RAMS",
        reference: "X",
        validFrom: day(-1),
        validUntil: day(1),
      }),
    ).toThrow(/unknown company/);
  });

  test("rejects a document that expires at or before it starts", () => {
    expect(() =>
      service.registerDocument({
        documentId: "doc-x",
        companyId: MARQUEE_CO,
        kind: "RAMS",
        reference: "X",
        validFrom: day(1),
        validUntil: day(1),
      }),
    ).toThrow(/expires at or before/);
  });

  test("rejects a competency for a person who does not exist", () => {
    expect(() =>
      service.registerCompetency({
        competencyId: "comp-x",
        personId: "per-ghost",
        activityCode: "ipaf",
        certificateReference: "X",
        validFrom: day(-1),
        validUntil: day(1),
      }),
    ).toThrow(/unknown person/);
  });

  test("rejects a competency that expires at or before it starts", () => {
    expect(() =>
      service.registerCompetency({
        competencyId: "comp-x",
        personId: FITTER,
        activityCode: "ipaf",
        certificateReference: "X",
        validFrom: day(1),
        validUntil: day(1),
      }),
    ).toThrow(/expires at or before/);
  });

  test("rejects an activity with a negative indemnity requirement", () => {
    expect(() =>
      service.registerActivity({
        activityCode: "act-x",
        label: "X",
        requiredIndemnityPence: -1,
        requiresRams: false,
        requiredCompetencies: [],
      }),
    ).toThrow(/negative indemnity/);
  });

  test("rejects a works order for a company that does not exist", () => {
    expect(() =>
      service.submitWorksOrder({
        worksId: "works-x",
        companyId: "co-ghost",
        zoneId: ZONE_LAWN,
        description: "X",
        activityCodes: [ACT_TIDY],
        personnelIds: [FITTER],
        windowStart: BUILD_START,
        windowEnd: BUILD_END,
      }),
    ).toThrow(/unknown company/);
  });

  test("rejects a works order that ends at or before it starts", () => {
    expect(() =>
      service.submitWorksOrder({
        worksId: "works-x",
        companyId: MARQUEE_CO,
        zoneId: ZONE_LAWN,
        description: "X",
        activityCodes: [ACT_TIDY],
        personnelIds: [FITTER],
        windowStart: BUILD_END,
        windowEnd: BUILD_END,
      }),
    ).toThrow(/ends at or before/);
  });

  test("getters return null for records that were never created", () => {
    expect(service.getWorksOrder("works-imaginary")).toBeNull();
    expect(service.getPermit("permit-imaginary")).toBeNull();
  });

  test("getWorksOrder hands back a copy rather than the live order", () => {
    const snapshot = service.getWorksOrder(WORKS);
    snapshot?.personnelIds.push(APPRENTICE);

    expect(service.getWorksOrder(WORKS)?.personnelIds).toEqual([FITTER]);
  });

  test("amending a works order that does not exist reports no change", () => {
    expect(service.amendWorksOrder("works-imaginary", { zoneId: ZONE_BAY }).amended).toBe(false);
  });
});
