/**
 * Module: Out-of-Hours Venue Energy Recharge
 * File: src/services/outOfHoursEnergyRechargeService.ts
 * Scope: Prices the plant window rather than the booking window, apportions the
 *        shared part by occupancy, and quotes at booking time (#4706).
 *
 * The recharge currently arrives as a line on the club's account four months
 * later reading EST-OOH RECHARGE 148.50, by which point the committee that
 * incurred it has graduated. A treasurer cannot decline a cost they will not
 * see until March.
 *
 * Two things make quoting it non-trivial and both make the naive version wrong
 * in a specific direction.
 *
 * The plant runs before the booking starts. A hall booked from nine to ten at
 * night does not become usable at nine by magic; the plant fires up an hour and
 * a half earlier to bring the space to temperature. A charge computed from the
 * booking window undercharges every single time.
 *
 * The cost is shared, not duplicated. Two clubs in one building on overlapping
 * evenings make the plant run once. Charging each of them the full cost bills
 * the university twice for one unit of gas. So the overlap is apportioned — and
 * not evenly, because the club whose lead-in fired the plant carries the
 * startup while the marginal running cost is genuinely shared.
 *
 * Money is integer cents and the apportionments sum to exactly the plant cost.
 * A recharge that does not reconcile to the estates invoice is a recharge that
 * gets disputed and written off.
 *
 * All instants are handled in UTC. Core hours are minutes from midnight UTC.
 */

export type PlantMode = "HEATING" | "COOLING" | "NONE";

export type QuoteOutcome = "QUOTED" | "UNSERVICEABLE" | "NO_PLANT_REQUIRED";

export interface BuildingEnergyProfile {
  buildingId: string;
  /** Minutes from midnight. Inside these the space is already conditioned. */
  coreStartMinute: number;
  coreEndMinute: number;
  /** How long the plant runs before a booking to reach temperature. */
  leadInMinutes: number;
  heatingPlantKw: number;
  coolingPlantKw: number;
  /** Energy to bring the plant up from cold. Once per plant run. */
  startupKwh: number;
  /** The plant cannot be run for twenty minutes. */
  minimumBlockMinutes: number;
  /** Levied once per plant run, alongside the startup. */
  standingChargeCents: number;
  ratePerKwhCents: number;
}

export interface DegreeDayObservation {
  /** YYYY-MM-DD, UTC. */
  date: string;
  heatingDegreeDays: number;
  coolingDegreeDays: number;
}

export interface RoomBooking {
  bookingId: string;
  buildingId: string;
  roomId: string;
  clubId: string;
  from: Date;
  to: Date;
}

export interface Interval {
  from: Date;
  to: Date;
}

export interface EnergyQuote {
  bookingId: string;
  outcome: QuoteOutcome;
  mode: PlantMode;
  plantFrom: Date | null;
  plantTo: Date | null;
  /** Minutes the plant runs outside core hours. What is actually billed. */
  chargeableMinutes: number;
  /** Of the plant window, what fell inside core hours and cost nothing. */
  coreHoursMinutes: number;
  /** Added purely to reach the minimum billable block. */
  minimumBlockPaddingMinutes: number;
  startupKwh: number;
  runningKwh: number;
  /** What this booking would cost the university on its own. */
  standaloneCents: number;
  /** Past this instant the plant is committed and cancelling saves nothing. */
  commitAt: Date | null;
}

export interface Apportionment {
  bookingId: string;
  clubId: string;
  /** The startup and standing charge, carried by whoever fired the plant. */
  startupCents: number;
  /** Marginal running cost, shared with whoever else was in the building. */
  runningCents: number;
  totalCents: number;
  /** Minutes of the run this booking occupied, after sharing. */
  weightedMinutes: number;
  triggeredPlant: boolean;
}

export interface PlantRun {
  buildingId: string;
  mode: PlantMode;
  from: Date;
  to: Date;
  runningMinutes: number;
  startupCents: number;
  runningCents: number;
  /** Startup plus standing plus running. The estates invoice line. */
  plantCostCents: number;
  apportionments: Apportionment[];
}

export interface CancellationAssessment {
  bookingId: string;
  charged: boolean;
  reason: string;
  commitAt: Date | null;
}

const MINUTE = 60_000;
const DAY_MINUTES = 1_440;

function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MINUTE);
}

function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE);
}

function startOfUtcDay(instant: Date): Date {
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
}

function utcDateKey(instant: Date): string {
  return startOfUtcDay(instant).toISOString().slice(0, 10);
}

/**
 * Splits a whole into integer parts by weight so that the parts sum to exactly
 * the whole.
 *
 * The remainder goes to the largest fractional parts, ties broken by position.
 * Rounding each share independently loses pennies, and a recharge that does not
 * reconcile to the estates invoice is a recharge that gets written off.
 */
export function allocateByLargestRemainder(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((running, weight) => running + weight, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (totalCents * weight) / sum);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = totalCents - floors.reduce((running, value) => running + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const result = [...floors];
  for (const entry of order) {
    if (remainder <= 0) break;
    result[entry.index] += 1;
    remainder -= 1;
  }

  return result;
}

export class OutOfHoursEnergyRechargeService {
  private readonly profiles: Map<string, BuildingEnergyProfile>;
  private readonly degreeDays: Map<string, DegreeDayObservation>;
  private readonly bookings: Map<string, RoomBooking>;

  constructor() {
    this.profiles = new Map();
    this.degreeDays = new Map();
    this.bookings = new Map();
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  public registerProfile(profile: BuildingEnergyProfile): void {
    if (this.profiles.has(profile.buildingId)) {
      throw new Error(`Building ${profile.buildingId} already has an energy profile.`);
    }
    if (profile.coreStartMinute >= profile.coreEndMinute) {
      throw new Error(`Core hours for ${profile.buildingId} end before they begin.`);
    }
    if (profile.coreEndMinute > DAY_MINUTES) {
      throw new Error(`Core hours for ${profile.buildingId} run past midnight.`);
    }
    if (profile.leadInMinutes < 0 || profile.minimumBlockMinutes < 0) {
      throw new Error(`Building ${profile.buildingId} carries a negative interval.`);
    }
    this.profiles.set(profile.buildingId, { ...profile });
  }

  public recordDegreeDays(observation: DegreeDayObservation): void {
    if (observation.heatingDegreeDays < 0 || observation.coolingDegreeDays < 0) {
      throw new Error(`Degree days for ${observation.date} are negative.`);
    }
    this.degreeDays.set(observation.date, { ...observation });
  }

  public recordBooking(booking: RoomBooking): void {
    if (!this.profiles.has(booking.buildingId)) {
      throw new Error(`Unknown building ${booking.buildingId}.`);
    }
    if (booking.to.getTime() <= booking.from.getTime()) {
      throw new Error(`Booking ${booking.bookingId} ends before it starts.`);
    }
    this.bookings.set(booking.bookingId, { ...booking });
  }

  // ---------------------------------------------------------------------------
  // Weather
  // ---------------------------------------------------------------------------

  /**
   * Which way the plant ran, from the weather rather than from the season.
   *
   * A flat rate per hour charges for heating in a heatwave. An unobserved date
   * throws rather than returning NONE: a missing observation and a genuinely
   * mild evening both produce no charge, and only one of them should.
   */
  public plantMode(buildingId: string, on: Date): PlantMode {
    const key = utcDateKey(on);
    const observation = this.degreeDays.get(key);
    if (!observation) {
      throw new Error(`No degree-day observation for ${key}; the recharge cannot be quoted.`);
    }

    if (observation.heatingDegreeDays === 0 && observation.coolingDegreeDays === 0) return "NONE";
    return observation.heatingDegreeDays >= observation.coolingDegreeDays ? "HEATING" : "COOLING";
  }

  // ---------------------------------------------------------------------------
  // The plant window
  // ---------------------------------------------------------------------------

  /**
   * The parts of a window that fall outside core hours.
   *
   * Inside core hours the space is already being conditioned for everybody
   * else, and charging a club for it would bill the same gas twice. Pieces
   * either side of midnight are merged so an overnight window is one interval.
   */
  public chargeableIntervals(from: Date, to: Date, profile: BuildingEnergyProfile): Interval[] {
    const pieces: Interval[] = [];
    let cursor = from;

    while (cursor.getTime() < to.getTime()) {
      const dayStart = startOfUtcDay(cursor);
      const dayEnd = addMinutes(dayStart, DAY_MINUTES);
      const segmentEnd = new Date(Math.min(to.getTime(), dayEnd.getTime()));
      const coreStart = addMinutes(dayStart, profile.coreStartMinute);
      const coreEnd = addMinutes(dayStart, profile.coreEndMinute);

      const beforeCore = {
        from: cursor,
        to: new Date(Math.min(segmentEnd.getTime(), coreStart.getTime())),
      };
      if (beforeCore.to.getTime() > beforeCore.from.getTime()) pieces.push(beforeCore);

      const afterCore = {
        from: new Date(Math.max(cursor.getTime(), coreEnd.getTime())),
        to: segmentEnd,
      };
      if (afterCore.to.getTime() > afterCore.from.getTime()) pieces.push(afterCore);

      cursor = segmentEnd;
    }

    return this.merge(pieces);
  }

  /**
   * Quotes one booking on its own.
   *
   * The window runs from the lead-in, not from the booking, and is padded to
   * the minimum block. What comes back is what the booking costs the university
   * before anybody else in the building is taken into account.
   */
  public quote(bookingId: string, quotedAt: Date): EnergyQuote {
    const booking = this.requireBooking(bookingId);
    const profile = this.profiles.get(booking.buildingId)!;
    const mode = this.plantMode(booking.buildingId, booking.from);

    const empty: EnergyQuote = {
      bookingId,
      outcome: "NO_PLANT_REQUIRED",
      mode,
      plantFrom: null,
      plantTo: null,
      chargeableMinutes: 0,
      coreHoursMinutes: 0,
      minimumBlockPaddingMinutes: 0,
      startupKwh: 0,
      runningKwh: 0,
      standaloneCents: 0,
      commitAt: null,
    };

    if (mode === "NONE") return empty;

    // The plant has to be started before the booking begins. A booking made
    // inside that horizon cannot be serviced, and saying so at quote time is
    // better than a charge for a room that will be cold.
    const plantFrom = addMinutes(booking.from, -profile.leadInMinutes);
    if (plantFrom.getTime() < quotedAt.getTime()) {
      return { ...empty, outcome: "UNSERVICEABLE", commitAt: plantFrom };
    }

    let intervals = this.chargeableIntervals(plantFrom, booking.to, profile);
    let chargeableMinutes = this.totalMinutes(intervals);

    if (chargeableMinutes === 0) return { ...empty, commitAt: plantFrom };

    let padding = 0;
    if (chargeableMinutes < profile.minimumBlockMinutes) {
      padding = profile.minimumBlockMinutes - chargeableMinutes;
      const last = intervals[intervals.length - 1];
      intervals = [
        ...intervals.slice(0, -1),
        { from: last.from, to: addMinutes(last.to, padding) },
      ];
      chargeableMinutes = profile.minimumBlockMinutes;
    }

    const plantKw = mode === "HEATING" ? profile.heatingPlantKw : profile.coolingPlantKw;
    const runningKwh = (plantKw * chargeableMinutes) / 60;
    const startupCents = Math.round(profile.startupKwh * profile.ratePerKwhCents);
    const runningCents = Math.round(runningKwh * profile.ratePerKwhCents);

    return {
      bookingId,
      outcome: "QUOTED",
      mode,
      plantFrom,
      plantTo: intervals[intervals.length - 1].to,
      chargeableMinutes,
      coreHoursMinutes: minutesBetween(plantFrom, booking.to) - (chargeableMinutes - padding),
      minimumBlockPaddingMinutes: padding,
      startupKwh: profile.startupKwh,
      runningKwh,
      standaloneCents: startupCents + profile.standingChargeCents + runningCents,
      commitAt: plantFrom,
    };
  }

  // ---------------------------------------------------------------------------
  // Apportionment
  // ---------------------------------------------------------------------------

  /**
   * The plant runs for a building, and who pays for it.
   *
   * Overlapping bookings do not each cause a plant run; they cause one. The
   * startup and the standing charge go to whoever fired it, and every minute of
   * running is split between whoever was in the building for that minute.
   */
  public plantRuns(buildingId: string, date: string, quotedAt: Date): PlantRun[] {
    const profile = this.profiles.get(buildingId);
    if (!profile) throw new Error(`Unknown building ${buildingId}.`);

    const quotes = [...this.bookings.values()]
      .filter((booking) => booking.buildingId === buildingId)
      .filter((booking) => utcDateKey(booking.from) === date)
      .map((booking) => ({ booking, quote: this.quote(booking.bookingId, quotedAt) }))
      .filter((entry) => entry.quote.outcome === "QUOTED")
      .sort(
        (a, b) =>
          a.quote.plantFrom!.getTime() - b.quote.plantFrom!.getTime() ||
          a.booking.bookingId.localeCompare(b.booking.bookingId),
      );

    if (quotes.length === 0) return [];

    const mode = quotes[0].quote.mode;
    const plantKw = mode === "HEATING" ? profile.heatingPlantKw : profile.coolingPlantKw;

    const spans = quotes.map((entry) => ({
      bookingId: entry.booking.bookingId,
      clubId: entry.booking.clubId,
      from:
        this.chargeableIntervals(entry.quote.plantFrom!, entry.quote.plantTo!, profile)[0]?.from ??
        entry.quote.plantFrom!,
      to: entry.quote.plantTo!,
    }));

    const runs: PlantRun[] = [];
    let group: typeof spans = [];

    for (const span of spans) {
      if (group.length === 0) {
        group = [span];
        continue;
      }
      const groupEnd = Math.max(...group.map((entry) => entry.to.getTime()));
      if (span.from.getTime() <= groupEnd) {
        group.push(span);
      } else {
        runs.push(this.buildRun(buildingId, mode, plantKw, profile, group));
        group = [span];
      }
    }
    if (group.length > 0) runs.push(this.buildRun(buildingId, mode, plantKw, profile, group));

    return runs;
  }

  /**
   * What one booking is actually recharged, after everybody else in the
   * building is taken into account.
   */
  public rechargeFor(bookingId: string, quotedAt: Date): Apportionment | null {
    const booking = this.requireBooking(bookingId);
    const runs = this.plantRuns(booking.buildingId, utcDateKey(booking.from), quotedAt);

    for (const run of runs) {
      const found = run.apportionments.find((entry) => entry.bookingId === bookingId);
      if (found) return found;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Cancellation
  // ---------------------------------------------------------------------------

  /**
   * Whether cancelling still saves the charge.
   *
   * Past the lead-in horizon the plant is committed. Cancelling then does not
   * un-burn the gas, and a policy that pretends otherwise moves the cost onto
   * the estate rather than removing it.
   */
  public assessCancellation(bookingId: string, cancelledAt: Date): CancellationAssessment {
    const booking = this.requireBooking(bookingId);
    const profile = this.profiles.get(booking.buildingId)!;
    const commitAt = addMinutes(booking.from, -profile.leadInMinutes);

    if (cancelledAt.getTime() < commitAt.getTime()) {
      return {
        bookingId,
        charged: false,
        reason: "Cancelled before the plant was committed",
        commitAt,
      };
    }

    return {
      bookingId,
      charged: true,
      reason: "Cancelled after the plant was committed; the gas was burned",
      commitAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private buildRun(
    buildingId: string,
    mode: PlantMode,
    plantKw: number,
    profile: BuildingEnergyProfile,
    group: { bookingId: string; clubId: string; from: Date; to: Date }[],
  ): PlantRun {
    const from = new Date(Math.min(...group.map((entry) => entry.from.getTime())));
    const to = new Date(Math.max(...group.map((entry) => entry.to.getTime())));
    const runningMinutes = minutesBetween(from, to);

    const startupCents =
      Math.round(profile.startupKwh * profile.ratePerKwhCents) + profile.standingChargeCents;
    const runningCents = Math.round(((plantKw * runningMinutes) / 60) * profile.ratePerKwhCents);

    // Sweep the boundaries into segments, each with the bookings occupying it.
    const boundaries = [
      ...new Set(group.flatMap((entry) => [entry.from.getTime(), entry.to.getTime()])),
    ].sort((a, b) => a - b);

    const segments: { minutes: number; occupantIds: string[] }[] = [];
    const weights = new Map<string, number>(group.map((entry) => [entry.bookingId, 0]));

    for (let index = 1; index < boundaries.length; index += 1) {
      const segmentFrom = boundaries[index - 1];
      const segmentTo = boundaries[index];
      const minutes = (segmentTo - segmentFrom) / MINUTE;

      const occupants = group.filter(
        (entry) => entry.from.getTime() <= segmentFrom && entry.to.getTime() >= segmentTo,
      );
      if (occupants.length === 0) continue;

      segments.push({ minutes, occupantIds: occupants.map((entry) => entry.bookingId) });
      for (const occupant of occupants) {
        weights.set(
          occupant.bookingId,
          weights.get(occupant.bookingId)! + minutes / occupants.length,
        );
      }
    }

    const ordered = group.map((entry) => entry.bookingId);

    // Split in two integer stages: the run cost across the segments by length,
    // then each segment's cost equally between whoever was there.
    //
    // Deliberately not one pass over fractional weights. Those weights carry
    // thirds and sixths, and comparing their rounding errors is what decides
    // where a spare penny lands — which makes the invoice depend on float
    // noise rather than on who was in the building.
    const running = new Map<string, number>(ordered.map((bookingId) => [bookingId, 0]));

    if (segments.length === 0) {
      running.set(ordered[0], runningCents);
    } else {
      const perSegment = allocateByLargestRemainder(
        runningCents,
        segments.map((segment) => segment.minutes),
      );

      segments.forEach((segment, index) => {
        const shares = allocateByLargestRemainder(
          perSegment[index],
          segment.occupantIds.map(() => 1),
        );
        segment.occupantIds.forEach((bookingId, position) => {
          running.set(bookingId, running.get(bookingId)! + shares[position]);
        });
      });
    }

    // Whoever's lead-in fired the plant carries the startup. Ties go to the
    // earlier booking id so the same run always bills the same club.
    const triggerId = ordered[0];

    const apportionments: Apportionment[] = group.map((entry) => {
      const isTrigger = entry.bookingId === triggerId;
      const startup = isTrigger ? startupCents : 0;
      const share = running.get(entry.bookingId)!;
      return {
        bookingId: entry.bookingId,
        clubId: entry.clubId,
        startupCents: startup,
        runningCents: share,
        totalCents: startup + share,
        weightedMinutes: Math.round(weights.get(entry.bookingId)! * 100) / 100,
        triggeredPlant: isTrigger,
      };
    });

    return {
      buildingId,
      mode,
      from,
      to,
      runningMinutes,
      startupCents,
      runningCents,
      plantCostCents: startupCents + runningCents,
      apportionments,
    };
  }

  private merge(intervals: Interval[]): Interval[] {
    if (intervals.length === 0) return [];

    const sorted = [...intervals].sort((a, b) => a.from.getTime() - b.from.getTime());
    const merged: Interval[] = [sorted[0]];

    for (const interval of sorted.slice(1)) {
      const last = merged[merged.length - 1];
      if (interval.from.getTime() <= last.to.getTime()) {
        merged[merged.length - 1] = {
          from: last.from,
          to: new Date(Math.max(last.to.getTime(), interval.to.getTime())),
        };
      } else {
        merged.push(interval);
      }
    }

    return merged;
  }

  private totalMinutes(intervals: Interval[]): number {
    return intervals.reduce((sum, interval) => sum + minutesBetween(interval.from, interval.to), 0);
  }

  private requireBooking(bookingId: string): RoomBooking {
    const booking = this.bookings.get(bookingId);
    if (!booking) throw new Error(`Unknown booking ${bookingId}.`);
    return booking;
  }
}
