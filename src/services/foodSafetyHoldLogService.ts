/**
 * Module: Catered Event Food Safety Time & Temperature Hold Log
 * File: src/services/foodSafetyHoldLogService.ts
 * Scope: Tracks cumulative time each dish spends in the temperature danger
 *        zone across a whole service, warns before the limit, and produces a
 *        discard decision when it is crossed (#4554).
 *
 * Health code counts cumulative exposure across the entire service, not the
 * length of any one continuous stretch. That distinction is where a clipboard
 * gets it wrong, and it gets it wrong in a predictable direction. Food that
 * went out at 11:00, went back to the fridge at 12:00 and returned at 14:00 has
 * accrued exposure in both stretches — but a paper log with a "returned to
 * fridge 12:00" line reads to whoever picks it up as though the clock reset. It
 * did not, and the volunteer at 14:00 has no way to know the tray is already an
 * hour into its budget.
 *
 * Three decisions shape everything below.
 *
 * Exposure between two readings is interpolated, not rounded. A tray read at
 * 3°C and then at 9°C half an hour later did not spend the whole half hour in
 * the zone, nor none of it. Finding the crossing instant is the entire point of
 * having readings rather than a checkbox.
 *
 * Hot and cold items are evaluated against different thresholds. A single
 * shared band would make "in the zone" mean two different things depending on
 * which end of it a dish is supposed to sit at.
 *
 * Every assessment takes an explicit instant and is a pure function of the
 * readings recorded on or before it, so "was this tray servable at 13:40?" has
 * a reproducible answer during an inspection three weeks later.
 */

export type HoldingType = "HOT" | "COLD";

export type ItemState = "IN_SERVICE" | "IN_REFRIGERATION" | "DISCARDED";

export type HoldDecision = "SERVABLE" | "WARN_APPROACHING_LIMIT" | "DISCARD";

export type CorrectiveActionType = "MOVED_TO_REFRIGERATION" | "ICE_BATH" | "REHEATED" | "DISCARDED";

export type ReheatOutcome =
  | "RETURNED_TO_SERVICE"
  | "REFUSED_COLD_ITEM"
  | "REFUSED_BELOW_REHEAT_TEMPERATURE"
  | "REFUSED_REHEAT_ALLOWANCE_SPENT"
  | "REFUSED_ALREADY_DISCARDED"
  | "REFUSED_PAST_CUMULATIVE_LIMIT";

/**
 * A cold-held dish is out of the zone at or below this; above it, exposure
 * accrues. Above 60°C it would no longer be a cold-held dish, and a potato
 * salad that hot has a problem this module is not the right place to describe.
 */
export const COLD_HOLD_MAX_CELSIUS = 5;

/** A hot-held dish is out of the zone at or above this. */
export const HOT_HOLD_MIN_CELSIUS = 60;

/** Cumulative exposure past this is a discard, with no discretion. */
export const CUMULATIVE_LIMIT_MINUTES = 240;

/** Raised early enough that there is still time to act on it. */
export const WARNING_THRESHOLD_MINUTES = 120;

/** A reheat must reach this throughout before the dish may go back out. */
export const REHEAT_MIN_CELSIUS = 74;

/** Hot-held TCS food gets one reheat. The second is a discard. */
export const MAX_REHEATS = 1;

const MS_PER_MINUTE = 60_000;

export interface FoodItem {
  itemId: string;
  eventId: string;
  name: string;
  holdingType: HoldingType;
  /** Exposure is only ever measured between readings, never from this. */
  preparedAt: Date;
}

export interface TemperatureReading {
  itemId: string;
  celsius: number;
  takenAt: Date;
  takenByUserId: string;
}

export interface CorrectiveAction {
  itemId: string;
  type: CorrectiveActionType;
  occurredAt: Date;
  note: string;
}

export interface HoldAssessment {
  itemId: string;
  assessedAt: Date;
  holdingType: HoldingType;
  /** Cumulative across the whole service. A gap in the fridge pauses it. */
  cumulativeExposureMinutes: number;
  remainingMinutes: number;
  /**
   * The share of the exposure above that came from carrying the last reading
   * forward to the assessment instant rather than from a measured interval.
   * Surfaced so a large number here reads as "go and take a reading" rather
   * than as measured fact.
   */
  carriedForwardMinutes: number;
  decision: HoldDecision;
  inDangerZoneNow: boolean;
  lastReadingAt: Date | null;
  lastReadingCelsius: number | null;
  reheatsUsed: number;
  state: ItemState;
}

interface TrackedItem extends FoodItem {
  state: ItemState;
  reheatsUsed: number;
  discardedAt: Date | null;
}

export class FoodSafetyHoldLogService {
  private readonly items: Map<string, TrackedItem>;
  private readonly readings: Map<string, TemperatureReading[]>;
  private readonly actions: Map<string, CorrectiveAction[]>;

  constructor() {
    this.items = new Map();
    this.readings = new Map();
    this.actions = new Map();
  }

  // ---------------------------------------------------------------------------
  // Registration and readings
  // ---------------------------------------------------------------------------

  public registerItem(item: FoodItem): void {
    if (this.items.has(item.itemId)) {
      throw new Error(`Food item ${item.itemId} is already on the log.`);
    }
    if (item.name.trim().length === 0) {
      throw new Error(`Food item ${item.itemId} needs a name a volunteer can match to a tray.`);
    }
    this.items.set(item.itemId, {
      ...item,
      state: "IN_SERVICE",
      reheatsUsed: 0,
      discardedAt: null,
    });
    this.readings.set(item.itemId, []);
    this.actions.set(item.itemId, []);
  }

  /**
   * Readings must arrive in order.
   *
   * Interpolating between two readings assumes the temperature moved
   * monotonically from one to the other over the interval between them. Insert
   * a reading into the middle of that interval after the fact and the
   * assumption no longer describes anything — the honest response is to refuse
   * the write rather than to silently re-derive an exposure figure somebody has
   * already acted on.
   */
  public recordReading(reading: TemperatureReading): void {
    const item = this.requireItem(reading.itemId);

    if (item.state === "DISCARDED") {
      throw new Error(`${item.name} was discarded and is no longer being tracked.`);
    }
    if (!Number.isFinite(reading.celsius)) {
      throw new Error(`Reading for ${item.name} must be a real temperature.`);
    }
    if (reading.takenAt.getTime() < item.preparedAt.getTime()) {
      throw new Error(`Reading for ${item.name} predates the dish being prepared.`);
    }

    const log = this.readingsFor(reading.itemId);
    const previous = log[log.length - 1];
    if (previous && reading.takenAt.getTime() < previous.takenAt.getTime()) {
      throw new Error(
        `Readings for ${item.name} must be recorded in order; ` +
          `this one predates the reading at ${previous.takenAt.toISOString()}.`,
      );
    }

    // A reading observes the dish; it does not move it. Only a corrective
    // action changes where the tray is, so only a corrective action changes
    // state.
    log.push({ ...reading });
  }

  public recordCorrectiveAction(action: CorrectiveAction): void {
    const item = this.requireItem(action.itemId);
    if (item.state === "DISCARDED") {
      throw new Error(`${item.name} was already discarded.`);
    }
    this.actionsFor(action.itemId).push({ ...action });

    if (action.type === "MOVED_TO_REFRIGERATION" || action.type === "ICE_BATH") {
      item.state = "IN_REFRIGERATION";
    }
    if (action.type === "DISCARDED") {
      item.state = "DISCARDED";
      item.discardedAt = action.occurredAt;
    }
  }

  public discard(itemId: string, at: Date, reason: string): void {
    this.recordCorrectiveAction({ itemId, type: "DISCARDED", occurredAt: at, note: reason });
  }

  // ---------------------------------------------------------------------------
  // Reheating
  // ---------------------------------------------------------------------------

  /**
   * A hot-held dish that fell out of temperature may be brought back once.
   *
   * What it does not do is reset the clock. The accrued exposure carries
   * forward, because reheating kills what grew in the zone but does nothing
   * about the toxins some of it left behind — which is exactly why the
   * cumulative limit exists alongside the temperature rule rather than being
   * replaced by it.
   *
   * The allowance is one. A dish that has fallen out of temperature twice in a
   * service is being held somewhere that cannot hold it, and a second reheat
   * treats a room problem as a tray problem.
   */
  public reheat(
    itemId: string,
    celsius: number,
    at: Date,
    byUserId: string,
  ): { outcome: ReheatOutcome; cumulativeExposureMinutes: number } {
    const item = this.requireItem(itemId);
    const assessment = this.assess(itemId, at);

    if (item.state === "DISCARDED") {
      return {
        outcome: "REFUSED_ALREADY_DISCARDED",
        cumulativeExposureMinutes: assessment.cumulativeExposureMinutes,
      };
    }
    if (item.holdingType === "COLD") {
      // Cooling a cold dish back down is a corrective action, not a reheat, and
      // calling it one would spend an allowance that does not apply to it.
      return {
        outcome: "REFUSED_COLD_ITEM",
        cumulativeExposureMinutes: assessment.cumulativeExposureMinutes,
      };
    }
    if (item.reheatsUsed >= MAX_REHEATS) {
      return {
        outcome: "REFUSED_REHEAT_ALLOWANCE_SPENT",
        cumulativeExposureMinutes: assessment.cumulativeExposureMinutes,
      };
    }
    if (celsius < REHEAT_MIN_CELSIUS) {
      return {
        outcome: "REFUSED_BELOW_REHEAT_TEMPERATURE",
        cumulativeExposureMinutes: assessment.cumulativeExposureMinutes,
      };
    }
    if (assessment.decision === "DISCARD") {
      // Past the cumulative limit the temperature is no longer the question.
      return {
        outcome: "REFUSED_PAST_CUMULATIVE_LIMIT",
        cumulativeExposureMinutes: assessment.cumulativeExposureMinutes,
      };
    }

    // A reheat is an intervention at a known instant, not an observation of a
    // dish that has been quietly warming since the last reading. Interpolating
    // straight from 45°C an hour ago to 78°C now would model the tray as having
    // climbed steadily all hour and would hand back most of the accrued
    // exposure — in the unsafe direction, for a dish that in fact sat at 45°C
    // until somebody turned a burner on.
    //
    // So the last known temperature is pinned forward to the reheat instant
    // first, and the post-reheat reading is recorded at that same instant. The
    // interval between the two is zero, so the reheat itself accrues nothing
    // and everything before it is kept.
    const previous = this.readingsFor(itemId).at(-1);
    if (previous) {
      this.recordReading({
        itemId,
        celsius: previous.celsius,
        takenAt: at,
        takenByUserId: byUserId,
      });
    }
    this.recordReading({ itemId, celsius, takenAt: at, takenByUserId: byUserId });
    this.actionsFor(itemId).push({
      itemId,
      type: "REHEATED",
      occurredAt: at,
      note: `Reheated to ${celsius}°C; ${assessment.cumulativeExposureMinutes} minutes of exposure carried forward`,
    });
    item.reheatsUsed += 1;
    item.state = "IN_SERVICE";

    return {
      outcome: "RETURNED_TO_SERVICE",
      cumulativeExposureMinutes: assessment.cumulativeExposureMinutes,
    };
  }

  // ---------------------------------------------------------------------------
  // Assessment
  // ---------------------------------------------------------------------------

  /**
   * The state of one dish at a given instant.
   *
   * Exposure after the last reading is carried forward at that reading's
   * temperature rather than assumed away. An untouched tray last read at 45°C
   * two hours ago has been in the zone for two hours, and a log that reports
   * zero for that stretch because nobody wrote anything down is worse than no
   * log at all. The carried portion is reported separately so it reads as
   * "somebody needs to take a reading" rather than as measured fact.
   */
  public assess(itemId: string, assessedAt: Date): HoldAssessment {
    const item = this.requireItem(itemId);
    const cutoff = assessedAt.getTime();
    const log = this.readingsFor(itemId).filter((reading) => reading.takenAt.getTime() <= cutoff);

    let exposureMs = 0;
    for (let index = 1; index < log.length; index += 1) {
      exposureMs += this.exposureBetween(item.holdingType, log[index - 1], log[index]);
    }

    const last = log[log.length - 1] ?? null;
    let carriedMs = 0;
    if (last && this.inDangerZone(item.holdingType, last.celsius)) {
      const horizon = item.discardedAt ? Math.min(cutoff, item.discardedAt.getTime()) : cutoff;
      carriedMs = Math.max(0, horizon - last.takenAt.getTime());
    }

    const totalMs = exposureMs + carriedMs;
    const cumulativeExposureMinutes = this.toMinutes(totalMs);
    const inDangerZoneNow = last !== null && this.inDangerZone(item.holdingType, last.celsius);

    let decision: HoldDecision;
    if (item.state === "DISCARDED" || totalMs >= CUMULATIVE_LIMIT_MINUTES * MS_PER_MINUTE) {
      decision = "DISCARD";
    } else if (totalMs >= WARNING_THRESHOLD_MINUTES * MS_PER_MINUTE) {
      decision = "WARN_APPROACHING_LIMIT";
    } else {
      decision = "SERVABLE";
    }

    return {
      itemId,
      assessedAt,
      holdingType: item.holdingType,
      cumulativeExposureMinutes,
      remainingMinutes: Math.max(
        0,
        this.toMinutes(CUMULATIVE_LIMIT_MINUTES * MS_PER_MINUTE - totalMs),
      ),
      carriedForwardMinutes: this.toMinutes(carriedMs),
      decision,
      inDangerZoneNow,
      lastReadingAt: last ? last.takenAt : null,
      lastReadingCelsius: last ? last.celsius : null,
      reheatsUsed: item.reheatsUsed,
      state: item.state,
    };
  }

  /** Every dish at one event, worst first, for the sweep a lead does hourly. */
  public assessEvent(eventId: string, assessedAt: Date): HoldAssessment[] {
    return [...this.items.values()]
      .filter((item) => item.eventId === eventId)
      .map((item) => this.assess(item.itemId, assessedAt))
      .sort((a, b) => b.cumulativeExposureMinutes - a.cumulativeExposureMinutes);
  }

  public actionsForItem(itemId: string): readonly CorrectiveAction[] {
    return this.actionsFor(itemId);
  }

  public readingsForItem(itemId: string): readonly TemperatureReading[] {
    return this.readingsFor(itemId);
  }

  // ---------------------------------------------------------------------------
  // The interpolation
  // ---------------------------------------------------------------------------

  /**
   * Danger-zone milliseconds between two consecutive readings.
   *
   * Three cases, and the third is the one worth having readings for:
   *
   *   both in the zone   the whole interval counts
   *   both out           none of it counts
   *   a crossing         the temperature is taken to move linearly between the
   *                      two readings, the instant it crossed the threshold
   *                      falls out of that, and only the portion on the wrong
   *                      side is counted
   *
   * Rounding the third case to one of the first two is exactly the error a
   * clipboard makes, and it errs in whichever direction the volunteer guessed.
   */
  private exposureBetween(
    holdingType: HoldingType,
    from: TemperatureReading,
    to: TemperatureReading,
  ): number {
    const spanMs = to.takenAt.getTime() - from.takenAt.getTime();
    if (spanMs <= 0) return 0;

    const fromInZone = this.inDangerZone(holdingType, from.celsius);
    const toInZone = this.inDangerZone(holdingType, to.celsius);

    if (fromInZone && toInZone) return spanMs;
    if (!fromInZone && !toInZone) return 0;

    const threshold = this.threshold(holdingType);
    const delta = to.celsius - from.celsius;
    // A crossing implies the readings differ, so this cannot divide by zero.
    const fraction = (threshold - from.celsius) / delta;
    const crossingMs = spanMs * Math.min(1, Math.max(0, fraction));

    return fromInZone ? crossingMs : spanMs - crossingMs;
  }

  /**
   * One threshold per holding type rather than a shared band.
   *
   * A cold dish accrues above 5°C and a hot one below 60°C. Using the full
   * 5–60°C band for both would leave a hot dish at 3°C counted as safe, which
   * is true of the bacteria and false of everything else about a tray of curry
   * that has been sitting in a fridge for an hour and is about to go back out.
   * A single threshold per type is the conservative reading and it makes the
   * crossing instant unambiguous.
   */
  private threshold(holdingType: HoldingType): number {
    return holdingType === "COLD" ? COLD_HOLD_MAX_CELSIUS : HOT_HOLD_MIN_CELSIUS;
  }

  private inDangerZone(holdingType: HoldingType, celsius: number): boolean {
    return holdingType === "COLD"
      ? celsius > COLD_HOLD_MAX_CELSIUS
      : celsius < HOT_HOLD_MIN_CELSIUS;
  }

  private toMinutes(ms: number): number {
    // Rounded for reporting only; every comparison above is on exact
    // milliseconds, so a decision never turns on a rounded figure.
    return Math.round((ms / MS_PER_MINUTE) * 100) / 100;
  }

  private requireItem(itemId: string): TrackedItem {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Unknown food item ${itemId}.`);
    }
    return item;
  }

  private readingsFor(itemId: string): TemperatureReading[] {
    const log = this.readings.get(itemId);
    if (!log) throw new Error(`Unknown food item ${itemId}.`);
    return log;
  }

  private actionsFor(itemId: string): CorrectiveAction[] {
    const log = this.actions.get(itemId);
    if (!log) throw new Error(`Unknown food item ${itemId}.`);
    return log;
  }
}
