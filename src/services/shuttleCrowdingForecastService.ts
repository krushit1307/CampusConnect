/**
 * Module: Campus Shuttle Crowding Forecast & Surge Dispatch Engine
 * File: src/services/shuttleCrowdingForecastService.ts
 * Scope: Converts confirmed event RSVPs into a predicted boarding curve per shuttle
 *        stop, blends that prior with live boarding telemetry as the let-out
 *        approaches, and raises surge dispatch recommendations before a stop
 *        saturates rather than after a driver radios in (#4386).
 *
 * Design notes:
 *  - Every read is a pure function of an explicitly supplied evaluation time.
 *    Nothing in this module reads the wall clock, so a forecast is reproducible
 *    in tests and in a replay of a past let-out.
 *  - Boarding snapshots are aggregate counts only. No rider identifier ever
 *    enters this service; the attendee ids used for de-duplication come from the
 *    RSVP side and are never persisted to the snapshot store.
 */

/** How wide a forecast bucket is, in minutes. */
export const BUCKET_MINUTES = 10;

/** Default window over which a crowd disperses from a venue after let-out. */
export const DEFAULT_DISPERSAL_MINUTES = 20;

/** A stop is only worth forecasting this far either side of the peak. */
export const FORECAST_HORIZON_MINUTES = 60;

/** Minimum snapshots before observed telemetry is trusted at full weight. */
export const OBSERVED_SATURATION_SAMPLES = 3;

/** Repeat surge recommendations for one stop are suppressed for this long. */
export const RECOMMENDATION_COOLDOWN_MINUTES = 20;

export type SaturationClass = "NOMINAL" | "ELEVATED" | "SATURATED" | "OVERFLOW";

export interface ShuttleStop {
  /** Short operational code used by dispatch, e.g. 'STOP-NORTH-GATE'. */
  stopCode: string;
  name: string;
  /** Walking time in minutes from each venue id to this stop. */
  walkMinutesByVenue: Record<string, number>;
  /** Scheduled minutes between departures on the standing timetable. */
  scheduledHeadwayMinutes: number;
  /** Seats available on a single vehicle serving this stop. */
  seatsPerVehicle: number;
}

export interface EventLetOut {
  eventId: string;
  venueId: string;
  /** When the event ends and the crowd begins to disperse. */
  endsAt: Date;
  /**
   * Attendee ids with a confirmed RSVP. Ids are used only to de-duplicate a
   * student who confirmed two concurrent events; they are never stored.
   */
  confirmedAttendeeIds: string[];
  /**
   * Share of confirmed attendees expected to board a shuttle rather than walk
   * or drive. Defaults to the campus-wide mode share when omitted.
   */
  shuttleModeShare?: number;
  /** Overrides the default dispersal window for unusually staggered let-outs. */
  dispersalMinutes?: number;
}

export interface BoardingSnapshot {
  stopCode: string;
  observedAt: Date;
  /** Riders who boarded since the previous snapshot. Aggregate only. */
  observedBoardings: number;
  /** Riders still queueing at the moment of observation. Aggregate only. */
  observedQueueLength: number;
}

export interface DemandBucket {
  /** Inclusive start of the 10-minute bucket. */
  bucketStart: Date;
  /** Exclusive end of the 10-minute bucket. */
  bucketEnd: Date;
  /** Riders predicted to arrive at the stop within this bucket. */
  predictedArrivals: number;
  /** Seats the standing timetable supplies within this bucket. */
  seatSupply: number;
  /** predictedArrivals / seatSupply, rounded to three decimals. */
  saturationRatio: number;
  classification: SaturationClass;
  /** Riders in this bucket with no seat available. */
  unseatedRiders: number;
}

export interface SurgeRecommendation {
  stopCode: string;
  stopName: string;
  /** The worst bucket driving this recommendation. */
  peakBucketStart: Date;
  peakSaturationRatio: number;
  /** Total riders left without a seat across the saturated buckets. */
  unseatedRiders: number;
  /** Extra vehicles dispatch needs to clear the overflow. */
  extraVehiclesRequired: number;
  message: string;
  raisedAt: Date;
}

export interface StopForecast {
  stopCode: string;
  stopName: string;
  evaluatedAt: Date;
  buckets: DemandBucket[];
  /** 0 = pure RSVP prior, 1 = pure observed telemetry. */
  observedWeight: number;
  peakBucket: DemandBucket | null;
  recommendation: SurgeRecommendation | null;
  /** Set when a recommendation was withheld because the stop is in cooldown. */
  suppressedByCooldown: boolean;
}

interface ForecastOptions {
  /** Fallback share of attendees expected to take a shuttle. */
  defaultShuttleModeShare?: number;
  cooldownMinutes?: number;
}

const MS_PER_MINUTE = 60_000;

/** Saturation thresholds, ordered from most to least severe. */
const CLASSIFICATION_THRESHOLDS: Array<{ min: number; label: SaturationClass }> = [
  { min: 1.5, label: "OVERFLOW" },
  { min: 1.0, label: "SATURATED" },
  { min: 0.75, label: "ELEVATED" },
  { min: 0, label: "NOMINAL" },
];

export class ShuttleCrowdingForecastService {
  private readonly stops: Map<string, ShuttleStop>;
  private readonly letOuts: Map<string, EventLetOut>;
  private readonly snapshots: Map<string, BoardingSnapshot[]>;
  private readonly lastRecommendationAt: Map<string, Date>;
  private readonly defaultShuttleModeShare: number;
  private readonly cooldownMinutes: number;

  constructor(options: ForecastOptions = {}) {
    this.stops = new Map();
    this.letOuts = new Map();
    this.snapshots = new Map();
    this.lastRecommendationAt = new Map();
    this.defaultShuttleModeShare = options.defaultShuttleModeShare ?? 0.6;
    this.cooldownMinutes = options.cooldownMinutes ?? RECOMMENDATION_COOLDOWN_MINUTES;
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  public registerStop(stop: ShuttleStop): void {
    if (!stop.stopCode || !stop.stopCode.trim()) {
      throw new Error("A shuttle stop requires a non-empty stop code.");
    }
    if (stop.scheduledHeadwayMinutes <= 0) {
      throw new Error(`Stop ${stop.stopCode} must have a positive scheduled headway.`);
    }
    if (stop.seatsPerVehicle <= 0) {
      throw new Error(`Stop ${stop.stopCode} must seat at least one rider per vehicle.`);
    }
    this.stops.set(stop.stopCode, { ...stop, walkMinutesByVenue: { ...stop.walkMinutesByVenue } });
  }

  public getStop(stopCode: string): ShuttleStop | undefined {
    return this.stops.get(stopCode);
  }

  public listStops(): ShuttleStop[] {
    return Array.from(this.stops.values());
  }

  public registerLetOut(letOut: EventLetOut): void {
    if (!letOut.eventId) {
      throw new Error("A let-out requires an event id.");
    }
    const share = letOut.shuttleModeShare ?? this.defaultShuttleModeShare;
    if (share < 0 || share > 1) {
      throw new Error(`Shuttle mode share for ${letOut.eventId} must be between 0 and 1.`);
    }
    this.letOuts.set(letOut.eventId, {
      ...letOut,
      confirmedAttendeeIds: [...letOut.confirmedAttendeeIds],
    });
  }

  public recordBoardingSnapshot(snapshot: BoardingSnapshot): void {
    if (!this.stops.has(snapshot.stopCode)) {
      throw new Error(`Cannot record a snapshot for unknown stop '${snapshot.stopCode}'.`);
    }
    if (snapshot.observedBoardings < 0 || snapshot.observedQueueLength < 0) {
      throw new Error("Boarding snapshots cannot carry negative counts.");
    }
    const existing = this.snapshots.get(snapshot.stopCode) ?? [];
    existing.push({ ...snapshot });
    existing.sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
    this.snapshots.set(snapshot.stopCode, existing);
  }

  public getSnapshots(stopCode: string): BoardingSnapshot[] {
    return [...(this.snapshots.get(stopCode) ?? [])];
  }

  // ---------------------------------------------------------------------------
  // Demand modelling
  // ---------------------------------------------------------------------------

  /**
   * Distributes one event's shuttle-bound riders across arrival buckets at a
   * given stop.
   *
   * A crowd does not leave a hall uniformly. It peaks shortly after the doors
   * open and tails off, so the dispersal weight is triangular with its apex a
   * third of the way through the window. Each rider then spends the stop's walk
   * time getting there, which shifts the whole curve later for distant stops.
   */
  public buildArrivalCurve(
    letOut: EventLetOut,
    stop: ShuttleStop,
    riderCount: number,
  ): Map<number, number> {
    const curve = new Map<number, number>();
    if (riderCount <= 0) {
      return curve;
    }

    const walkMinutes = stop.walkMinutesByVenue[letOut.venueId];
    if (walkMinutes === undefined) {
      // The stop does not serve this venue at all.
      return curve;
    }

    const dispersalMinutes = letOut.dispersalMinutes ?? DEFAULT_DISPERSAL_MINUTES;
    const departureStart = letOut.endsAt.getTime();
    const apexOffset = dispersalMinutes / 3;

    // Sample the dispersal window at one-minute resolution and weight each
    // minute by its distance from the apex.
    const weights: Array<{ minute: number; weight: number }> = [];
    let weightTotal = 0;
    for (let minute = 0; minute < dispersalMinutes; minute += 1) {
      const distanceFromApex = Math.abs(minute + 0.5 - apexOffset);
      const weight = Math.max(0.05, 1 - distanceFromApex / dispersalMinutes);
      weights.push({ minute, weight });
      weightTotal += weight;
    }

    for (const { minute, weight } of weights) {
      const arrivalMs = departureStart + (minute + walkMinutes) * MS_PER_MINUTE;
      const bucketKey = this.bucketKeyFor(arrivalMs);
      const share = (weight / weightTotal) * riderCount;
      curve.set(bucketKey, (curve.get(bucketKey) ?? 0) + share);
    }

    return curve;
  }

  /**
   * Counts riders heading for a stop across every registered let-out, counting
   * each attendee once even when they confirmed two events that end together.
   *
   * The first let-out to claim an attendee keeps them, ordered by end time so
   * the earlier event wins deterministically.
   */
  public resolveRidersByLetOut(stop: ShuttleStop): Map<string, number> {
    const claimed = new Set<string>();
    const ridersByEvent = new Map<string, number>();

    const ordered = Array.from(this.letOuts.values())
      .filter((letOut) => stop.walkMinutesByVenue[letOut.venueId] !== undefined)
      .sort((a, b) => {
        const byTime = a.endsAt.getTime() - b.endsAt.getTime();
        return byTime !== 0 ? byTime : a.eventId.localeCompare(b.eventId);
      });

    for (const letOut of ordered) {
      let uniqueAttendees = 0;
      for (const attendeeId of letOut.confirmedAttendeeIds) {
        if (claimed.has(attendeeId)) {
          continue;
        }
        claimed.add(attendeeId);
        uniqueAttendees += 1;
      }
      const share = letOut.shuttleModeShare ?? this.defaultShuttleModeShare;
      ridersByEvent.set(letOut.eventId, uniqueAttendees * share);
    }

    return ridersByEvent;
  }

  // ---------------------------------------------------------------------------
  // Blending
  // ---------------------------------------------------------------------------

  /**
   * How far to trust live telemetry over the RSVP prior.
   *
   * Before any boardings are seen the prior is all there is. Confidence then
   * climbs with the number of snapshots, because a single reading at an empty
   * stop two minutes after let-out says very little.
   */
  public observedWeight(stopCode: string, evaluatedAt: Date): number {
    const snapshots = (this.snapshots.get(stopCode) ?? []).filter(
      (snapshot) => snapshot.observedAt.getTime() <= evaluatedAt.getTime(),
    );
    if (snapshots.length === 0) {
      return 0;
    }
    return Math.min(1, snapshots.length / OBSERVED_SATURATION_SAMPLES);
  }

  /**
   * Observed arrival rate per bucket, taken from the most recent snapshots.
   * Queue length is included because riders standing in the queue are demand
   * the timetable has already failed to absorb.
   */
  public observedArrivalsPerBucket(stopCode: string, evaluatedAt: Date): number | null {
    const snapshots = (this.snapshots.get(stopCode) ?? []).filter(
      (snapshot) => snapshot.observedAt.getTime() <= evaluatedAt.getTime(),
    );
    if (snapshots.length === 0) {
      return null;
    }

    const recent = snapshots.slice(-OBSERVED_SATURATION_SAMPLES);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const boardings = recent.reduce((sum, snapshot) => sum + snapshot.observedBoardings, 0);

    const spanMinutes = (last.observedAt.getTime() - first.observedAt.getTime()) / MS_PER_MINUTE;
    if (spanMinutes <= 0) {
      // A single reading: treat it as one bucket's worth of demand.
      return last.observedBoardings + last.observedQueueLength;
    }

    const ratePerMinute = boardings / spanMinutes;
    return ratePerMinute * BUCKET_MINUTES + last.observedQueueLength;
  }

  // ---------------------------------------------------------------------------
  // Forecast
  // ---------------------------------------------------------------------------

  public forecastStop(stopCode: string, evaluatedAt: Date): StopForecast {
    const stop = this.stops.get(stopCode);
    if (!stop) {
      throw new Error(`Unknown shuttle stop '${stopCode}'.`);
    }

    const ridersByEvent = this.resolveRidersByLetOut(stop);
    const combined = new Map<number, number>();

    for (const [eventId, riderCount] of ridersByEvent) {
      const letOut = this.letOuts.get(eventId);
      if (!letOut) {
        continue;
      }
      const curve = this.buildArrivalCurve(letOut, stop, riderCount);
      for (const [bucketKey, arrivals] of curve) {
        combined.set(bucketKey, (combined.get(bucketKey) ?? 0) + arrivals);
      }
    }

    const weight = this.observedWeight(stopCode, evaluatedAt);
    const observedPerBucket = this.observedArrivalsPerBucket(stopCode, evaluatedAt);
    const seatSupply = this.seatSupplyPerBucket(stop);

    const horizonStart = evaluatedAt.getTime() - FORECAST_HORIZON_MINUTES * MS_PER_MINUTE;
    const horizonEnd = evaluatedAt.getTime() + FORECAST_HORIZON_MINUTES * MS_PER_MINUTE;

    const buckets: DemandBucket[] = Array.from(combined.entries())
      .filter(([bucketKey]) => bucketKey >= horizonStart && bucketKey <= horizonEnd)
      .sort((a, b) => a[0] - b[0])
      .map(([bucketKey, priorArrivals]) => {
        const blended =
          observedPerBucket === null
            ? priorArrivals
            : priorArrivals * (1 - weight) + observedPerBucket * weight;
        const predictedArrivals = Math.round(blended);
        const saturationRatio = this.round3(predictedArrivals / seatSupply);
        return {
          bucketStart: new Date(bucketKey),
          bucketEnd: new Date(bucketKey + BUCKET_MINUTES * MS_PER_MINUTE),
          predictedArrivals,
          seatSupply,
          saturationRatio,
          classification: this.classify(saturationRatio),
          unseatedRiders: Math.max(0, predictedArrivals - seatSupply),
        };
      });

    const peakBucket = buckets.reduce<DemandBucket | null>((peak, bucket) => {
      if (!peak || bucket.saturationRatio > peak.saturationRatio) {
        return bucket;
      }
      return peak;
    }, null);

    const { recommendation, suppressedByCooldown } = this.evaluateRecommendation(
      stop,
      buckets,
      peakBucket,
      evaluatedAt,
    );

    return {
      stopCode: stop.stopCode,
      stopName: stop.name,
      evaluatedAt,
      buckets,
      observedWeight: this.round3(weight),
      peakBucket,
      recommendation,
      suppressedByCooldown,
    };
  }

  public forecastAllStops(evaluatedAt: Date): StopForecast[] {
    return this.listStops()
      .map((stop) => this.forecastStop(stop.stopCode, evaluatedAt))
      .sort((a, b) => {
        const aPeak = a.peakBucket?.saturationRatio ?? 0;
        const bPeak = b.peakBucket?.saturationRatio ?? 0;
        return bPeak - aPeak;
      });
  }

  public classify(saturationRatio: number): SaturationClass {
    const match = CLASSIFICATION_THRESHOLDS.find((entry) => saturationRatio >= entry.min);
    return match ? match.label : "NOMINAL";
  }

  /**
   * Seats the standing timetable delivers inside a single bucket. A stop on a
   * 15-minute headway supplies two thirds of a vehicle per 10-minute bucket.
   */
  public seatSupplyPerBucket(stop: ShuttleStop): number {
    return (stop.seatsPerVehicle * BUCKET_MINUTES) / stop.scheduledHeadwayMinutes;
  }

  // ---------------------------------------------------------------------------
  // Surge dispatch
  // ---------------------------------------------------------------------------

  private evaluateRecommendation(
    stop: ShuttleStop,
    buckets: DemandBucket[],
    peakBucket: DemandBucket | null,
    evaluatedAt: Date,
  ): { recommendation: SurgeRecommendation | null; suppressedByCooldown: boolean } {
    if (
      !peakBucket ||
      peakBucket.classification === "NOMINAL" ||
      peakBucket.classification === "ELEVATED"
    ) {
      return { recommendation: null, suppressedByCooldown: false };
    }

    const lastRaised = this.lastRecommendationAt.get(stop.stopCode);
    if (lastRaised) {
      const elapsedMinutes = (evaluatedAt.getTime() - lastRaised.getTime()) / MS_PER_MINUTE;
      if (elapsedMinutes < this.cooldownMinutes) {
        return { recommendation: null, suppressedByCooldown: true };
      }
    }

    const unseatedRiders = buckets.reduce((sum, bucket) => sum + bucket.unseatedRiders, 0);
    const extraVehiclesRequired = Math.max(1, Math.ceil(unseatedRiders / stop.seatsPerVehicle));

    const peakLabel = peakBucket.bucketStart.toISOString().slice(11, 16);
    const message =
      `${stop.name} is forecast to reach ${Math.round(peakBucket.saturationRatio * 100)}% of ` +
      `scheduled seat supply at ${peakLabel}. ${unseatedRiders} rider(s) would be left behind; ` +
      `dispatch ${extraVehiclesRequired} additional vehicle(s).`;

    this.lastRecommendationAt.set(stop.stopCode, evaluatedAt);

    return {
      recommendation: {
        stopCode: stop.stopCode,
        stopName: stop.name,
        peakBucketStart: peakBucket.bucketStart,
        peakSaturationRatio: peakBucket.saturationRatio,
        unseatedRiders,
        extraVehiclesRequired,
        message,
        raisedAt: evaluatedAt,
      },
      suppressedByCooldown: false,
    };
  }

  /** Clears cooldown state, e.g. once dispatch has acknowledged the surge. */
  public acknowledgeRecommendation(stopCode: string): void {
    this.lastRecommendationAt.delete(stopCode);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Floors a timestamp to the start of its 10-minute bucket. */
  private bucketKeyFor(timestampMs: number): number {
    const bucketMs = BUCKET_MINUTES * MS_PER_MINUTE;
    return Math.floor(timestampMs / bucketMs) * bucketMs;
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}

export const shuttleCrowdingForecastService = new ShuttleCrowdingForecastService();
