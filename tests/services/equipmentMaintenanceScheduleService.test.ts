/**
 * Test suite: Usage-Hour Preventive Maintenance Scheduler (#4555)
 * File: tests/services/equipmentMaintenanceScheduleService.test.ts
 *
 * The meter due instant is derived by walking the checkout intervals, so the
 * cases below build usage out of explicit checkouts rather than asserting
 * against an hours figure poked in from outside.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  EquipmentMaintenanceScheduleService,
  MAX_OVERDUE_HOURS,
  MAX_OVERDUE_DAYS,
  MAX_CONSECUTIVE_DEFERRALS,
  MIN_PROJECTION_CHECKOUTS,
  type MaintenancePlan,
} from "../../src/services/equipmentMaintenanceScheduleService";

const CLUB = "club-film-society";
const PROJECTOR = "asset-projector-a";
const BORROWER = "user-borrower";

const COMMISSIONED = new Date("2026-09-01T00:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 86_400_000;

function hoursIn(count: number): Date {
  return new Date(COMMISSIONED.getTime() + count * HOUR);
}

function daysIn(count: number): Date {
  return new Date(COMMISSIONED.getTime() + count * DAY);
}

function plan(overrides: Partial<MaintenancePlan> = {}): MaintenancePlan {
  return {
    assetId: PROJECTOR,
    clubId: CLUB,
    assetName: "Epson projector A",
    meterIntervalHours: 100,
    calendarIntervalDays: 180,
    commissionedAt: COMMISSIONED,
    ...overrides,
  };
}

describe("EquipmentMaintenanceScheduleService (#4555)", () => {
  let scheduler: EquipmentMaintenanceScheduleService;
  let checkoutSequence: number;

  /** Books the asset out for `hours` hours starting `startDay` days in. */
  function use(hours: number, startDay: number, assetId = PROJECTOR): string {
    checkoutSequence += 1;
    const checkoutId = `CO-${checkoutSequence}`;
    scheduler.recordCheckout({
      checkoutId,
      assetId,
      borrowerUserId: BORROWER,
      checkedOutAt: daysIn(startDay),
      returnedAt: new Date(daysIn(startDay).getTime() + hours * HOUR),
    });
    return checkoutId;
  }

  beforeEach(() => {
    scheduler = new EquipmentMaintenanceScheduleService();
    checkoutSequence = 0;
    scheduler.registerAsset(plan());
  });

  describe("plans", () => {
    test("rejects a duplicate plan", () => {
      expect(() => scheduler.registerAsset(plan())).toThrow(/already has a maintenance plan/i);
    });

    test("rejects a non-positive meter interval", () => {
      expect(() =>
        scheduler.registerAsset(plan({ assetId: "asset-b", meterIntervalHours: 0 })),
      ).toThrow(/Meter interval/i);
    });

    test("rejects a non-positive calendar interval", () => {
      expect(() =>
        scheduler.registerAsset(plan({ assetId: "asset-b", calendarIntervalDays: -1 })),
      ).toThrow(/Calendar interval/i);
    });

    test("an unknown asset throws", () => {
      expect(() => scheduler.assess("asset-nope", daysIn(1))).toThrow(/Unknown asset/i);
    });

    test("a brand new asset is due on neither clock", () => {
      const assessment = scheduler.assess(PROJECTOR, daysIn(1));
      expect(assessment.status).toBe("OK");
      expect(assessment.trigger).toBe("NONE");
      expect(assessment.hoursSinceService).toBe(0);
      expect(assessment.meterDueAt).toBeNull();
    });
  });

  describe("usage accrues from checkouts", () => {
    test("hours come from the checkout intervals", () => {
      use(6, 1);
      use(4, 3);
      expect(scheduler.assess(PROJECTOR, daysIn(10)).hoursSinceService).toBe(10);
    });

    test("time on the shelf accrues nothing", () => {
      use(6, 1);
      expect(scheduler.assess(PROJECTOR, daysIn(300)).hoursSinceService).toBe(6);
    });

    test("an overlapping checkout is refused", () => {
      use(6, 1);
      expect(() =>
        scheduler.recordCheckout({
          checkoutId: "CO-clash",
          assetId: PROJECTOR,
          borrowerUserId: "user-other",
          checkedOutAt: new Date(daysIn(1).getTime() + 3 * HOUR),
          returnedAt: new Date(daysIn(1).getTime() + 9 * HOUR),
        }),
      ).toThrow(/overlaps CO-1/);
    });

    test("a checkout that starts exactly when another ends is allowed", () => {
      use(6, 1);
      expect(() =>
        scheduler.recordCheckout({
          checkoutId: "CO-adjacent",
          assetId: PROJECTOR,
          borrowerUserId: "user-other",
          checkedOutAt: new Date(daysIn(1).getTime() + 6 * HOUR),
          returnedAt: new Date(daysIn(1).getTime() + 10 * HOUR),
        }),
      ).not.toThrow();
      expect(scheduler.assess(PROJECTOR, daysIn(5)).hoursSinceService).toBe(10);
    });

    test("an open checkout blocks anything overlapping it", () => {
      scheduler.recordCheckout({
        checkoutId: "CO-open",
        assetId: PROJECTOR,
        borrowerUserId: BORROWER,
        checkedOutAt: daysIn(1),
        returnedAt: null,
      });
      expect(() => use(2, 30)).toThrow(/overlaps CO-open/);
    });

    test("an open checkout keeps accruing until it is closed", () => {
      scheduler.recordCheckout({
        checkoutId: "CO-open",
        assetId: PROJECTOR,
        borrowerUserId: BORROWER,
        checkedOutAt: daysIn(1),
        returnedAt: null,
      });
      expect(scheduler.assess(PROJECTOR, hoursIn(24 + 5)).hoursSinceService).toBe(5);

      scheduler.closeCheckout("CO-open", PROJECTOR, hoursIn(24 + 8));
      expect(scheduler.assess(PROJECTOR, daysIn(10)).hoursSinceService).toBe(8);
    });

    test("rejects a return before the checkout", () => {
      expect(() =>
        scheduler.recordCheckout({
          checkoutId: "CO-bad",
          assetId: PROJECTOR,
          borrowerUserId: BORROWER,
          checkedOutAt: daysIn(5),
          returnedAt: daysIn(4),
        }),
      ).toThrow(/before it went out/i);
    });

    test("rejects closing a checkout twice", () => {
      scheduler.recordCheckout({
        checkoutId: "CO-open",
        assetId: PROJECTOR,
        borrowerUserId: BORROWER,
        checkedOutAt: daysIn(1),
        returnedAt: null,
      });
      scheduler.closeCheckout("CO-open", PROJECTOR, daysIn(2));
      expect(() => scheduler.closeCheckout("CO-open", PROJECTOR, daysIn(3))).toThrow(
        /already returned/i,
      );
    });

    test("rejects closing an unknown checkout", () => {
      expect(() => scheduler.closeCheckout("CO-nope", PROJECTOR, daysIn(2))).toThrow(
        /Unknown checkout/i,
      );
    });

    test("usage between two instants counts only the overlap", () => {
      use(24, 1);
      expect(scheduler.usageHoursBetween(PROJECTOR, daysIn(1), daysIn(1.25))).toBe(6);
    });
  });

  describe("the meter clock", () => {
    test("the due instant falls inside the checkout that crossed the interval", () => {
      use(60, 1);
      use(60, 10);
      const assessment = scheduler.assess(PROJECTOR, daysIn(20));

      // 60 hours by the first checkout, so the 100th hour lands 40 hours into
      // the second one rather than at the end of it.
      expect(assessment.meterDueAt).toEqual(new Date(daysIn(10).getTime() + 40 * HOUR));
      expect(assessment.trigger).toBe("METER");
      expect(assessment.status).toBe("DUE");
    });

    test("the asset is not due one hour before the interval is reached", () => {
      use(99, 1);
      const assessment = scheduler.assess(PROJECTOR, daysIn(20));
      expect(assessment.trigger).toBe("NONE");
      expect(assessment.meterDueAt).toBeNull();
    });

    test("the asset is due at exactly the interval", () => {
      use(100, 1);
      const assessment = scheduler.assess(PROJECTOR, daysIn(20));
      expect(assessment.trigger).toBe("METER");
      expect(assessment.meterDueAt).toEqual(new Date(daysIn(1).getTime() + 100 * HOUR));
    });

    test("a due instant in the future is not yet due", () => {
      use(120, 1);
      // The 100th hour lands part-way through the checkout; assess before it.
      const assessedAt = new Date(daysIn(1).getTime() + 50 * HOUR);
      expect(scheduler.assess(PROJECTOR, assessedAt).trigger).toBe("NONE");
    });

    test("overdue hours count usage past the due point, not elapsed time", () => {
      use(110, 1);
      const assessment = scheduler.assess(PROJECTOR, daysIn(60));
      expect(assessment.overdueHours).toBe(10);
      expect(assessment.overdueDays).toBe(0);
    });

    test("a lightly used asset never reaches the meter", () => {
      use(4, 1);
      use(4, 30);
      const assessment = scheduler.assess(PROJECTOR, daysIn(100));
      expect(assessment.meterDueAt).toBeNull();
      expect(assessment.trigger).toBe("NONE");
    });
  });

  describe("the calendar clock", () => {
    test("an unused asset still comes due on the calendar", () => {
      const assessment = scheduler.assess(PROJECTOR, daysIn(180));
      expect(assessment.trigger).toBe("CALENDAR");
      expect(assessment.status).toBe("DUE");
      expect(assessment.hoursSinceService).toBe(0);
    });

    test("one day short of the interval it is not due", () => {
      expect(scheduler.assess(PROJECTOR, daysIn(179)).trigger).toBe("NONE");
    });

    test("overdue days count from the calendar due point", () => {
      expect(scheduler.assess(PROJECTOR, daysIn(190)).overdueDays).toBe(10);
    });
  });

  describe("whichever clock runs out first", () => {
    test("heavy use brings the service forward and reports the meter", () => {
      use(100, 5);
      const assessment = scheduler.assess(PROJECTOR, daysIn(20));
      expect(assessment.trigger).toBe("METER");
      expect(assessment.daysSinceService).toBeLessThan(180);
    });

    test("light use over a long time reports the calendar", () => {
      use(10, 5);
      use(10, 60);
      const assessment = scheduler.assess(PROJECTOR, daysIn(185));
      expect(assessment.trigger).toBe("CALENDAR");
    });

    test("with both clocks run out the earlier one is reported", () => {
      // 100 hours reached on day 5; the calendar does not run out until 180.
      use(100, 5);
      const assessment = scheduler.assess(PROJECTOR, daysIn(200));
      expect(assessment.trigger).toBe("METER");
    });

    test("a calendar due date earlier than the meter one reports the calendar", () => {
      scheduler.registerAsset(
        plan({ assetId: "asset-drone", assetName: "Drone", calendarIntervalDays: 30 }),
      );
      use(100, 40, "asset-drone");
      const assessment = scheduler.assess("asset-drone", daysIn(60));
      expect(assessment.trigger).toBe("CALENDAR");
    });
  });

  describe("deferral is bounded", () => {
    test("a service that is not due cannot be deferred", () => {
      const result = scheduler.deferService(PROJECTOR, daysIn(10), "user-lead", "busy week");
      expect(result.outcome).toBe("REFUSED_NOT_DUE");
    });

    test("a due service can be deferred once", () => {
      use(100, 1);
      const result = scheduler.deferService(PROJECTOR, daysIn(20), "user-lead", "festival week");
      expect(result.outcome).toBe("DEFERRED");
      expect(scheduler.assess(PROJECTOR, daysIn(21)).status).toBe("DEFERRED");
    });

    test("a third consecutive deferral is refused", () => {
      use(100, 1);
      scheduler.deferService(PROJECTOR, daysIn(20), "user-lead", "first");
      scheduler.deferService(PROJECTOR, daysIn(25), "user-lead", "second");
      const third = scheduler.deferService(PROJECTOR, daysIn(30), "user-lead", "third");

      expect(third.outcome).toBe("REFUSED_CONSECUTIVE_LIMIT");
      expect(scheduler.assess(PROJECTOR, daysIn(30)).consecutiveDeferrals).toBe(
        MAX_CONSECUTIVE_DEFERRALS,
      );
    });

    test("deferral is refused once the hours cap is passed", () => {
      use(100 + MAX_OVERDUE_HOURS + 1, 1);
      const result = scheduler.deferService(PROJECTOR, daysIn(40), "user-lead", "still busy");
      expect(result.outcome).toBe("REFUSED_HOURS_CAP");
    });

    test("deferral is allowed at exactly the hours cap", () => {
      use(100 + MAX_OVERDUE_HOURS, 1);
      expect(scheduler.deferService(PROJECTOR, daysIn(40), "user-lead", "ok").outcome).toBe(
        "DEFERRED",
      );
    });

    test("deferral is refused once the days cap is passed", () => {
      const result = scheduler.deferService(
        PROJECTOR,
        daysIn(180 + MAX_OVERDUE_DAYS + 1),
        "user-lead",
        "no technician",
      );
      expect(result.outcome).toBe("REFUSED_DAYS_CAP");
    });

    test("past the hours cap the asset is locked out of checkout", () => {
      use(100 + MAX_OVERDUE_HOURS + 5, 1);
      const assessment = scheduler.assess(PROJECTOR, daysIn(40));
      expect(assessment.status).toBe("LOCKED_OUT");
      expect(assessment.checkoutBlocked).toBe(true);
      expect(assessment.blockedReason).toMatch(/past the meter due point/);
    });

    test("past the days cap the asset is locked out of checkout", () => {
      const assessment = scheduler.assess(PROJECTOR, daysIn(180 + MAX_OVERDUE_DAYS + 1));
      expect(assessment.status).toBe("LOCKED_OUT");
      expect(assessment.blockedReason).toMatch(/past the calendar due point/);
    });

    test("a due but uncapped asset is not blocked", () => {
      use(105, 1);
      const assessment = scheduler.assess(PROJECTOR, daysIn(20));
      expect(assessment.status).toBe("DUE");
      expect(assessment.checkoutBlocked).toBe(false);
      expect(assessment.blockedReason).toBeNull();
    });

    test("an unknown asset cannot be deferred", () => {
      expect(() => scheduler.deferService("asset-nope", daysIn(1), "u", "r")).toThrow(
        /Unknown asset/i,
      );
    });
  });

  describe("completing a service", () => {
    test("both clocks restart from the completion instant", () => {
      use(100, 1);
      scheduler.completeService({
        assetId: PROJECTOR,
        completedAt: daysIn(30),
        performedBy: "user-tech",
        notes: "Lamp replaced",
      });

      const assessment = scheduler.assess(PROJECTOR, daysIn(31));
      expect(assessment.status).toBe("OK");
      expect(assessment.hoursSinceService).toBe(0);
      expect(assessment.daysSinceService).toBe(1);
      expect(assessment.calendarDueAt).toEqual(daysIn(210));
    });

    test("a late service does not start its next interval already behind", () => {
      // Due on the calendar at day 180, actually done on day 200. The next
      // calendar due is 180 days after the work, not 180 days after the miss.
      scheduler.completeService({
        assetId: PROJECTOR,
        completedAt: daysIn(200),
        performedBy: "user-tech",
        notes: "Late annual service",
      });
      const assessment = scheduler.assess(PROJECTOR, daysIn(201));
      expect(assessment.trigger).toBe("NONE");
      expect(assessment.calendarDueAt).toEqual(daysIn(380));
    });

    test("usage before the service does not count against the next interval", () => {
      use(100, 1);
      scheduler.completeService({
        assetId: PROJECTOR,
        completedAt: daysIn(30),
        performedBy: "user-tech",
        notes: "Lamp replaced",
      });
      use(40, 35);
      expect(scheduler.assess(PROJECTOR, daysIn(50)).hoursSinceService).toBe(40);
    });

    test("a service clears the deferral count", () => {
      use(100, 1);
      scheduler.deferService(PROJECTOR, daysIn(20), "user-lead", "first");
      scheduler.deferService(PROJECTOR, daysIn(25), "user-lead", "second");
      scheduler.completeService({
        assetId: PROJECTOR,
        completedAt: daysIn(30),
        performedBy: "user-tech",
        notes: "Serviced",
      });
      expect(scheduler.assess(PROJECTOR, daysIn(31)).consecutiveDeferrals).toBe(0);
    });

    test("a service that unlocks the asset lets it go out again", () => {
      use(100 + MAX_OVERDUE_HOURS + 5, 1);
      expect(scheduler.assess(PROJECTOR, daysIn(40)).checkoutBlocked).toBe(true);
      scheduler.completeService({
        assetId: PROJECTOR,
        completedAt: daysIn(41),
        performedBy: "user-tech",
        notes: "Overhauled",
      });
      expect(scheduler.assess(PROJECTOR, daysIn(42)).checkoutBlocked).toBe(false);
    });

    test("a service cannot predate the previous one", () => {
      scheduler.completeService({
        assetId: PROJECTOR,
        completedAt: daysIn(30),
        performedBy: "user-tech",
        notes: "First",
      });
      expect(() =>
        scheduler.completeService({
          assetId: PROJECTOR,
          completedAt: daysIn(20),
          performedBy: "user-tech",
          notes: "Backdated",
        }),
      ).toThrow(/cannot predate/i);
    });
  });

  describe("projection", () => {
    test("too few checkouts produces no date", () => {
      use(6, 1);
      use(6, 3);
      const projection = scheduler.projectNextDue(PROJECTOR, daysIn(20));
      expect(projection.reason).toBe("INSUFFICIENT_HISTORY");
      expect(projection.projectedDueAt).toBeNull();
    });

    test("too short a history produces no date", () => {
      use(6, 0);
      use(6, 1);
      use(6, 2);
      const projection = scheduler.projectNextDue(PROJECTOR, daysIn(3));
      expect(projection.reason).toBe("INSUFFICIENT_HISTORY");
    });

    test("an asset with no usage at all reports no observed usage", () => {
      // Enough checkouts and span, but all of zero length.
      for (let index = 0; index < MIN_PROJECTION_CHECKOUTS; index += 1) {
        scheduler.recordCheckout({
          checkoutId: `CO-zero-${index}`,
          assetId: PROJECTOR,
          borrowerUserId: BORROWER,
          checkedOutAt: daysIn(index * 2),
          returnedAt: daysIn(index * 2),
        });
      }
      const projection = scheduler.projectNextDue(PROJECTOR, daysIn(20));
      expect(projection.reason).toBe("NO_OBSERVED_USAGE");
      expect(projection.observedHoursPerDay).toBe(0);
    });

    test("a steady usage rate projects a date ahead of the assessment", () => {
      // 6 hours every other day over three weeks.
      for (let index = 0; index < 10; index += 1) {
        use(6, index * 2);
      }
      const from = daysIn(20);
      const projection = scheduler.projectNextDue(PROJECTOR, from);

      expect(projection.reason).toBe("PROJECTED");
      expect(projection.observedHoursPerDay).toBeGreaterThan(0);
      expect(projection.projectedDueAt!.getTime()).toBeGreaterThan(from.getTime());
    });

    test("the projection never runs past the calendar due date", () => {
      scheduler.registerAsset(
        plan({ assetId: "asset-mixer", assetName: "Mixer", calendarIntervalDays: 25 }),
      );
      for (let index = 0; index < 10; index += 1) {
        use(1, index, "asset-mixer");
      }
      const projection = scheduler.projectNextDue("asset-mixer", daysIn(20));
      expect(projection.projectedDueAt).toEqual(daysIn(25));
    });

    test("an already due asset is reported as due rather than projected", () => {
      use(100, 1);
      const projection = scheduler.projectNextDue(PROJECTOR, daysIn(20));
      expect(projection.reason).toBe("ALREADY_DUE");
      expect(projection.projectedDueAt).toBeNull();
    });
  });

  describe("the fleet list", () => {
    test("locked out comes before due, and due before deferred", () => {
      scheduler.registerAsset(plan({ assetId: "asset-locked", assetName: "Locked" }));
      scheduler.registerAsset(plan({ assetId: "asset-due", assetName: "Due" }));
      scheduler.registerAsset(plan({ assetId: "asset-deferred", assetName: "Deferred" }));

      use(100 + MAX_OVERDUE_HOURS + 5, 1, "asset-locked");
      use(101, 1, "asset-due");
      use(102, 1, "asset-deferred");
      scheduler.deferService("asset-deferred", daysIn(20), "user-lead", "festival");

      const fleet = scheduler.assessFleet(CLUB, daysIn(21));
      expect(fleet.map((entry) => entry.assetId)).toEqual([
        "asset-locked",
        "asset-due",
        "asset-deferred",
        PROJECTOR,
      ]);
    });

    test("the list does not reach into another club", () => {
      scheduler.registerAsset(plan({ assetId: "asset-other", clubId: "club-drama" }));
      const fleet = scheduler.assessFleet(CLUB, daysIn(10));
      expect(fleet.map((entry) => entry.assetId)).not.toContain("asset-other");
    });
  });
});
