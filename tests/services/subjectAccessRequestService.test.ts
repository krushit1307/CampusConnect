/**
 * Test suite: Subject Access Request Clock (#5162)
 * File: tests/services/subjectAccessRequestService.test.ts
 *
 * The cases worth writing down are the ones a shared inbox and a calendar
 * reminder both miss: the request recognised eleven days late whose deadline
 * did not move, the suspension nobody resumed when the passport photograph
 * arrived, the extension claimed after the month it was meant to extend, the
 * custodian who never replied, and the welfare note that names one other
 * student and is otherwise entirely the subject's own record.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  SubjectAccessRequestService,
  addMonths,
  type LocatedItem,
  type SubjectAccessRequest,
} from "../../src/services/subjectAccessRequestService";

const RECEIVED = new Date("2029-01-15T09:00:00.000Z");

function request(overrides: Partial<SubjectAccessRequest> = {}): SubjectAccessRequest {
  return {
    requestId: "sar-01",
    subjectId: "usr-student",
    receivedOn: RECEIVED,
    recognisedOn: new Date("2029-01-26T11:00:00.000Z"),
    channel: "EMAIL",
    ...overrides,
  };
}

function item(overrides: Partial<LocatedItem> & Pick<LocatedItem, "itemId">): LocatedItem {
  return {
    requestId: "sar-01",
    custodian: "Membership",
    description: "Membership record",
    namesThirdParties: false,
    thirdPartyConsentObtained: false,
    thirdPartySeverable: false,
    exemptions: [],
    ...overrides,
  };
}

function build(overrides: Partial<SubjectAccessRequest> = {}): SubjectAccessRequestService {
  const service = new SubjectAccessRequestService();
  service.registerRequest(request(overrides));
  return service;
}

describe("the clock starts on receipt", () => {
  let service: SubjectAccessRequestService;

  beforeEach(() => {
    service = build();
  });

  test("recognising a request eleven days late does not move the deadline", () => {
    expect(service.statutoryDeadline("sar-01")).toEqual(new Date("2029-02-15T09:00:00.000Z"));
  });

  test("a month from the end of a long month lands at the end of a short one", () => {
    expect(addMonths(new Date("2029-01-31T09:00:00.000Z"), 1)).toEqual(
      new Date("2029-02-28T09:00:00.000Z"),
    );
    expect(addMonths(new Date("2029-03-31T09:00:00.000Z"), 1)).toEqual(
      new Date("2029-04-30T09:00:00.000Z"),
    );
  });

  test("days remaining count down against the effective deadline", () => {
    const assessment = service.assess("sar-01", new Date("2029-02-05T09:00:00.000Z"));

    expect(assessment.effectiveDeadline).toEqual(new Date("2029-02-15T09:00:00.000Z"));
    expect(assessment.daysRemaining).toBe(10);
    expect(assessment.breached).toBe(false);
  });

  test("a request still outstanding after the deadline is in breach before anybody responds", () => {
    const assessment = service.assess("sar-01", new Date("2029-02-20T09:00:00.000Z"));

    expect(assessment.breached).toBe(true);
    expect(assessment.breachReason).toContain("Outstanding");
  });
});

describe("suspension for identity, and only for identity", () => {
  let service: SubjectAccessRequestService;

  beforeEach(() => {
    service = build();
  });

  test("an open identity check leaves no deadline rather than a stale one", () => {
    service.requestIdentityVerification({
      checkId: "idc-01",
      requestId: "sar-01",
      requestedOn: new Date("2029-01-18T09:00:00.000Z"),
      respondedOn: null,
    });

    const assessment = service.assess("sar-01", new Date("2029-03-01T09:00:00.000Z"));
    expect(assessment.suspended).toBe(true);
    expect(assessment.effectiveDeadline).toBeNull();
    expect(assessment.daysRemaining).toBeNull();
    expect(assessment.state).toBe("IDENTITY_PENDING");
    expect(assessment.breached).toBe(false);
  });

  test("answering the identity check resumes the clock and pushes the deadline by exactly the pause", () => {
    service.requestIdentityVerification({
      checkId: "idc-01",
      requestId: "sar-01",
      requestedOn: new Date("2029-01-18T09:00:00.000Z"),
      respondedOn: null,
    });
    service.recordIdentityResponse("idc-01", new Date("2029-01-28T09:00:00.000Z"));

    const assessment = service.assess("sar-01", new Date("2029-02-01T09:00:00.000Z"));
    expect(assessment.suspended).toBe(false);
    expect(assessment.suspensionDays).toBe(10);
    expect(assessment.effectiveDeadline).toEqual(new Date("2029-02-25T09:00:00.000Z"));
  });

  test("identity verification cannot be backdated to before the request arrived", () => {
    expect(() =>
      service.requestIdentityVerification({
        checkId: "idc-bad",
        requestId: "sar-01",
        requestedOn: new Date("2029-01-01T09:00:00.000Z"),
        respondedOn: null,
      }),
    ).toThrow(/before the request arrived/);
  });
});

describe("extensions are conditional and have to be claimed in time", () => {
  let service: SubjectAccessRequestService;

  beforeEach(() => {
    service = build();
  });

  test("a claim inside the original period on a recorded ground extends it by two months", () => {
    const outcome = service.claimExtension({
      claimId: "ext-01",
      requestId: "sar-01",
      claimedOn: new Date("2029-02-10T09:00:00.000Z"),
      ground: "COMPLEXITY",
      reason: "Records span four custodians and two archived systems",
    });

    expect(outcome.granted).toBe(true);
    const assessment = service.assess("sar-01", new Date("2029-02-20T09:00:00.000Z"));
    expect(assessment.extensionGranted).toBe(true);
    expect(assessment.effectiveDeadline).toEqual(new Date("2029-04-15T09:00:00.000Z"));
    expect(assessment.breached).toBe(false);
  });

  test("a claim made after the period it would extend is refused, not granted quietly", () => {
    const outcome = service.claimExtension({
      claimId: "ext-02",
      requestId: "sar-01",
      claimedOn: new Date("2029-02-20T09:00:00.000Z"),
      ground: "COMPLEXITY",
      reason: "The search is taking a while",
    });

    expect(outcome.granted).toBe(false);
    const assessment = service.assess("sar-01", new Date("2029-02-21T09:00:00.000Z"));
    expect(assessment.extensionGranted).toBe(false);
    expect(assessment.extensionRefusedReason).toContain("after the period it would extend");
    expect(assessment.breached).toBe(true);
  });

  test("a claim without a recorded ground is not an extension", () => {
    const outcome = service.claimExtension({
      claimId: "ext-03",
      requestId: "sar-01",
      claimedOn: new Date("2029-02-01T09:00:00.000Z"),
      ground: "VOLUME_OF_REQUESTS",
      reason: "   ",
    });

    expect(outcome.granted).toBe(false);
    expect(outcome.reason).toContain("No ground");
  });

  test("a suspension moves the window a claim has to be made inside", () => {
    service.requestIdentityVerification({
      checkId: "idc-01",
      requestId: "sar-01",
      requestedOn: new Date("2029-01-18T09:00:00.000Z"),
      respondedOn: null,
    });
    service.recordIdentityResponse("idc-01", new Date("2029-01-28T09:00:00.000Z"));

    const outcome = service.claimExtension({
      claimId: "ext-04",
      requestId: "sar-01",
      claimedOn: new Date("2029-02-20T09:00:00.000Z"),
      ground: "COMPLEXITY",
      reason: "Archived systems",
    });

    expect(outcome.granted).toBe(true);
  });
});

describe("the search across custodians", () => {
  let service: SubjectAccessRequestService;

  beforeEach(() => {
    service = build();
    for (const custodian of ["Membership", "Welfare", "Bar", "Elections"]) {
      service.openSearchTask({
        taskId: `tsk-${custodian}`,
        requestId: "sar-01",
        custodian,
        state: "OPEN",
        completedOn: null,
      });
    }
  });

  test("a custodian that has not replied keeps the search incomplete", () => {
    service.recordSearchOutcome(
      "tsk-Membership",
      "ITEMS_RETURNED",
      new Date("2029-01-20T09:00:00.000Z"),
    );
    service.recordSearchOutcome(
      "tsk-Welfare",
      "ITEMS_RETURNED",
      new Date("2029-01-21T09:00:00.000Z"),
    );
    service.recordSearchOutcome("tsk-Bar", "NIL_RETURN", new Date("2029-01-22T09:00:00.000Z"));

    const assessment = service.assess("sar-01", new Date("2029-02-01T09:00:00.000Z"));
    expect(assessment.searchComplete).toBe(false);
    expect(assessment.outstandingCustodians).toEqual(["Elections"]);
    expect(assessment.state).toBe("SEARCHING");
  });

  test("a nil return is an answer and completes the search", () => {
    for (const custodian of ["Membership", "Welfare", "Bar", "Elections"]) {
      service.recordSearchOutcome(
        `tsk-${custodian}`,
        "NIL_RETURN",
        new Date("2029-01-22T09:00:00.000Z"),
      );
    }

    const assessment = service.assess("sar-01", new Date("2029-02-01T09:00:00.000Z"));
    expect(assessment.searchComplete).toBe(true);
    expect(assessment.state).toBe("READY_TO_RESPOND");
  });

  test("an incomplete search leaves the pack incomplete however many items are decided", () => {
    service.recordSearchOutcome(
      "tsk-Membership",
      "ITEMS_RETURNED",
      new Date("2029-01-20T09:00:00.000Z"),
    );
    service.addLocatedItem(item({ itemId: "itm-01" }));
    service.decideOutstandingItems("sar-01");

    expect(service.disclosurePack("sar-01").complete).toBe(false);
  });
});

describe("exemptions applied per item", () => {
  let service: SubjectAccessRequestService;

  beforeEach(() => {
    service = build();
    service.openSearchTask({
      taskId: "tsk-all",
      requestId: "sar-01",
      custodian: "Membership",
      state: "OPEN",
      completedOn: null,
    });
    service.recordSearchOutcome("tsk-all", "ITEMS_RETURNED", new Date("2029-01-20T09:00:00.000Z"));
  });

  test("a note naming another student is redacted, not withheld", () => {
    service.addLocatedItem(
      item({
        itemId: "itm-welfare",
        custodian: "Welfare",
        namesThirdParties: true,
        thirdPartySeverable: true,
      }),
    );

    const decision = service.decideOutstandingItems("sar-01")[0];
    expect(decision.outcome).toBe("REDACT_THIRD_PARTY");
    expect(decision.exemptionApplied).toBe("THIRD_PARTY_DATA");
  });

  test("third-party data that cannot be severed is withheld", () => {
    service.addLocatedItem(
      item({
        itemId: "itm-complaint",
        namesThirdParties: true,
        thirdPartySeverable: false,
      }),
    );

    expect(service.decideOutstandingItems("sar-01")[0].outcome).toBe("WITHHOLD");
  });

  test("consent from the third party turns the same record into a disclosure", () => {
    service.addLocatedItem(
      item({
        itemId: "itm-consented",
        namesThirdParties: true,
        thirdPartySeverable: false,
        thirdPartyConsentObtained: true,
      }),
    );

    const decision = service.decideOutstandingItems("sar-01")[0];
    expect(decision.outcome).toBe("DISCLOSE");
    expect(decision.reason).toContain("consented");
  });

  test("an absolute exemption takes out the item it covers and nothing else", () => {
    service.addLocatedItem(item({ itemId: "itm-legal", exemptions: ["LEGAL_PRIVILEGE"] }));
    service.addLocatedItem(item({ itemId: "itm-ordinary" }));
    service.addLocatedItem(
      item({ itemId: "itm-reference", exemptions: ["CONFIDENTIAL_REFERENCE"] }),
    );

    service.decideOutstandingItems("sar-01");
    const pack = service.disclosurePack("sar-01");

    expect(pack.withheld.map((decision) => decision.itemId)).toEqual([
      "itm-legal",
      "itm-reference",
    ]);
    expect(pack.disclosed.map((decision) => decision.itemId)).toEqual(["itm-ordinary"]);
    expect(pack.complete).toBe(true);
  });

  test("an undecided item is reported rather than assumed disclosable", () => {
    service.addLocatedItem(item({ itemId: "itm-01" }));
    service.addLocatedItem(item({ itemId: "itm-02" }));
    service.recordItemDecision({
      itemId: "itm-01",
      outcome: "DISCLOSE",
      exemptionApplied: null,
      reason: "Reviewed by the data protection officer",
    });

    const assessment = service.assess("sar-01", new Date("2029-02-01T09:00:00.000Z"));
    expect(assessment.undecidedItemIds).toEqual(["itm-02"]);
    expect(service.disclosurePack("sar-01").complete).toBe(false);
  });
});

describe("refusal under the same clock", () => {
  let service: SubjectAccessRequestService;

  beforeEach(() => {
    service = build();
  });

  test("a refusal inside the period is not a breach", () => {
    service.refuse({
      requestId: "sar-01",
      refusedOn: new Date("2029-02-05T09:00:00.000Z"),
      ground: "MANIFESTLY_UNFOUNDED",
      reason: "The eleventh identical request this term",
      complaintRightsGiven: true,
    });

    const assessment = service.assess("sar-01", new Date("2029-02-06T09:00:00.000Z"));
    expect(assessment.state).toBe("REFUSED");
    expect(assessment.breached).toBe(false);
  });

  test("a refusal after the deadline is a breach even though nothing was disclosed", () => {
    service.refuse({
      requestId: "sar-01",
      refusedOn: new Date("2029-03-01T09:00:00.000Z"),
      ground: "EXCESSIVE",
      reason: "Would require reviewing eleven years of CCTV",
      complaintRightsGiven: true,
    });

    const assessment = service.assess("sar-01", new Date("2029-03-02T09:00:00.000Z"));
    expect(assessment.breached).toBe(true);
    expect(assessment.breachReason).toContain("Refused on");
  });

  test("a refusal that does not give complaint rights is a breach whenever it was sent", () => {
    service.refuse({
      requestId: "sar-01",
      refusedOn: new Date("2029-02-05T09:00:00.000Z"),
      ground: "REPEAT_REQUEST",
      reason: "Already answered in November",
      complaintRightsGiven: false,
    });

    const assessment = service.assess("sar-01", new Date("2029-02-06T09:00:00.000Z"));
    expect(assessment.breached).toBe(true);
    expect(assessment.breachReason).toContain("complaint rights");
  });

  test("a response after the deadline is a breach recorded against the response, not the search", () => {
    service.respond("sar-01", new Date("2029-02-18T09:00:00.000Z"));

    const assessment = service.assess("sar-01", new Date("2029-02-19T09:00:00.000Z"));
    expect(assessment.state).toBe("RESPONDED");
    expect(assessment.breachReason).toContain("Responded on");
  });
});

describe("the caseload view", () => {
  test("breached requests come first, then the ones closest to their deadline", () => {
    const service = new SubjectAccessRequestService();
    service.registerRequest(
      request({ requestId: "sar-breached", receivedOn: new Date("2028-12-01T09:00:00.000Z") }),
    );
    service.registerRequest(
      request({ requestId: "sar-due-soon", receivedOn: new Date("2029-01-20T09:00:00.000Z") }),
    );
    service.registerRequest(
      request({ requestId: "sar-comfortable", receivedOn: new Date("2029-02-10T09:00:00.000Z") }),
    );
    service.registerRequest(
      request({ requestId: "sar-paused", receivedOn: new Date("2029-01-05T09:00:00.000Z") }),
    );
    service.requestIdentityVerification({
      checkId: "idc-paused",
      requestId: "sar-paused",
      requestedOn: new Date("2029-01-10T09:00:00.000Z"),
      respondedOn: null,
    });

    const caseload = service.overdueAndDue(new Date("2029-02-14T09:00:00.000Z"));

    expect(caseload.map((assessment) => assessment.requestId)).toEqual([
      "sar-breached",
      "sar-due-soon",
      "sar-paused",
    ]);
  });
});
