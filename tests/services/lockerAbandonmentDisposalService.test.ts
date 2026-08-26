/**
 * Test suite: Locker Abandonment & Contents Disposal Notice Chain (#4556)
 * File: tests/services/lockerAbandonmentDisposalService.test.ts
 *
 * The assertions below pin every instant explicitly, because the question this
 * module has to survive is asked after the fact and with a lawyer in the room:
 * was this unit lawfully disposable on the 14th?
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  LockerAbandonmentDisposalService,
  GRACE_DAYS,
  STANDARD_HOLD_DAYS,
  HIGH_VALUE_HOLD_DAYS,
  CHANNEL_ESCALATION,
  type StorageAssignment,
} from "../../src/services/lockerAbandonmentDisposalService";

const BUILDING = "building-union";
const UNIT = "unit-locker-214";
const ASSIGNMENT = "asg-0001";
const HOLDER = "user-renter";
const FACILITIES = "user-facilities";

const TERM_END = new Date("2027-05-31T00:00:00.000Z");
const DAY = 86_400_000;

function day(offset: number): Date {
  return new Date(TERM_END.getTime() + offset * DAY);
}

function assignment(overrides: Partial<StorageAssignment> = {}): StorageAssignment {
  return {
    assignmentId: ASSIGNMENT,
    unitId: UNIT,
    holderUserId: HOLDER,
    startsAt: new Date("2026-09-01T00:00:00.000Z"),
    endsAt: TERM_END,
    declaredHighValue: false,
    ...overrides,
  };
}

describe("LockerAbandonmentDisposalService (#4556)", () => {
  let service: LockerAbandonmentDisposalService;

  /** Dispatches on `channel` and confirms delivery, both at `deliveredDay`. */
  function deliverOn(channel: (typeof CHANNEL_ESCALATION)[number], deliveredDay: number): string {
    const { noticeId } = service.dispatchNotice(ASSIGNMENT, channel, day(deliveredDay));
    service.markDelivered(ASSIGNMENT, noticeId!, day(deliveredDay));
    return noticeId!;
  }

  /** Dispatches on `channel` and records a failure, both at `failedDay`. */
  function failOn(channel: (typeof CHANNEL_ESCALATION)[number], failedDay: number): string {
    const { noticeId } = service.dispatchNotice(ASSIGNMENT, channel, day(failedDay));
    service.markFailed(ASSIGNMENT, noticeId!, day(failedDay), "no such address");
    return noticeId!;
  }

  beforeEach(() => {
    service = new LockerAbandonmentDisposalService();
    service.registerUnit({
      unitId: UNIT,
      buildingId: BUILDING,
      unitType: "LOCKER",
      label: "214",
    });
    service.assign(assignment());
  });

  describe("registration", () => {
    test("rejects a duplicate unit", () => {
      expect(() =>
        service.registerUnit({
          unitId: UNIT,
          buildingId: BUILDING,
          unitType: "LOCKER",
          label: "214",
        }),
      ).toThrow(/already registered/i);
    });

    test("rejects an assignment on an unknown unit", () => {
      expect(() => service.assign(assignment({ assignmentId: "x", unitId: "unit-none" }))).toThrow(
        /Unknown storage unit/i,
      );
    });

    test("rejects a duplicate assignment", () => {
      expect(() => service.assign(assignment())).toThrow(/already exists/i);
    });

    test("rejects an assignment ending before it starts", () => {
      expect(() =>
        service.assign(assignment({ assignmentId: "x", endsAt: new Date("2026-01-01") })),
      ).toThrow(/must end after it starts/i);
    });

    test("an unknown assignment throws", () => {
      expect(() => service.assess("asg-none", day(1))).toThrow(/Unknown storage assignment/i);
    });
  });

  describe("the lifecycle up to abandonment", () => {
    test("an assignment inside its term is active", () => {
      const assessment = service.assess(ASSIGNMENT, day(-1));
      expect(assessment.state).toBe("ACTIVE");
      expect(assessment.disposable).toBe(false);
    });

    test("past the end date it is in grace, not abandoned", () => {
      const assessment = service.assess(ASSIGNMENT, day(1));
      expect(assessment.state).toBe("IN_GRACE");
      expect(assessment.graceEndsAt).toEqual(day(GRACE_DAYS));
    });

    test("the last day of grace is still grace", () => {
      expect(service.assess(ASSIGNMENT, day(GRACE_DAYS - 1)).state).toBe("IN_GRACE");
    });

    test("past grace with no notice it is abandoned but nothing more", () => {
      const assessment = service.assess(ASSIGNMENT, day(GRACE_DAYS));
      expect(assessment.state).toBe("ABANDONED");
      expect(assessment.reason).toBe("ABANDONED_NO_NOTICE");
      expect(assessment.disposable).toBe(false);
    });

    test("a year of abandonment with no notice is still not disposable", () => {
      // Time alone never gets there. This is the whole point.
      const assessment = service.assess(ASSIGNMENT, day(400));
      expect(assessment.state).toBe("ABANDONED");
      expect(assessment.disposable).toBe(false);
    });
  });

  describe("dispatch is not delivery", () => {
    test("a notice cannot be sent before the unit is abandoned", () => {
      const result = service.dispatchNotice(ASSIGNMENT, "EMAIL", day(5));
      expect(result.outcome).toBe("REFUSED_NOT_ABANDONED");
      expect(result.noticeId).toBeNull();
    });

    test("a dispatched but undelivered notice starts no clock", () => {
      service.dispatchNotice(ASSIGNMENT, "EMAIL", day(20));
      const assessment = service.assess(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS + 10));
      expect(assessment.reason).toBe("NOTICE_DISPATCHED_NOT_DELIVERED");
      expect(assessment.holdStartedAt).toBeNull();
      expect(assessment.disposable).toBe(false);
    });

    test("a bounced notice starts no clock either", () => {
      failOn("EMAIL", 20);
      const assessment = service.assess(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS + 10));
      expect(assessment.holdStartedAt).toBeNull();
      expect(assessment.disposable).toBe(false);
    });

    test("the hold runs from delivery and not from the end of term", () => {
      deliverOn("EMAIL", 40);
      const assessment = service.assess(ASSIGNMENT, day(41));
      expect(assessment.holdStartedAt).toEqual(day(40));
      expect(assessment.holdEndsAt).toEqual(day(40 + STANDARD_HOLD_DAYS));
      // Counting from term end would have made this disposable already.
      expect(assessment.disposable).toBe(false);
    });

    test("delivery cannot predate dispatch", () => {
      const { noticeId } = service.dispatchNotice(ASSIGNMENT, "EMAIL", day(20));
      expect(() => service.markDelivered(ASSIGNMENT, noticeId!, day(19))).toThrow(
        /before it was sent/i,
      );
    });

    test("a notice cannot be resolved twice", () => {
      const noticeId = deliverOn("EMAIL", 20);
      expect(() => service.markFailed(ASSIGNMENT, noticeId, day(21), "late bounce")).toThrow(
        /already delivered/i,
      );
    });

    test("an unknown notice throws", () => {
      expect(() => service.markDelivered(ASSIGNMENT, "NTC-999999", day(20))).toThrow(
        /Unknown notice/i,
      );
    });
  });

  describe("channel escalation", () => {
    test("a second channel cannot be opened while the first is awaiting a receipt", () => {
      service.dispatchNotice(ASSIGNMENT, "EMAIL", day(20));
      const second = service.dispatchNotice(ASSIGNMENT, "SMS", day(21));
      expect(second.outcome).toBe("REFUSED_PREVIOUS_CHANNEL_STILL_OPEN");
    });

    test("a failed channel opens the next one", () => {
      failOn("EMAIL", 20);
      expect(service.dispatchNotice(ASSIGNMENT, "SMS", day(21)).outcome).toBe("DISPATCHED");
    });

    test("a delivered channel does not open another", () => {
      deliverOn("EMAIL", 20);
      expect(service.dispatchNotice(ASSIGNMENT, "SMS", day(21)).outcome).toBe(
        "REFUSED_PREVIOUS_CHANNEL_STILL_OPEN",
      );
    });

    test("the same channel cannot be used twice", () => {
      failOn("EMAIL", 20);
      const again = service.dispatchNotice(ASSIGNMENT, "EMAIL", day(21));
      expect(again.outcome).toBe("REFUSED_CHANNEL_ALREADY_USED");
    });

    test("delivery on a later channel starts the hold", () => {
      failOn("EMAIL", 20);
      failOn("SMS", 21);
      deliverOn("POSTAL", 25);
      const assessment = service.assess(ASSIGNMENT, day(26));
      expect(assessment.holdStartedAt).toEqual(day(25));
      expect(assessment.state).toBe("ON_HOLD");
    });

    test("every channel failing routes to manual review, never to disposal", () => {
      failOn("EMAIL", 20);
      failOn("SMS", 21);
      failOn("POSTAL", 22);

      const assessment = service.assess(ASSIGNMENT, day(500));
      expect(assessment.state).toBe("MANUAL_REVIEW");
      expect(assessment.reason).toBe("MANUAL_REVIEW_CHANNELS_EXHAUSTED");
      expect(assessment.channelsExhausted).toBe(true);
      expect(assessment.disposable).toBe(false);
    });

    test("two of three channels failed is not yet exhaustion", () => {
      failOn("EMAIL", 20);
      failOn("SMS", 21);
      const assessment = service.assess(ASSIGNMENT, day(200));
      expect(assessment.channelsExhausted).toBe(false);
      expect(assessment.reason).toBe("NOTICE_DISPATCHED_NOT_DELIVERED");
    });

    test("a reviewer can release an exhausted chain", () => {
      failOn("EMAIL", 20);
      failOn("SMS", 21);
      failOn("POSTAL", 22);
      service.approveManualReview(ASSIGNMENT, day(30));

      const assessment = service.assess(ASSIGNMENT, day(31));
      expect(assessment.manualReviewApproved).toBe(true);
      expect(assessment.disposable).toBe(true);
    });
  });

  describe("the hold period", () => {
    test("one day short of the hold it is not disposable", () => {
      deliverOn("EMAIL", 20);
      const assessment = service.assess(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS - 1));
      expect(assessment.state).toBe("ON_HOLD");
      expect(assessment.disposable).toBe(false);
    });

    test("on the day the hold elapses it becomes disposable", () => {
      deliverOn("EMAIL", 20);
      const assessment = service.assess(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS));
      expect(assessment.state).toBe("DISPOSABLE");
      expect(assessment.reason).toBe("DISPOSABLE");
      expect(assessment.disposable).toBe(true);
    });

    test("the first delivery starts the hold, not the last notice", () => {
      deliverOn("EMAIL", 20);
      const assessment = service.assess(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS));
      expect(assessment.holdStartedAt).toEqual(day(20));
    });
  });

  describe("high value", () => {
    test("declared high value gets the longer hold", () => {
      service.assign(assignment({ assignmentId: "asg-hv", declaredHighValue: true }));
      const { noticeId } = service.dispatchNotice("asg-hv", "EMAIL", day(20));
      service.markDelivered("asg-hv", noticeId!, day(20));

      const assessment = service.assess("asg-hv", day(20 + STANDARD_HOLD_DAYS + 1));
      expect(assessment.holdDays).toBe(HIGH_VALUE_HOLD_DAYS);
      expect(assessment.state).toBe("ON_HOLD");
      expect(assessment.disposable).toBe(false);
    });

    test("high value still needs a human once the longer hold elapses", () => {
      service.assign(assignment({ assignmentId: "asg-hv", declaredHighValue: true }));
      const { noticeId } = service.dispatchNotice("asg-hv", "EMAIL", day(20));
      service.markDelivered("asg-hv", noticeId!, day(20));

      const assessment = service.assess("asg-hv", day(20 + HIGH_VALUE_HOLD_DAYS));
      expect(assessment.reason).toBe("MANUAL_REVIEW_HIGH_VALUE");
      expect(assessment.requiresManualReview).toBe(true);
      expect(assessment.disposable).toBe(false);
    });

    test("an approved review releases it", () => {
      service.assign(assignment({ assignmentId: "asg-hv", declaredHighValue: true }));
      const { noticeId } = service.dispatchNotice("asg-hv", "EMAIL", day(20));
      service.markDelivered("asg-hv", noticeId!, day(20));
      service.approveManualReview("asg-hv", day(20 + HIGH_VALUE_HOLD_DAYS));

      expect(service.assess("asg-hv", day(20 + HIGH_VALUE_HOLD_DAYS)).disposable).toBe(true);
    });

    test("high value found at inventory raises an undeclared unit", () => {
      deliverOn("EMAIL", 20);
      // Would have been disposable on this date as a standard unit.
      expect(service.assess(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS)).disposable).toBe(true);

      service.recordInventory({
        assignmentId: ASSIGNMENT,
        takenAt: day(25),
        takenBy: FACILITIES,
        contentsSummary: "Laptop, external drive",
        highValueFound: true,
      });

      const assessment = service.assess(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS));
      expect(assessment.highValue).toBe(true);
      expect(assessment.holdDays).toBe(HIGH_VALUE_HOLD_DAYS);
      expect(assessment.disposable).toBe(false);
    });

    test("an inventory taken after the assessment instant does not apply to it", () => {
      deliverOn("EMAIL", 20);
      service.recordInventory({
        assignmentId: ASSIGNMENT,
        takenAt: day(90),
        takenBy: FACILITIES,
        contentsSummary: "Laptop",
        highValueFound: true,
      });
      expect(service.assess(ASSIGNMENT, day(60)).highValue).toBe(false);
    });

    test("an inventory finding nothing of value changes nothing", () => {
      deliverOn("EMAIL", 20);
      service.recordInventory({
        assignmentId: ASSIGNMENT,
        takenAt: day(25),
        takenBy: FACILITIES,
        contentsSummary: "Gym kit, two textbooks",
        highValueFound: false,
      });
      expect(service.assess(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS)).disposable).toBe(true);
    });
  });

  describe("renewal cancels the chain", () => {
    test("a renewal returns the unit to active", () => {
      deliverOn("EMAIL", 20);
      service.renew(ASSIGNMENT, day(25), day(200));
      const assessment = service.assess(ASSIGNMENT, day(30));
      expect(assessment.state).toBe("ACTIVE");
      expect(assessment.holdStartedAt).toBeNull();
    });

    test("a renewal voids the notices without deleting them", () => {
      deliverOn("EMAIL", 20);
      service.renew(ASSIGNMENT, day(25), day(200));
      expect(service.noticesFor(ASSIGNMENT)).toHaveLength(0);
      expect(service.voidedNoticesFor(ASSIGNMENT)).toHaveLength(1);
      expect(service.voidedNoticesFor(ASSIGNMENT)[0].voidedAt).toEqual(day(25));
    });

    test("re-entering the cycle needs a fresh notice, not the old clock", () => {
      deliverOn("EMAIL", 20);
      service.renew(ASSIGNMENT, day(25), day(200));

      // Long past the old hold, and past grace on the new term. Still nothing,
      // because the old delivery cannot carry a countdown across a renewal.
      const assessment = service.assess(ASSIGNMENT, day(200 + GRACE_DAYS + 5));
      expect(assessment.state).toBe("ABANDONED");
      expect(assessment.disposable).toBe(false);
    });

    test("the same channel can be used again in the new chain", () => {
      deliverOn("EMAIL", 20);
      service.renew(ASSIGNMENT, day(25), day(200));
      const again = service.dispatchNotice(ASSIGNMENT, "EMAIL", day(200 + GRACE_DAYS + 1));
      expect(again.outcome).toBe("DISPATCHED");
    });

    test("a renewal clears a manual review approval", () => {
      service.assign(assignment({ assignmentId: "asg-hv", declaredHighValue: true }));
      const { noticeId } = service.dispatchNotice("asg-hv", "EMAIL", day(20));
      service.markDelivered("asg-hv", noticeId!, day(20));
      service.approveManualReview("asg-hv", day(21));
      service.renew("asg-hv", day(22), day(200));

      expect(service.assess("asg-hv", day(300)).manualReviewApproved).toBe(false);
    });

    test("a renewal must extend the term", () => {
      expect(() => service.renew(ASSIGNMENT, day(5), day(-5))).toThrow(/must extend the term/i);
    });
  });

  describe("disposal", () => {
    test("a disposable unit can be disposed of", () => {
      deliverOn("EMAIL", 20);
      const result = service.dispose(
        ASSIGNMENT,
        day(20 + STANDARD_HOLD_DAYS),
        FACILITIES,
        "Donated to the charity shop",
      );

      expect(result.outcome).toBe("DISPOSED");
      expect(service.disposalRecord(ASSIGNMENT)?.noticeDeliveredAt).toEqual(day(20));
    });

    test("a unit still on hold cannot be disposed of", () => {
      deliverOn("EMAIL", 20);
      const result = service.dispose(ASSIGNMENT, day(30), FACILITIES, "Skip");
      expect(result.outcome).toBe("REFUSED_NOT_DISPOSABLE");
      expect(result.reason).toBe("HOLD_IN_PROGRESS");
      expect(service.disposalRecord(ASSIGNMENT)).toBeNull();
    });

    test("an abandoned unit with no notice cannot be disposed of", () => {
      const result = service.dispose(ASSIGNMENT, day(400), FACILITIES, "Skip");
      expect(result.outcome).toBe("REFUSED_NOT_DISPOSABLE");
      expect(result.reason).toBe("ABANDONED_NO_NOTICE");
    });

    test("a unit awaiting review cannot be disposed of", () => {
      service.assign(assignment({ assignmentId: "asg-hv", declaredHighValue: true }));
      const { noticeId } = service.dispatchNotice("asg-hv", "EMAIL", day(20));
      service.markDelivered("asg-hv", noticeId!, day(20));

      const result = service.dispose("asg-hv", day(20 + HIGH_VALUE_HOLD_DAYS), FACILITIES, "Skip");
      expect(result.reason).toBe("MANUAL_REVIEW_HIGH_VALUE");
    });

    test("disposing twice is refused", () => {
      deliverOn("EMAIL", 20);
      service.dispose(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS), FACILITIES, "Skip");
      const again = service.dispose(ASSIGNMENT, day(60), FACILITIES, "Skip");
      expect(again.outcome).toBe("REFUSED_ALREADY_DISPOSED");
    });

    test("a disposed unit cannot be renewed or noticed", () => {
      deliverOn("EMAIL", 20);
      service.dispose(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS), FACILITIES, "Skip");
      expect(() => service.renew(ASSIGNMENT, day(60), day(300))).toThrow(/cannot be renewed/i);
      expect(service.dispatchNotice(ASSIGNMENT, "SMS", day(60)).outcome).toBe(
        "REFUSED_ALREADY_DISPOSED",
      );
    });

    test("a disposed unit reports its state afterwards", () => {
      deliverOn("EMAIL", 20);
      service.dispose(ASSIGNMENT, day(20 + STANDARD_HOLD_DAYS), FACILITIES, "Skip");
      const assessment = service.assess(ASSIGNMENT, day(100));
      expect(assessment.state).toBe("DISPOSED");
      expect(assessment.disposable).toBe(false);
    });
  });

  describe("the building sweep", () => {
    test("units are listed with the most advanced first", () => {
      service.registerUnit({
        unitId: "unit-215",
        buildingId: BUILDING,
        unitType: "LOCKER",
        label: "215",
      });
      service.registerUnit({
        unitId: "unit-216",
        buildingId: BUILDING,
        unitType: "STORAGE_CAGE",
        label: "216",
      });
      service.assign(assignment({ assignmentId: "asg-hold", unitId: "unit-215" }));
      service.assign(assignment({ assignmentId: "asg-quiet", unitId: "unit-216" }));

      deliverOn("EMAIL", 20);
      const held = service.dispatchNotice("asg-hold", "EMAIL", day(40));
      service.markDelivered("asg-hold", held.noticeId!, day(40));

      const sweep = service.assessBuilding(BUILDING, day(20 + STANDARD_HOLD_DAYS));
      expect(sweep.map((entry) => entry.assignmentId)).toEqual([
        ASSIGNMENT,
        "asg-hold",
        "asg-quiet",
      ]);
      expect(sweep[0].state).toBe("DISPOSABLE");
      expect(sweep[1].state).toBe("ON_HOLD");
      expect(sweep[2].state).toBe("ABANDONED");
    });

    test("the sweep does not reach into another building", () => {
      service.registerUnit({
        unitId: "unit-other",
        buildingId: "building-science",
        unitType: "LOCKER",
        label: "1",
      });
      service.assign(assignment({ assignmentId: "asg-other", unitId: "unit-other" }));
      expect(
        service.assessBuilding(BUILDING, day(30)).map((entry) => entry.assignmentId),
      ).not.toContain("asg-other");
    });
  });
});
