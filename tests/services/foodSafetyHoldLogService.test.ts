/**
 * Test suite: Catered Event Food Safety Time & Temperature Hold Log (#4554)
 * File: tests/services/foodSafetyHoldLogService.test.ts
 *
 * Every assessment below pins its instant explicitly. Nothing here reads the
 * clock, which is what makes "was this tray servable at 13:40?" a question with
 * one answer during an inspection three weeks later.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  FoodSafetyHoldLogService,
  COLD_HOLD_MAX_CELSIUS,
  HOT_HOLD_MIN_CELSIUS,
  CUMULATIVE_LIMIT_MINUTES,
  WARNING_THRESHOLD_MINUTES,
  REHEAT_MIN_CELSIUS,
  type FoodItem,
} from "../../src/services/foodSafetyHoldLogService";

const EVENT = "event-diwali-night";
const HOT_ITEM = "item-chicken-curry";
const COLD_ITEM = "item-potato-salad";
const VOLUNTEER = "user-volunteer";

const SERVICE_START = new Date("2026-11-07T10:00:00.000Z");
const MINUTE = 60_000;

function at(minutesAfterStart: number): Date {
  return new Date(SERVICE_START.getTime() + minutesAfterStart * MINUTE);
}

function hotItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    itemId: HOT_ITEM,
    eventId: EVENT,
    name: "Chicken curry",
    holdingType: "HOT",
    preparedAt: SERVICE_START,
    ...overrides,
  };
}

function coldItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    itemId: COLD_ITEM,
    eventId: EVENT,
    name: "Potato salad",
    holdingType: "COLD",
    preparedAt: SERVICE_START,
    ...overrides,
  };
}

describe("FoodSafetyHoldLogService (#4554)", () => {
  let log: FoodSafetyHoldLogService;

  const read = (itemId: string, celsius: number, minutes: number) =>
    log.recordReading({ itemId, celsius, takenAt: at(minutes), takenByUserId: VOLUNTEER });

  beforeEach(() => {
    log = new FoodSafetyHoldLogService();
    log.registerItem(hotItem());
    log.registerItem(coldItem());
  });

  describe("registration", () => {
    test("rejects a duplicate item", () => {
      expect(() => log.registerItem(hotItem())).toThrow(/already on the log/i);
    });

    test("rejects an unnamed item", () => {
      expect(() => log.registerItem(hotItem({ itemId: "x", name: "   " }))).toThrow(
        /needs a name/i,
      );
    });

    test("an item with no readings has accrued nothing", () => {
      const assessment = log.assess(HOT_ITEM, at(120));
      expect(assessment.cumulativeExposureMinutes).toBe(0);
      expect(assessment.decision).toBe("SERVABLE");
      expect(assessment.lastReadingAt).toBeNull();
      expect(assessment.inDangerZoneNow).toBe(false);
    });

    test("an unknown item throws", () => {
      expect(() => log.assess("item-nope", at(10))).toThrow(/Unknown food item/i);
    });
  });

  describe("the danger zone thresholds differ by holding type", () => {
    test("a hot dish below 60 is in the zone", () => {
      read(HOT_ITEM, 55, 0);
      expect(log.assess(HOT_ITEM, at(0)).inDangerZoneNow).toBe(true);
    });

    test("a hot dish at exactly 60 is not", () => {
      read(HOT_ITEM, HOT_HOLD_MIN_CELSIUS, 0);
      expect(log.assess(HOT_ITEM, at(0)).inDangerZoneNow).toBe(false);
    });

    test("a cold dish above 5 is in the zone", () => {
      read(COLD_ITEM, 8, 0);
      expect(log.assess(COLD_ITEM, at(0)).inDangerZoneNow).toBe(true);
    });

    test("a cold dish at exactly 5 is not", () => {
      read(COLD_ITEM, COLD_HOLD_MAX_CELSIUS, 0);
      expect(log.assess(COLD_ITEM, at(0)).inDangerZoneNow).toBe(false);
    });

    test("55 degrees is safe for a cold dish and unsafe for a hot one", () => {
      // The same temperature, two dishes, two answers. A single shared band
      // could not produce both.
      read(HOT_ITEM, 55, 0);
      read(COLD_ITEM, 55, 0);
      expect(log.assess(HOT_ITEM, at(0)).inDangerZoneNow).toBe(true);
      expect(log.assess(COLD_ITEM, at(0)).inDangerZoneNow).toBe(true);

      log.registerItem(coldItem({ itemId: "item-yoghurt", name: "Yoghurt" }));
      read("item-yoghurt", 2, 0);
      expect(log.assess("item-yoghurt", at(0)).inDangerZoneNow).toBe(false);
    });
  });

  describe("exposure between two readings", () => {
    test("both readings in the zone counts the whole interval", () => {
      read(HOT_ITEM, 50, 0);
      read(HOT_ITEM, 40, 30);
      expect(log.assess(HOT_ITEM, at(30)).cumulativeExposureMinutes).toBe(30);
    });

    test("both readings out of the zone counts nothing", () => {
      read(HOT_ITEM, 70, 0);
      read(HOT_ITEM, 65, 30);
      expect(log.assess(HOT_ITEM, at(30)).cumulativeExposureMinutes).toBe(0);
    });

    test("a fall into the zone counts only the part after the crossing", () => {
      // 70 -> 50 over 40 minutes. It crosses 60 exactly halfway.
      read(HOT_ITEM, 70, 0);
      read(HOT_ITEM, 50, 40);
      expect(log.assess(HOT_ITEM, at(40)).cumulativeExposureMinutes).toBe(20);
    });

    test("a rise out of the zone counts only the part before the crossing", () => {
      // 50 -> 70 over 40 minutes; out of the zone from the halfway point.
      read(HOT_ITEM, 50, 0);
      read(HOT_ITEM, 70, 40);
      expect(log.assess(HOT_ITEM, at(40)).cumulativeExposureMinutes).toBe(20);
    });

    test("a cold dish warming through the threshold interpolates the same way", () => {
      // 1 -> 9 over 40 minutes crosses 5 halfway.
      read(COLD_ITEM, 1, 0);
      read(COLD_ITEM, 9, 40);
      expect(log.assess(COLD_ITEM, at(40)).cumulativeExposureMinutes).toBe(20);
    });

    test("an off-centre crossing is not rounded to the midpoint", () => {
      // 3 -> 11 over 60 minutes crosses 5 a quarter of the way in.
      read(COLD_ITEM, 3, 0);
      read(COLD_ITEM, 11, 60);
      expect(log.assess(COLD_ITEM, at(60)).cumulativeExposureMinutes).toBe(45);
    });

    test("a crossing is neither rounded up to the whole interval nor down to none", () => {
      read(HOT_ITEM, 62, 0);
      read(HOT_ITEM, 58, 60);
      const exposure = log.assess(HOT_ITEM, at(60)).cumulativeExposureMinutes;
      expect(exposure).toBeGreaterThan(0);
      expect(exposure).toBeLessThan(60);
      expect(exposure).toBe(30);
    });

    test("two readings at the same instant contribute nothing", () => {
      read(HOT_ITEM, 50, 30);
      read(HOT_ITEM, 45, 30);
      expect(log.assess(HOT_ITEM, at(30)).cumulativeExposureMinutes).toBe(0);
    });

    test("exposure accumulates across several intervals", () => {
      read(HOT_ITEM, 50, 0);
      read(HOT_ITEM, 45, 30);
      read(HOT_ITEM, 40, 60);
      expect(log.assess(HOT_ITEM, at(60)).cumulativeExposureMinutes).toBe(60);
    });
  });

  describe("the fridge gap pauses the clock and never resets it", () => {
    test("the stretch before and the stretch after both count", () => {
      // Out at 11:00, back in the fridge at 12:00, out again at 14:00.
      // The clipboard version of this reads as if the clock restarted at 14:00.
      read(COLD_ITEM, 12, 60); // 11:00, in the zone
      read(COLD_ITEM, 12, 120); // 12:00, still in the zone
      log.recordCorrectiveAction({
        itemId: COLD_ITEM,
        type: "MOVED_TO_REFRIGERATION",
        occurredAt: at(120),
        note: "Back to the walk-in between sittings",
      });
      read(COLD_ITEM, 3, 130); // cooled below threshold
      read(COLD_ITEM, 3, 240); // still cold at 14:00
      read(COLD_ITEM, 12, 250); // back out and warm again
      read(COLD_ITEM, 12, 300); // 15:00

      // 60 minutes on the first stretch, part of the cool-down, none of the
      // fridge hold, part of the warm-up, and 50 on the second stretch.
      const assessment = log.assess(COLD_ITEM, at(300));
      expect(assessment.cumulativeExposureMinutes).toBeGreaterThan(110);
      expect(assessment.cumulativeExposureMinutes).toBeLessThan(130);
    });

    test("time held below the threshold adds nothing at all", () => {
      read(COLD_ITEM, 2, 0);
      read(COLD_ITEM, 2, 300);
      expect(log.assess(COLD_ITEM, at(300)).cumulativeExposureMinutes).toBe(0);
    });

    test("a dish returned to the fridge keeps the exposure it already had", () => {
      read(COLD_ITEM, 10, 0);
      read(COLD_ITEM, 10, 90);
      read(COLD_ITEM, 1, 100);
      const before = log.assess(COLD_ITEM, at(100)).cumulativeExposureMinutes;
      read(COLD_ITEM, 1, 400);
      expect(log.assess(COLD_ITEM, at(400)).cumulativeExposureMinutes).toBe(before);
      expect(before).toBeGreaterThanOrEqual(90);
    });
  });

  describe("carrying the last reading forward", () => {
    test("an untouched tray keeps accruing after its last reading", () => {
      read(HOT_ITEM, 50, 0);
      const assessment = log.assess(HOT_ITEM, at(120));
      expect(assessment.cumulativeExposureMinutes).toBe(120);
      expect(assessment.carriedForwardMinutes).toBe(120);
    });

    test("the carried portion is reported apart from the measured one", () => {
      read(HOT_ITEM, 50, 0);
      read(HOT_ITEM, 45, 60);
      const assessment = log.assess(HOT_ITEM, at(90));
      expect(assessment.cumulativeExposureMinutes).toBe(90);
      expect(assessment.carriedForwardMinutes).toBe(30);
    });

    test("nothing is carried forward from a reading out of the zone", () => {
      read(HOT_ITEM, 75, 0);
      const assessment = log.assess(HOT_ITEM, at(180));
      expect(assessment.cumulativeExposureMinutes).toBe(0);
      expect(assessment.carriedForwardMinutes).toBe(0);
    });

    test("an assessment before the last reading ignores it", () => {
      read(HOT_ITEM, 50, 0);
      read(HOT_ITEM, 75, 60);
      // At 30 minutes only the first reading exists, carried forward.
      expect(log.assess(HOT_ITEM, at(30)).cumulativeExposureMinutes).toBe(30);
    });

    test("an assessment before any reading sees nothing", () => {
      read(HOT_ITEM, 50, 60);
      expect(log.assess(HOT_ITEM, at(30)).cumulativeExposureMinutes).toBe(0);
    });

    test("carry-forward stops at the discard", () => {
      read(HOT_ITEM, 50, 0);
      log.discard(HOT_ITEM, at(60), "Past limit at the close of service");
      expect(log.assess(HOT_ITEM, at(300)).cumulativeExposureMinutes).toBe(60);
    });
  });

  describe("decisions", () => {
    test("under the warning threshold the dish is servable", () => {
      read(HOT_ITEM, 50, 0);
      const assessment = log.assess(HOT_ITEM, at(WARNING_THRESHOLD_MINUTES - 1));
      expect(assessment.decision).toBe("SERVABLE");
      expect(assessment.remainingMinutes).toBe(CUMULATIVE_LIMIT_MINUTES - 119);
    });

    test("the warning fires exactly on the threshold", () => {
      read(HOT_ITEM, 50, 0);
      expect(log.assess(HOT_ITEM, at(WARNING_THRESHOLD_MINUTES)).decision).toBe(
        "WARN_APPROACHING_LIMIT",
      );
    });

    test("one minute short of the limit is still only a warning", () => {
      read(HOT_ITEM, 50, 0);
      expect(log.assess(HOT_ITEM, at(CUMULATIVE_LIMIT_MINUTES - 1)).decision).toBe(
        "WARN_APPROACHING_LIMIT",
      );
    });

    test("the limit itself is a discard", () => {
      read(HOT_ITEM, 50, 0);
      const assessment = log.assess(HOT_ITEM, at(CUMULATIVE_LIMIT_MINUTES));
      expect(assessment.decision).toBe("DISCARD");
      expect(assessment.remainingMinutes).toBe(0);
    });

    test("remaining minutes never go negative", () => {
      read(HOT_ITEM, 50, 0);
      expect(log.assess(HOT_ITEM, at(600)).remainingMinutes).toBe(0);
    });

    test("a discarded dish reports DISCARD regardless of its exposure", () => {
      read(COLD_ITEM, 2, 0);
      log.discard(COLD_ITEM, at(30), "Dropped");
      const assessment = log.assess(COLD_ITEM, at(30));
      expect(assessment.decision).toBe("DISCARD");
      expect(assessment.state).toBe("DISCARDED");
      expect(assessment.cumulativeExposureMinutes).toBe(0);
    });
  });

  describe("reheating", () => {
    test("a hot dish inside the limit returns to service", () => {
      read(HOT_ITEM, 45, 0);
      const result = log.reheat(HOT_ITEM, 78, at(60), VOLUNTEER);
      expect(result.outcome).toBe("RETURNED_TO_SERVICE");
      expect(log.assess(HOT_ITEM, at(60)).reheatsUsed).toBe(1);
    });

    test("the exposure carries forward rather than resetting", () => {
      read(HOT_ITEM, 45, 0);
      const before = log.assess(HOT_ITEM, at(60)).cumulativeExposureMinutes;
      log.reheat(HOT_ITEM, 78, at(60), VOLUNTEER);
      const after = log.assess(HOT_ITEM, at(60)).cumulativeExposureMinutes;

      expect(before).toBe(60);
      expect(after).toBe(before);
      expect(after).toBeGreaterThan(0);
    });

    test("a reheat below 74 degrees is refused", () => {
      read(HOT_ITEM, 45, 0);
      const result = log.reheat(HOT_ITEM, REHEAT_MIN_CELSIUS - 1, at(60), VOLUNTEER);
      expect(result.outcome).toBe("REFUSED_BELOW_REHEAT_TEMPERATURE");
      expect(log.assess(HOT_ITEM, at(60)).reheatsUsed).toBe(0);
    });

    test("a reheat at exactly 74 degrees is allowed", () => {
      read(HOT_ITEM, 45, 0);
      expect(log.reheat(HOT_ITEM, REHEAT_MIN_CELSIUS, at(60), VOLUNTEER).outcome).toBe(
        "RETURNED_TO_SERVICE",
      );
    });

    test("a second reheat is refused", () => {
      read(HOT_ITEM, 45, 0);
      log.reheat(HOT_ITEM, 78, at(30), VOLUNTEER);
      read(HOT_ITEM, 45, 60);
      const second = log.reheat(HOT_ITEM, 80, at(90), VOLUNTEER);
      expect(second.outcome).toBe("REFUSED_REHEAT_ALLOWANCE_SPENT");
      expect(log.assess(HOT_ITEM, at(90)).reheatsUsed).toBe(1);
    });

    test("a cold dish cannot be reheated", () => {
      read(COLD_ITEM, 12, 0);
      const result = log.reheat(COLD_ITEM, 80, at(30), VOLUNTEER);
      expect(result.outcome).toBe("REFUSED_COLD_ITEM");
      expect(log.assess(COLD_ITEM, at(30)).reheatsUsed).toBe(0);
    });

    test("a dish past the cumulative limit cannot be reheated back into service", () => {
      read(HOT_ITEM, 45, 0);
      const result = log.reheat(HOT_ITEM, 85, at(CUMULATIVE_LIMIT_MINUTES + 10), VOLUNTEER);
      expect(result.outcome).toBe("REFUSED_PAST_CUMULATIVE_LIMIT");
    });

    test("a discarded dish cannot be reheated", () => {
      read(HOT_ITEM, 45, 0);
      log.discard(HOT_ITEM, at(30), "Spilled");
      expect(log.reheat(HOT_ITEM, 85, at(40), VOLUNTEER).outcome).toBe("REFUSED_ALREADY_DISCARDED");
    });

    test("a refused reheat leaves no reading behind", () => {
      read(HOT_ITEM, 45, 0);
      const before = log.readingsForItem(HOT_ITEM).length;
      log.reheat(HOT_ITEM, 50, at(60), VOLUNTEER);
      expect(log.readingsForItem(HOT_ITEM)).toHaveLength(before);
    });

    test("a reheat records its carried exposure in the action note", () => {
      read(HOT_ITEM, 45, 0);
      log.reheat(HOT_ITEM, 78, at(60), VOLUNTEER);
      const action = log.actionsForItem(HOT_ITEM).find((entry) => entry.type === "REHEATED");
      expect(action?.note).toMatch(/60 minutes of exposure carried forward/);
    });

    test("a reheat keeps the whole accrued stretch instead of interpolating it away", () => {
      // A straight line from 45 at minute 0 to 78 at minute 33 would cross 60
      // fifteen minutes in and hand back more than half the exposure, on the
      // false premise that the tray climbed steadily all half hour. It sat at
      // 45 until somebody turned a burner on.
      read(HOT_ITEM, 45, 0);
      log.reheat(HOT_ITEM, 78, at(33), VOLUNTEER);
      expect(log.assess(HOT_ITEM, at(33)).cumulativeExposureMinutes).toBe(33);
      // And nothing further accrues while it is held above temperature.
      expect(log.assess(HOT_ITEM, at(40)).cumulativeExposureMinutes).toBe(33);
    });
  });

  describe("readings and corrective actions", () => {
    test("an out of order reading is refused", () => {
      read(HOT_ITEM, 50, 60);
      expect(() => read(HOT_ITEM, 55, 30)).toThrow(/must be recorded in order/i);
    });

    test("a reading at the same instant as the previous one is allowed", () => {
      read(HOT_ITEM, 50, 60);
      expect(() => read(HOT_ITEM, 52, 60)).not.toThrow();
    });

    test("a reading before the dish was prepared is refused", () => {
      expect(() => read(HOT_ITEM, 50, -10)).toThrow(/predates the dish/i);
    });

    test("a reading on a discarded dish is refused", () => {
      log.discard(HOT_ITEM, at(30), "Dropped");
      expect(() => read(HOT_ITEM, 50, 40)).toThrow(/no longer being tracked/i);
    });

    test("a non-numeric reading is refused", () => {
      expect(() => read(HOT_ITEM, Number.NaN, 10)).toThrow(/real temperature/i);
    });

    test("moving a dish to refrigeration is recorded", () => {
      log.recordCorrectiveAction({
        itemId: COLD_ITEM,
        type: "ICE_BATH",
        occurredAt: at(45),
        note: "Ice bath under the tray",
      });
      expect(log.assess(COLD_ITEM, at(45)).state).toBe("IN_REFRIGERATION");
    });

    test("discarding twice is refused", () => {
      log.discard(HOT_ITEM, at(30), "Past limit");
      expect(() => log.discard(HOT_ITEM, at(40), "again")).toThrow(/already discarded/i);
    });
  });

  describe("the hourly sweep across an event", () => {
    test("every dish at the event is assessed, worst first", () => {
      read(HOT_ITEM, 50, 0);
      read(COLD_ITEM, 2, 0);
      log.registerItem(hotItem({ itemId: "item-rice", name: "Pilau rice" }));
      read("item-rice", 40, 90);

      const sweep = log.assessEvent(EVENT, at(180));
      expect(sweep.map((entry) => entry.itemId)).toEqual([HOT_ITEM, "item-rice", COLD_ITEM]);
      expect(sweep[0].cumulativeExposureMinutes).toBe(180);
      expect(sweep[1].cumulativeExposureMinutes).toBe(90);
      expect(sweep[2].cumulativeExposureMinutes).toBe(0);
    });

    test("the sweep does not reach into another event", () => {
      log.registerItem(hotItem({ itemId: "item-soup", eventId: "event-other", name: "Soup" }));
      read("item-soup", 40, 0);
      expect(log.assessEvent(EVENT, at(60)).map((entry) => entry.itemId)).not.toContain(
        "item-soup",
      );
    });

    test("the sweep surfaces the discard before the warning", () => {
      read(HOT_ITEM, 50, 0);
      read(COLD_ITEM, 10, 120);
      const sweep = log.assessEvent(EVENT, at(CUMULATIVE_LIMIT_MINUTES));
      expect(sweep[0].decision).toBe("DISCARD");
      expect(sweep[1].decision).toBe("WARN_APPROACHING_LIMIT");
    });
  });
});
