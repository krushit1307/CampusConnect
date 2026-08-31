/**
 * Test suite: Event Insurance Cover Adequacy (#5159)
 * File: tests/services/eventInsuranceCoverService.test.ts
 *
 * The cases worth writing down are the ones the annual renewal email and a
 * single "insured?" checkbox both miss: the one excluded activity inside an
 * otherwise covered event, the unlisted activity that could have been endorsed
 * on for forty pounds, the November claim that quietly makes a March event
 * uncoverable, the venue whose hire agreement demands more than the union
 * carries, and the marquee contractor whose certificate expired in January.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  EventInsuranceCoverService,
  type InsurableEvent,
  type EventActivity,
} from "../../src/services/eventInsuranceCoverService";

const POUND = 100;
const MILLION = 1_000_000 * POUND;

const COVER_FROM = new Date("2028-09-01T00:00:00.000Z");
const COVER_TO = new Date("2029-09-01T00:00:00.000Z");
const BALL_NIGHT = new Date("2029-03-14T19:00:00.000Z");

function build(): EventInsuranceCoverService {
  const service = new EventInsuranceCoverService();

  const classes: Array<[string, string, 1 | 2 | 3 | 4 | 5]> = [
    ["cls-bar", "Licensed bar", 1],
    ["cls-live-music", "Live music", 1],
    ["cls-marquee", "Temporary structure", 2],
    ["cls-inflatable", "Inflatable amusement", 3],
    ["cls-fireworks", "Pyrotechnics", 4],
    ["cls-abseil", "Abseiling", 5],
  ];
  for (const [classId, name, hazardBand] of classes) {
    service.registerActivityClass({ classId, name, hazardBand });
  }

  service.registerPolicy({
    policyId: "pol-2829",
    insurer: "Endsleigh",
    coverFrom: COVER_FROM,
    coverTo: COVER_TO,
    perClaimLimitPence: 5 * MILLION,
    aggregateLimitPence: 10 * MILLION,
    maxEndorsableBand: 3,
  });

  service.scheduleActivity({ policyId: "pol-2829", classId: "cls-bar", innerLimitPence: null });
  service.scheduleActivity({
    policyId: "pol-2829",
    classId: "cls-live-music",
    innerLimitPence: null,
  });
  service.scheduleActivity({
    policyId: "pol-2829",
    classId: "cls-marquee",
    innerLimitPence: 2 * MILLION,
  });

  service.excludeActivity({
    policyId: "pol-2829",
    classId: "cls-fireworks",
    wording: "No cover for the use, storage or display of pyrotechnics",
  });

  return service;
}

function activity(
  overrides: Partial<EventActivity> & Pick<EventActivity, "activityId" | "classId">,
): EventActivity {
  return { ...overrides };
}

function ball(
  activities: EventActivity[],
  overrides: Partial<InsurableEvent> = {},
): InsurableEvent {
  return {
    eventId: "evt-summer-ball",
    name: "Summer Ball",
    eventDate: BALL_NIGHT,
    venueId: "ven-great-hall",
    activities,
    ...overrides,
  };
}

function find(
  assessment: ReturnType<EventInsuranceCoverService["assessEvent"]>,
  activityId: string,
) {
  const determination = assessment.determinations.find((item) => item.activityId === activityId);
  if (!determination) throw new Error(`No determination for ${activityId}`);
  return determination;
}

describe("policy in force on the event date", () => {
  let service: EventInsuranceCoverService;

  beforeEach(() => {
    service = build();
  });

  test("an event inside the period of cover is assessed against that policy", () => {
    const assessment = service.assessEvent(
      ball([activity({ activityId: "act-bar", classId: "cls-bar" })]),
    );

    expect(assessment.policyId).toBe("pol-2829");
    expect(assessment.adequate).toBe(true);
    expect(find(assessment, "act-bar").status).toBe("COVERED");
  });

  test("an event two days after expiry is uninsured, not covered by the policy that has just ended", () => {
    const assessment = service.assessEvent(
      ball([activity({ activityId: "act-bar", classId: "cls-bar" })], {
        eventId: "evt-freshers",
        name: "Freshers Warm-Up",
        eventDate: new Date("2029-09-03T18:00:00.000Z"),
      }),
    );

    expect(assessment.policyId).toBeNull();
    expect(assessment.adequate).toBe(false);
    const bar = find(assessment, "act-bar");
    expect(bar.status).toBe("UNINSURED");
    expect(bar.remedy.kind).toBe("PLACE_STANDALONE_COVER");
  });

  test("cover runs from the first day and stops on the last, which is half-open at the top", () => {
    const onFirstDay = service.assessEvent(
      ball([activity({ activityId: "act-bar", classId: "cls-bar" })], { eventDate: COVER_FROM }),
    );
    const onRenewalDay = service.assessEvent(
      ball([activity({ activityId: "act-bar", classId: "cls-bar" })], { eventDate: COVER_TO }),
    );

    expect(onFirstDay.policyId).toBe("pol-2829");
    expect(onRenewalDay.policyId).toBeNull();
  });
});

describe("schedule, exclusions and endorsements", () => {
  let service: EventInsuranceCoverService;

  beforeEach(() => {
    service = build();
  });

  test("one excluded activity fails the event while the rest of it stays covered", () => {
    const assessment = service.assessEvent(
      ball([
        activity({ activityId: "act-bar", classId: "cls-bar" }),
        activity({ activityId: "act-band", classId: "cls-live-music" }),
        activity({ activityId: "act-fireworks", classId: "cls-fireworks" }),
      ]),
    );

    expect(assessment.adequate).toBe(false);
    expect(assessment.blockingActivityIds).toEqual(["act-fireworks"]);
    expect(find(assessment, "act-bar").status).toBe("COVERED");
    expect(find(assessment, "act-band").status).toBe("COVERED");
    const fireworks = find(assessment, "act-fireworks");
    expect(fireworks.status).toBe("EXCLUDED");
    expect(fireworks.reason).toContain("pyrotechnics");
  });

  test("an unlisted activity within the endorsable bands is a purchase decision, not a refusal", () => {
    const assessment = service.assessEvent(
      ball([activity({ activityId: "act-bouncy", classId: "cls-inflatable" })]),
    );

    const inflatable = find(assessment, "act-bouncy");
    expect(inflatable.status).toBe("ENDORSABLE");
    expect(inflatable.remedy.kind).toBe("PURCHASE_ENDORSEMENT");
  });

  test("an endorsement in force on the event date covers the activity it was bought for", () => {
    service.addEndorsement({
      endorsementId: "end-01",
      policyId: "pol-2829",
      classId: "cls-inflatable",
      effectiveFrom: new Date("2029-03-01T00:00:00.000Z"),
      effectiveTo: new Date("2029-04-01T00:00:00.000Z"),
      limitPence: 5 * MILLION,
      premiumPence: 40 * POUND,
    });

    const assessment = service.assessEvent(
      ball([activity({ activityId: "act-bouncy", classId: "cls-inflatable" })]),
    );

    expect(assessment.adequate).toBe(true);
    expect(find(assessment, "act-bouncy").status).toBe("COVERED_BY_ENDORSEMENT");
  });

  test("an endorsement that expires before the event does not cover it", () => {
    service.addEndorsement({
      endorsementId: "end-02",
      policyId: "pol-2829",
      classId: "cls-inflatable",
      effectiveFrom: new Date("2028-10-01T00:00:00.000Z"),
      effectiveTo: new Date("2028-11-01T00:00:00.000Z"),
      limitPence: 5 * MILLION,
      premiumPence: 40 * POUND,
    });

    expect(
      find(
        service.assessEvent(
          ball([activity({ activityId: "act-bouncy", classId: "cls-inflatable" })]),
        ),
        "act-bouncy",
      ).status,
    ).toBe("ENDORSABLE");
  });

  test("an endorsement responding below the required figure is a shortfall, not cover", () => {
    service.addCoverRequirement({
      requirementId: "req-hall",
      source: "Great Hall hire agreement",
      classId: null,
      venueId: "ven-great-hall",
      minimumCoverPence: 5 * MILLION,
    });
    service.addEndorsement({
      endorsementId: "end-03",
      policyId: "pol-2829",
      classId: "cls-inflatable",
      effectiveFrom: new Date("2029-03-01T00:00:00.000Z"),
      effectiveTo: new Date("2029-04-01T00:00:00.000Z"),
      limitPence: 2 * MILLION,
      premiumPence: 25 * POUND,
    });

    const inflatable = find(
      service.assessEvent(
        ball([activity({ activityId: "act-bouncy", classId: "cls-inflatable" })]),
      ),
      "act-bouncy",
    );
    expect(inflatable.status).toBe("LIMIT_SHORTFALL");
    expect(inflatable.shortfallPence).toBe(3 * MILLION);
  });

  test("an activity above the insurer's endorsable ceiling cannot be bought onto the policy", () => {
    const abseil = find(
      service.assessEvent(ball([activity({ activityId: "act-abseil", classId: "cls-abseil" })])),
      "act-abseil",
    );

    expect(abseil.status).toBe("UNINSURED");
    expect(abseil.remedy.kind).toBe("PLACE_STANDALONE_COVER");
  });
});

describe("per-claim limits and aggregate erosion", () => {
  let service: EventInsuranceCoverService;

  beforeEach(() => {
    service = build();
    service.addCoverRequirement({
      requirementId: "req-hall",
      source: "Great Hall hire agreement",
      classId: null,
      venueId: "ven-great-hall",
      minimumCoverPence: 5 * MILLION,
    });
  });

  test("an inner limit binds below the policy's per-claim limit", () => {
    const marquee = find(
      service.assessEvent(ball([activity({ activityId: "act-marquee", classId: "cls-marquee" })])),
      "act-marquee",
    );

    expect(marquee.status).toBe("LIMIT_SHORTFALL");
    expect(marquee.availableCoverPence).toBe(2 * MILLION);
    expect(marquee.remedy.detail).toContain("inner limit");
  });

  test("a claim in November makes an adequate March event inadequate", () => {
    const beforeClaim = service.assessEvent(
      ball([activity({ activityId: "act-bar", classId: "cls-bar" })]),
    );
    expect(beforeClaim.adequate).toBe(true);

    service.recordClaim({
      claimId: "clm-01",
      policyId: "pol-2829",
      incurredAt: new Date("2028-11-10T00:00:00.000Z"),
      amountIncurredPence: 6 * MILLION,
    });

    const afterClaim = service.assessEvent(
      ball([activity({ activityId: "act-bar", classId: "cls-bar" })]),
    );
    expect(afterClaim.aggregateRemainingPence).toBe(4 * MILLION);
    expect(find(afterClaim, "act-bar").status).toBe("AGGREGATE_SHORTFALL");
  });

  test("a claim incurred after the event does not erode the cover that was there on the day", () => {
    service.recordClaim({
      claimId: "clm-02",
      policyId: "pol-2829",
      incurredAt: new Date("2029-06-01T00:00:00.000Z"),
      amountIncurredPence: 8 * MILLION,
    });

    const assessment = service.assessEvent(
      ball([activity({ activityId: "act-bar", classId: "cls-bar" })]),
    );
    expect(assessment.aggregateRemainingPence).toBe(10 * MILLION);
    expect(assessment.adequate).toBe(true);
  });

  test("a claim from the previous policy year does not erode this one", () => {
    service.recordClaim({
      claimId: "clm-03",
      policyId: "pol-2829",
      incurredAt: new Date("2028-05-01T00:00:00.000Z"),
      amountIncurredPence: 9 * MILLION,
    });

    expect(
      service.assessEvent(ball([activity({ activityId: "act-bar", classId: "cls-bar" })]))
        .aggregateRemainingPence,
    ).toBe(10 * MILLION);
  });

  test("claims beyond the aggregate leave nothing rather than a negative remainder", () => {
    service.recordClaim({
      claimId: "clm-04",
      policyId: "pol-2829",
      incurredAt: new Date("2028-11-10T00:00:00.000Z"),
      amountIncurredPence: 14 * MILLION,
    });

    const assessment = service.assessEvent(
      ball([activity({ activityId: "act-bar", classId: "cls-bar" })]),
    );
    expect(assessment.aggregateRemainingPence).toBe(0);
    expect(find(assessment, "act-bar").status).toBe("AGGREGATE_SHORTFALL");
  });
});

describe("layered venue and third-party requirements", () => {
  let service: EventInsuranceCoverService;

  beforeEach(() => {
    service = build();
  });

  test("a venue demanding more than the union carries produces a shortfall against the venue, not the insurer", () => {
    service.addCoverRequirement({
      requirementId: "req-civic",
      source: "Civic Centre hire agreement",
      classId: null,
      venueId: "ven-civic-centre",
      minimumCoverPence: 10 * MILLION,
    });

    const bar = find(
      service.assessEvent(
        ball([activity({ activityId: "act-bar", classId: "cls-bar" })], {
          venueId: "ven-civic-centre",
        }),
      ),
      "act-bar",
    );

    expect(bar.status).toBe("LIMIT_SHORTFALL");
    expect(bar.requiredCoverPence).toBe(10 * MILLION);
    expect(bar.shortfallPence).toBe(5 * MILLION);
    expect(bar.bindingRequirement).toBe("Civic Centre hire agreement");
  });

  test("the highest of several applicable requirements is the one that binds", () => {
    service.addCoverRequirement({
      requirementId: "req-hall",
      source: "Great Hall hire agreement",
      classId: null,
      venueId: "ven-great-hall",
      minimumCoverPence: 2 * MILLION,
    });
    service.addCoverRequirement({
      requirementId: "req-council",
      source: "Local authority licence condition",
      classId: "cls-bar",
      venueId: null,
      minimumCoverPence: 4 * MILLION,
    });

    const bar = find(
      service.assessEvent(
        ball([
          activity({
            activityId: "act-bar",
            classId: "cls-bar",
            statedRequirementPence: 1 * MILLION,
          }),
        ]),
      ),
      "act-bar",
    );

    expect(bar.requiredCoverPence).toBe(4 * MILLION);
    expect(bar.bindingRequirement).toBe("Local authority licence condition");
    expect(bar.status).toBe("COVERED");
  });

  test("a requirement attached to another venue does not follow the event", () => {
    service.addCoverRequirement({
      requirementId: "req-civic",
      source: "Civic Centre hire agreement",
      classId: null,
      venueId: "ven-civic-centre",
      minimumCoverPence: 10 * MILLION,
    });

    const bar = find(
      service.assessEvent(ball([activity({ activityId: "act-bar", classId: "cls-bar" })])),
      "act-bar",
    );

    expect(bar.requiredCoverPence).toBe(0);
    expect(bar.status).toBe("COVERED");
  });
});

describe("contractor certificates", () => {
  let service: EventInsuranceCoverService;

  beforeEach(() => {
    service = build();
    service.addCoverRequirement({
      requirementId: "req-hall",
      source: "Great Hall hire agreement",
      classId: null,
      venueId: "ven-great-hall",
      minimumCoverPence: 5 * MILLION,
    });
  });

  test("a contractor's own cover discharges an activity the union's policy excludes", () => {
    service.registerContractorCertificate({
      certificateId: "cert-pyro",
      contractorId: "con-pyro",
      classIds: ["cls-fireworks"],
      limitPence: 10 * MILLION,
      validFrom: new Date("2029-01-01T00:00:00.000Z"),
      validTo: new Date("2030-01-01T00:00:00.000Z"),
      namesUnionAsInterested: true,
    });

    const assessment = service.assessEvent(
      ball([
        activity({
          activityId: "act-fireworks",
          classId: "cls-fireworks",
          contractorId: "con-pyro",
        }),
      ]),
    );

    expect(assessment.adequate).toBe(true);
    expect(find(assessment, "act-fireworks").status).toBe("COVERED_BY_CONTRACTOR");
  });

  test("a certificate that expired in January transfers the risk back for a March event", () => {
    service.registerContractorCertificate({
      certificateId: "cert-marquee",
      contractorId: "con-marquee",
      classIds: ["cls-fireworks"],
      limitPence: 10 * MILLION,
      validFrom: new Date("2028-09-01T00:00:00.000Z"),
      validTo: new Date("2029-01-01T00:00:00.000Z"),
      namesUnionAsInterested: true,
    });

    const fireworks = find(
      service.assessEvent(
        ball([
          activity({
            activityId: "act-fireworks",
            classId: "cls-fireworks",
            contractorId: "con-marquee",
          }),
        ]),
      ),
      "act-fireworks",
    );

    expect(fireworks.status).toBe("EXCLUDED");
    expect(fireworks.remedy.kind).toBe("RENEW_CONTRACTOR_CERTIFICATE");
  });

  test("a certificate that does not name the union is not cover for the union", () => {
    service.registerContractorCertificate({
      certificateId: "cert-unnamed",
      contractorId: "con-pyro",
      classIds: ["cls-fireworks"],
      limitPence: 10 * MILLION,
      validFrom: new Date("2029-01-01T00:00:00.000Z"),
      validTo: new Date("2030-01-01T00:00:00.000Z"),
      namesUnionAsInterested: false,
    });

    const fireworks = find(
      service.assessEvent(
        ball([
          activity({
            activityId: "act-fireworks",
            classId: "cls-fireworks",
            contractorId: "con-pyro",
          }),
        ]),
      ),
      "act-fireworks",
    );

    expect(fireworks.status).toBe("EXCLUDED");
    expect(fireworks.remedy.detail).toContain("does not name the union");
  });

  test("a certificate below the required limit is reported as low rather than accepted", () => {
    service.registerContractorCertificate({
      certificateId: "cert-small",
      contractorId: "con-pyro",
      classIds: ["cls-fireworks"],
      limitPence: 2 * MILLION,
      validFrom: new Date("2029-01-01T00:00:00.000Z"),
      validTo: new Date("2030-01-01T00:00:00.000Z"),
      namesUnionAsInterested: true,
    });

    const fireworks = find(
      service.assessEvent(
        ball([
          activity({
            activityId: "act-fireworks",
            classId: "cls-fireworks",
            contractorId: "con-pyro",
          }),
        ]),
      ),
      "act-fireworks",
    );

    expect(fireworks.status).toBe("EXCLUDED");
    expect(fireworks.remedy.detail).toContain("below the required limit");
  });
});

describe("ranking and the risk register", () => {
  let service: EventInsuranceCoverService;

  beforeEach(() => {
    service = build();
    service.addCoverRequirement({
      requirementId: "req-hall",
      source: "Great Hall hire agreement",
      classId: null,
      venueId: "ven-great-hall",
      minimumCoverPence: 5 * MILLION,
    });
  });

  test("the uninsurable activity is reported ahead of the underinsured one", () => {
    const assessment = service.assessEvent(
      ball([
        activity({ activityId: "act-marquee", classId: "cls-marquee" }),
        activity({ activityId: "act-bouncy", classId: "cls-inflatable" }),
        activity({ activityId: "act-abseil", classId: "cls-abseil" }),
        activity({ activityId: "act-bar", classId: "cls-bar" }),
      ]),
    );

    expect(assessment.determinations.map((item) => item.activityId)).toEqual([
      "act-abseil",
      "act-marquee",
      "act-bouncy",
      "act-bar",
    ]);
    expect(assessment.blockingActivityIds).toContain("act-abseil");
  });

  test("the sweep lists only events with gaps, worst first and then by date", () => {
    const register = service.sweep([
      ball([activity({ activityId: "act-bar", classId: "cls-bar" })], {
        eventId: "evt-quiz",
        name: "Quiz Night",
        eventDate: new Date("2029-02-01T19:00:00.000Z"),
      }),
      ball([activity({ activityId: "act-marquee", classId: "cls-marquee" })], {
        eventId: "evt-garden",
        name: "Garden Party",
        eventDate: new Date("2029-05-01T14:00:00.000Z"),
      }),
      ball([activity({ activityId: "act-abseil", classId: "cls-abseil" })], {
        eventId: "evt-charity",
        name: "Charity Abseil",
        eventDate: new Date("2029-06-01T10:00:00.000Z"),
      }),
    ]);

    expect(register.map((entry) => entry.eventId)).toEqual(["evt-charity", "evt-garden"]);
    expect(register[0].worstStatus).toBe("UNINSURED");
    expect(register[1].totalShortfallPence).toBe(3 * MILLION);
  });
});
