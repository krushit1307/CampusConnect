/**
 * Test suite: Freedom of Information Request Handling (#5260)
 * File: tests/services/freedomOfInformationService.test.ts
 *
 * The cases worth writing down are the ones a calendar-day clock and a
 * per-request cost check both get wrong: the deadline that moves because the
 * institution shut for a week, the clarification that stops the clock without
 * returning the days already spent, the answer that never comes and lapses the
 * request instead of breaching it, the campaign submitting under two names that
 * only fails the cost limit once aggregated, and the qualified exemption
 * claimed with no balance recorded, which discloses.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  FreedomOfInformationService,
  type PublicInterestBalance,
} from "../../src/services/freedomOfInformationService";

const RECEIVED = new Date("2029-01-08T00:00:00.000Z");

function balance(overrides: Partial<PublicInterestBalance> = {}): PublicInterestBalance {
  return {
    inDisclosure: "Accountability for how the block grant was allocated",
    inMaintainingExemption: "Live negotiation would be prejudiced",
    favoursWithholding: true,
    decidedBy: "u-officer",
    decidedOn: new Date("2029-01-20T00:00:00.000Z"),
    ...overrides,
  };
}

function build(): FreedomOfInformationService {
  const service = new FreedomOfInformationService();

  service.registerRequester({ requesterId: "r-1", name: "Ada", actingInConcertWith: [] });
  service.registerRequester({ requesterId: "r-2", name: "Grace", actingInConcertWith: ["r-3"] });
  service.registerRequester({ requesterId: "r-3", name: "Alan", actingInConcertWith: [] });

  service.registerRequest({
    requestId: "req-plain",
    requesterId: "r-1",
    subjectKey: "governance",
    receivedOn: RECEIVED,
  });
  service.registerRequest({
    requestId: "req-campaign-a",
    requesterId: "r-2",
    subjectKey: "estates",
    receivedOn: RECEIVED,
  });
  service.registerRequest({
    requestId: "req-campaign-b",
    requesterId: "r-3",
    subjectKey: "estates",
    receivedOn: new Date("2029-01-22T00:00:00.000Z"),
  });
  service.registerRequest({
    requestId: "req-other-subject",
    requesterId: "r-2",
    subjectKey: "catering",
    receivedOn: new Date("2029-01-15T00:00:00.000Z"),
  });
  service.registerRequest({
    requestId: "req-far",
    requesterId: "r-2",
    subjectKey: "estates",
    receivedOn: new Date("2029-08-01T00:00:00.000Z"),
  });

  service.registerRecordSet({
    recordSetId: "rs-p1",
    requestId: "req-plain",
    custodian: "Governance office",
    description: "Board minutes",
    estimatedHours: 8,
  });
  service.registerRecordSet({
    recordSetId: "rs-a1",
    requestId: "req-campaign-a",
    custodian: "Estates",
    description: "Maintenance log",
    estimatedHours: 4,
  });
  service.registerRecordSet({
    recordSetId: "rs-a2",
    requestId: "req-campaign-a",
    custodian: "Estates",
    description: "Contractor correspondence",
    estimatedHours: 6,
  });
  service.registerRecordSet({
    recordSetId: "rs-b1",
    requestId: "req-campaign-b",
    custodian: "Estates",
    description: "Tender file",
    estimatedHours: 10,
  });
  service.registerRecordSet({
    recordSetId: "rs-o1",
    requestId: "req-other-subject",
    custodian: "Catering",
    description: "Supplier invoices",
    estimatedHours: 10,
  });
  service.registerRecordSet({
    recordSetId: "rs-f1",
    requestId: "req-far",
    custodian: "Estates",
    description: "Later tender file",
    estimatedHours: 4,
  });

  service.registerExemption({
    code: "PERSONAL_DATA_OF_OTHERS",
    description: "Personal data of a third party",
    exemptionClass: "ABSOLUTE",
  });
  service.registerExemption({
    code: "COMMERCIAL_INTERESTS",
    description: "Would prejudice commercial interests",
    exemptionClass: "QUALIFIED",
  });

  return service;
}

describe("the clock runs in working days", () => {
  let service: FreedomOfInformationService;

  beforeEach(() => {
    service = build();
  });

  test("twenty working days from a Monday in January lands five weeks later", () => {
    expect(service.deadline("req-plain")?.toISOString()).toBe("2029-02-05T00:00:00.000Z");
  });

  test("weekends are not working days", () => {
    expect(service.isWorkingDay(new Date("2029-01-13T00:00:00.000Z"))).toBe(false);
    expect(service.isWorkingDay(new Date("2029-01-14T00:00:00.000Z"))).toBe(false);
    expect(service.isWorkingDay(new Date("2029-01-15T00:00:00.000Z"))).toBe(true);
  });

  test("a closure week pushes the deadline by a working week", () => {
    for (const day of ["2029-01-15", "2029-01-16", "2029-01-17", "2029-01-18", "2029-01-19"]) {
      service.registerClosureDay(new Date(`${day}T00:00:00.000Z`));
    }

    expect(service.isWorkingDay(new Date("2029-01-16T00:00:00.000Z"))).toBe(false);
    expect(service.deadline("req-plain")?.toISOString()).toBe("2029-02-12T00:00:00.000Z");
  });

  test("a December request is not twenty calendar days later", () => {
    const december = build();
    december.registerRequest({
      requestId: "req-december",
      requesterId: "r-1",
      subjectKey: "governance-december",
      receivedOn: new Date("2028-12-20T00:00:00.000Z"),
    });
    for (const day of [
      "2028-12-25",
      "2028-12-26",
      "2028-12-27",
      "2028-12-28",
      "2028-12-29",
      "2029-01-01",
    ]) {
      december.registerClosureDay(new Date(`${day}T00:00:00.000Z`));
    }

    const deadline = december.deadline("req-december") as Date;
    // Twenty calendar days would be 9 January. Two working days before
    // Christmas, then the closure, then four working weeks: 25 January.
    expect(deadline.toISOString()).toBe("2029-01-25T00:00:00.000Z");
  });

  test("working days between two dates exclude the first and include the last", () => {
    expect(service.workingDaysBetween(RECEIVED, new Date("2029-01-12T00:00:00.000Z"))).toBe(4);
  });
});

describe("clarification stops the clock without returning the days spent", () => {
  let service: FreedomOfInformationService;

  beforeEach(() => {
    service = build();
    service.seekClarification("req-plain", new Date("2029-01-29T00:00:00.000Z"));
  });

  test("the days already elapsed stay elapsed", () => {
    expect(service.workingDaysConsumed("req-plain", new Date("2029-01-29T00:00:00.000Z"))).toBe(14);
  });

  test("while the clock is stopped there is no deadline yet", () => {
    expect(service.deadline("req-plain")).toBeNull();
    expect(service.state("req-plain", new Date("2029-02-01T00:00:00.000Z"))).toBe(
      "AWAITING_CLARIFICATION",
    );
  });

  test("the answer restarts the clock with the remaining six days", () => {
    service.receiveClarification("req-plain", new Date("2029-02-19T00:00:00.000Z"));

    expect(service.deadline("req-plain")?.toISOString()).toBe("2029-02-26T00:00:00.000Z");
  });

  test("the day the answer arrives counts, and the three weeks between do not", () => {
    service.receiveClarification("req-plain", new Date("2029-02-19T00:00:00.000Z"));

    // Fourteen spent before the question, then the day the answer arrives. The
    // fifteen working days in between are not charged to the institution.
    expect(service.workingDaysConsumed("req-plain", new Date("2029-02-19T00:00:00.000Z"))).toBe(15);
    expect(service.workingDaysConsumed("req-plain", new Date("2029-02-16T00:00:00.000Z"))).toBe(14);
  });

  test("an answer that never comes lapses the request rather than breaching it", () => {
    expect(service.state("req-plain", new Date("2029-03-01T00:00:00.000Z"))).toBe(
      "AWAITING_CLARIFICATION",
    );
    expect(service.state("req-plain", new Date("2029-06-01T00:00:00.000Z"))).toBe("LAPSED");
  });

  test("a second clarification cannot be sought while one is open", () => {
    expect(() =>
      service.seekClarification("req-plain", new Date("2029-02-01T00:00:00.000Z")),
    ).toThrow(/already awaiting clarification/);
  });

  test("an answer to a question nobody asked is refused", () => {
    service.receiveClarification("req-plain", new Date("2029-02-19T00:00:00.000Z"));
    expect(() =>
      service.receiveClarification("req-plain", new Date("2029-02-20T00:00:00.000Z")),
    ).toThrow(/not awaiting clarification/);
  });

  test("an answer dated before the question is refused", () => {
    expect(() =>
      service.receiveClarification("req-plain", new Date("2029-01-20T00:00:00.000Z")),
    ).toThrow(/before it was sought/);
  });
});

describe("the cost limit is tested after aggregation", () => {
  let service: FreedomOfInformationService;

  beforeEach(() => {
    service = build();
  });

  test("a single request under the limit is under the limit", () => {
    const estimate = service.costEstimate("req-plain");
    expect(estimate.aggregatedRequestIds).toEqual(["req-plain"]);
    expect(estimate.totalCostPounds).toBe(200);
    expect(estimate.overLimit).toBe(false);
  });

  test("requests from people acting in concert count together", () => {
    const estimate = service.costEstimate("req-campaign-a");
    expect(estimate.aggregatedRequestIds).toEqual(["req-campaign-a", "req-campaign-b"]);
    expect(estimate.totalHours).toBe(20);
    expect(estimate.totalCostPounds).toBe(500);
    expect(estimate.overLimit).toBe(true);
  });

  test("the concert relation holds in both directions", () => {
    expect(service.costEstimate("req-campaign-b").aggregatedRequestIds).toEqual([
      "req-campaign-a",
      "req-campaign-b",
    ]);
  });

  test("each request alone would have passed, which is the point", () => {
    // Ten hours is £250, comfortably inside the limit. Only the aggregate fails.
    expect(service.costEstimate("req-other-subject").overLimit).toBe(false);
  });

  test("a different subject is not aggregated", () => {
    expect(service.costEstimate("req-other-subject").aggregatedRequestIds).toEqual([
      "req-other-subject",
    ]);
  });

  test("a request outside the rolling window is not aggregated", () => {
    expect(service.costEstimate("req-far").aggregatedRequestIds).toEqual(["req-far"]);
    expect(service.costEstimate("req-far").overLimit).toBe(false);
  });

  test("an over-limit request reads as refused on cost rather than merely open", () => {
    expect(service.state("req-campaign-a", new Date("2029-01-20T00:00:00.000Z"))).toBe(
      "REFUSED_ON_COST",
    );
  });

  test("the narrowest scope that would come in under the limit is offered", () => {
    const scope = service.narrowestScopeUnderLimit("req-campaign-a");
    expect(scope.map((set) => set.recordSetId)).toEqual(["rs-a1", "rs-a2"]);
    expect(scope.reduce((sum, set) => sum + set.estimatedHours, 0)).toBe(10);
  });

  test("the estimate says what it counted, in the reason", () => {
    expect(service.costEstimate("req-campaign-a").reason).toContain("2 aggregated request(s)");
  });
});

describe("exemptions are of two kinds and only one refuses on its own", () => {
  let service: FreedomOfInformationService;

  beforeEach(() => {
    service = build();
    for (const itemId of ["item-1", "item-2", "item-3", "item-4", "item-5", "item-6"]) {
      service.registerItem({ itemId, requestId: "req-plain", description: `Document ${itemId}` });
    }
  });

  test("an absolute exemption withholds without a balance", () => {
    const result = service.classifyItem({
      itemId: "item-1",
      outcome: "WITHHELD",
      exemptionCode: "PERSONAL_DATA_OF_OTHERS",
      balance: null,
    });

    expect(result.outcome).toBe("WITHHELD");
    expect(result.problem).toBeNull();
  });

  test("a qualified exemption with no recorded balance discloses", () => {
    const result = service.classifyItem({
      itemId: "item-2",
      outcome: "WITHHELD",
      exemptionCode: "COMMERCIAL_INTERESTS",
      balance: null,
    });

    expect(result.outcome).toBe("DISCLOSED");
    expect(result.problem).toMatch(/no public interest balance was recorded/);
  });

  test("a qualified exemption with the balance struck for withholding stands", () => {
    const result = service.classifyItem({
      itemId: "item-3",
      outcome: "WITHHELD",
      exemptionCode: "COMMERCIAL_INTERESTS",
      balance: balance(),
    });

    expect(result.outcome).toBe("WITHHELD");
    expect(result.problem).toBeNull();
  });

  test("a balance struck for disclosure discloses, exemption or no exemption", () => {
    const result = service.classifyItem({
      itemId: "item-4",
      outcome: "WITHHELD",
      exemptionCode: "COMMERCIAL_INTERESTS",
      balance: balance({ favoursWithholding: false }),
    });

    expect(result.outcome).toBe("DISCLOSED");
    expect(result.problem).toMatch(/struck in favour of disclosure/);
  });

  test("withholding without naming an exemption discloses", () => {
    const result = service.classifyItem({
      itemId: "item-5",
      outcome: "WITHHELD",
      exemptionCode: null,
      balance: null,
    });

    expect(result.outcome).toBe("DISCLOSED");
    expect(result.problem).toMatch(/without naming an exemption/);
  });

  test("an exemption the register does not know discloses", () => {
    const result = service.classifyItem({
      itemId: "item-6",
      outcome: "WITHHELD",
      exemptionCode: "MADE_UP_EXEMPTION",
      balance: null,
    });

    expect(result.outcome).toBe("DISCLOSED");
    expect(result.problem).toMatch(/not one this register knows/);
  });

  test("classifying something that was never located is an error", () => {
    expect(() =>
      service.classifyItem({
        itemId: "item-ghost",
        outcome: "DISCLOSED",
        exemptionCode: null,
        balance: null,
      }),
    ).toThrow(/Unknown item/);
  });
});

describe("the response is per item, because the answer is usually partial", () => {
  let service: FreedomOfInformationService;

  beforeEach(() => {
    service = build();
    for (const itemId of ["item-1", "item-2", "item-3", "item-4"]) {
      service.registerItem({ itemId, requestId: "req-plain", description: `Document ${itemId}` });
    }

    service.classifyItem({
      itemId: "item-1",
      outcome: "DISCLOSED",
      exemptionCode: null,
      balance: null,
    });
    service.classifyItem({
      itemId: "item-2",
      outcome: "WITHHELD",
      exemptionCode: "PERSONAL_DATA_OF_OTHERS",
      balance: null,
    });
    service.classifyItem({
      itemId: "item-3",
      outcome: "WITHHELD",
      exemptionCode: "COMMERCIAL_INTERESTS",
      balance: null,
    });
    // item-4 is deliberately left unclassified.
  });

  test("the summary separates what went out from what did not", () => {
    const summary = service.responseSummary("req-plain");

    expect(summary.withheld.map((line) => line.itemId)).toEqual(["item-2"]);
    expect(summary.disclosed.map((line) => line.itemId)).toEqual(["item-1", "item-3", "item-4"]);
  });

  test("classifications that do not stand up are reported as unsound", () => {
    const summary = service.responseSummary("req-plain");

    expect(summary.unsound.map((line) => line.itemId)).toEqual(["item-3", "item-4"]);
  });

  test("an item located but never classified discloses rather than vanishing", () => {
    const summary = service.responseSummary("req-plain");
    const item4 = summary.disclosed.find((line) => line.itemId === "item-4");

    expect(item4?.problem).toMatch(/never classified/);
  });

  test("each withheld item names the exemption it was withheld under", () => {
    const summary = service.responseSummary("req-plain");
    expect(summary.withheld[0].exemptionCode).toBe("PERSONAL_DATA_OF_OTHERS");
  });
});

describe("a public interest extension is reported as an extension", () => {
  let service: FreedomOfInformationService;

  beforeEach(() => {
    service = build();
  });

  test("the original deadline comes back alongside the new one", () => {
    const extension = service.extendForPublicInterest(
      "req-plain",
      10,
      "The commercial interests balance needs the contractor's view",
    );

    expect(extension.originalDeadline.toISOString()).toBe("2029-02-05T00:00:00.000Z");
    expect(extension.extendedDeadline.toISOString()).toBe("2029-02-19T00:00:00.000Z");
    expect(service.deadline("req-plain")?.toISOString()).toBe("2029-02-19T00:00:00.000Z");
  });

  test("an extension of nothing, or of more than the statute allows, is refused", () => {
    expect(() => service.extendForPublicInterest("req-plain", 0, "none")).toThrow(
      /between 1 and 20/,
    );
    expect(() => service.extendForPublicInterest("req-plain", 21, "too long")).toThrow(
      /between 1 and 20/,
    );
  });

  test("there is nothing to extend while the clock is stopped", () => {
    service.seekClarification("req-plain", new Date("2029-01-29T00:00:00.000Z"));
    expect(() => service.extendForPublicInterest("req-plain", 5, "needs longer")).toThrow(
      /no running deadline/,
    );
  });
});

describe("states and the internal review", () => {
  let service: FreedomOfInformationService;

  beforeEach(() => {
    service = build();
  });

  test("a request inside its deadline is simply open", () => {
    expect(service.state("req-plain", new Date("2029-01-20T00:00:00.000Z"))).toBe("OPEN");
  });

  test("a request past its deadline is overdue", () => {
    expect(service.state("req-plain", new Date("2029-02-06T00:00:00.000Z"))).toBe("OVERDUE");
  });

  test("the deadline day itself is not yet overdue", () => {
    expect(service.state("req-plain", new Date("2029-02-05T00:00:00.000Z"))).toBe("OPEN");
  });

  test("a response closes the request", () => {
    service.markResponded("req-plain", new Date("2029-02-01T00:00:00.000Z"));
    expect(service.state("req-plain", new Date("2029-03-01T00:00:00.000Z"))).toBe("RESPONDED");
  });

  test("the internal review runs its own clock from the day it is asked for", () => {
    service.markResponded("req-plain", new Date("2029-02-01T00:00:00.000Z"));
    const reviewDeadline = service.openInternalReview(
      "req-plain",
      new Date("2029-02-05T00:00:00.000Z"),
    );

    expect(reviewDeadline.toISOString()).toBe("2029-03-05T00:00:00.000Z");
    expect(service.internalReviewDeadline("req-plain")?.toISOString()).toBe(
      "2029-03-05T00:00:00.000Z",
    );
  });

  test("the review clock is independent of the original, however late that was", () => {
    service.markResponded("req-plain", new Date("2029-05-01T00:00:00.000Z"));
    const reviewDeadline = service.openInternalReview(
      "req-plain",
      new Date("2029-05-07T00:00:00.000Z"),
    );

    expect(reviewDeadline.getTime()).toBeGreaterThan(
      (service.deadline("req-plain") as Date).getTime(),
    );
  });

  test("there is nothing to review before a response has gone out", () => {
    expect(() =>
      service.openInternalReview("req-plain", new Date("2029-02-05T00:00:00.000Z")),
    ).toThrow(/nothing to review/);
  });

  test("no review means no review deadline", () => {
    expect(service.internalReviewDeadline("req-plain")).toBeNull();
  });
});

describe("inputs that cannot be interpreted", () => {
  let service: FreedomOfInformationService;

  beforeEach(() => {
    service = build();
  });

  test("a request from a requester nobody registered is refused", () => {
    expect(() =>
      service.registerRequest({
        requestId: "req-ghost",
        requesterId: "r-nobody",
        subjectKey: "governance",
        receivedOn: RECEIVED,
      }),
    ).toThrow(/Unknown requester/);
  });

  test("a record set cannot take negative hours", () => {
    expect(() =>
      service.registerRecordSet({
        recordSetId: "rs-bad",
        requestId: "req-plain",
        custodian: "Estates",
        description: "Impossible",
        estimatedHours: -1,
      }),
    ).toThrow(/negative hours/);
  });

  test("acting on a request that does not exist is an error", () => {
    expect(() => service.deadline("req-nope")).toThrow(/Unknown request/);
  });
});
