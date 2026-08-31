/**
 * Module: Minibus Driver Duty Hours
 * File: src/services/driverDutyHoursService.ts
 * Scope: Assesses a proposed driving assignment against the driver's
 *        accumulated record over a rolling window, and refuses with the rule
 *        broken and the earliest lawful departure (#4705).
 *
 * The booking form treats the driver as a name field. The rules that govern
 * this are about accumulated fatigue, and every one of them is invisible to a
 * check that looks at a single trip.
 *
 * That is the failure mode this module is built against: a trip that is
 * perfectly legal in isolation is illegal because of the trip before it. A
 * driver returning at one in the morning and leaving again at eight has taken
 * seven hours of rest, and no check that looks only at the second booking will
 * ever notice. That is exactly the away fixture on Saturday followed by the
 * field trip on Sunday.
 *
 * Two details reliably get implemented wrong and are pinned here. The split
 * break has an order — the shorter part first, the longer part second — and an
 * implementation that only totals the minutes passes the non-compliant
 * ordering every time. And duty is not driving: loading the kit, waiting at the
 * ground and sitting in the passenger seat as the second driver are all duty,
 * they do not count toward the driving limits, and they do count against the
 * rest.
 *
 * The allowances are consumable over a rolling window rather than per trip. A
 * calendar-week implementation of a rolling-window rule is a bug that only
 * shows up on Mondays.
 */

export type DutyKind = "DRIVING" | "OTHER_DUTY" | "SECOND_DRIVER";

export type RuleId = "CONTINUOUS_DRIVING" | "DAILY_DRIVING" | "DAILY_REST" | "ENTITLEMENT_EXPIRED";

export interface DutyRules {
  /** Driving permitted before a break is required. */
  maxContinuousDrivingMinutes: number;
  /** A break taken in one piece. */
  requiredBreakMinutes: number;
  /** The shorter part of a split break. It must come first. */
  splitBreakFirstMinutes: number;
  /** The longer part. It must come second. */
  splitBreakSecondMinutes: number;
  maxDailyDrivingMinutes: number;
  extendedDailyDrivingMinutes: number;
  extensionsPerWindow: number;
  minimumDailyRestMinutes: number;
  reducedDailyRestMinutes: number;
  reductionsPerWindow: number;
  rollingWindowDays: number;
}

export const DEFAULT_DUTY_RULES: DutyRules = {
  maxContinuousDrivingMinutes: 270,
  requiredBreakMinutes: 45,
  splitBreakFirstMinutes: 15,
  splitBreakSecondMinutes: 30,
  maxDailyDrivingMinutes: 540,
  extendedDailyDrivingMinutes: 600,
  extensionsPerWindow: 2,
  minimumDailyRestMinutes: 660,
  reducedDailyRestMinutes: 540,
  reductionsPerWindow: 3,
  rollingWindowDays: 7,
};

export interface DriverEntitlement {
  driverId: string;
  category: string;
  validFrom: Date;
  /** Checked against the journey, not against the booking. */
  validUntil: Date;
}

export interface DutySegment {
  segmentId: string;
  driverId: string;
  kind: DutyKind;
  from: Date;
  to: Date;
  tripId: string | null;
}

export interface ProposedSegment {
  kind: DutyKind;
  from: Date;
  to: Date;
}

export interface DutyGap {
  from: Date;
  to: Date;
  minutes: number;
}

export interface DutyPeriod {
  driverId: string;
  start: Date;
  end: Date;
  segments: DutySegment[];
  drivingMinutes: number;
  /** Everything on duty, driving included. */
  dutyMinutes: number;
  breaks: DutyGap[];
}

export interface Breach {
  rule: RuleId;
  detail: string;
  limitMinutes: number;
  actualMinutes: number;
  /**
   * The earliest instant this assignment would clear the rule. Null where no
   * amount of waiting fixes it — a trip that is simply too long to drive does
   * not become shorter by leaving later, and saying so is the useful answer.
   */
  lawfulFrom: Date | null;
}

export interface AllowanceLedger {
  extensionsUsed: number;
  extensionsRemaining: number;
  reductionsUsed: number;
  reductionsRemaining: number;
  windowFrom: Date;
  windowTo: Date;
}

export interface AssignmentAssessment {
  driverId: string;
  assessedAt: Date;
  lawful: boolean;
  breaches: Breach[];
  /**
   * The earliest departure that clears every breach, or null where none does.
   * A refusal without this tells the person planning the trip nothing they can
   * act on, and they will drive anyway.
   */
  earliestLawfulDeparture: Date | null;
  drivingMinutes: number;
  dutyMinutes: number;
  allowances: AllowanceLedger;
}

const MINUTE = 60_000;

function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MINUTE);
}

function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE);
}

export class DriverDutyHoursService {
  private readonly rules: DutyRules;
  private readonly entitlements: Map<string, DriverEntitlement>;
  private readonly segments: DutySegment[];

  constructor(rules: Partial<DutyRules> = {}) {
    this.rules = { ...DEFAULT_DUTY_RULES, ...rules };

    if (this.rules.splitBreakFirstMinutes > this.rules.splitBreakSecondMinutes) {
      // The whole point of the split rule is that the shorter part comes first.
      // Rules that invert it would silently pass the ordering this module
      // exists to catch.
      throw new Error("A split break puts the shorter part first; these rules invert it.");
    }
    if (this.rules.reducedDailyRestMinutes > this.rules.minimumDailyRestMinutes) {
      throw new Error("A reduced daily rest cannot be longer than the full one.");
    }
    if (this.rules.maxDailyDrivingMinutes > this.rules.extendedDailyDrivingMinutes) {
      throw new Error("An extended driving day cannot be shorter than the ordinary one.");
    }

    this.entitlements = new Map();
    this.segments = [];
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  public registerEntitlement(entitlement: DriverEntitlement): void {
    if (entitlement.validUntil.getTime() <= entitlement.validFrom.getTime()) {
      throw new Error(`Entitlement for ${entitlement.driverId} is valid for no time at all.`);
    }
    this.entitlements.set(entitlement.driverId, { ...entitlement });
  }

  public recordSegment(segment: DutySegment): void {
    if (segment.to.getTime() <= segment.from.getTime()) {
      throw new Error(`Segment ${segment.segmentId} ends before it starts.`);
    }
    if (this.segments.some((existing) => existing.segmentId === segment.segmentId)) {
      throw new Error(`Segment ${segment.segmentId} is already recorded.`);
    }
    this.segments.push({ ...segment });
  }

  public recordedSegments(driverId: string): readonly DutySegment[] {
    return this.segments
      .filter((segment) => segment.driverId === driverId)
      .sort((a, b) => a.from.getTime() - b.from.getTime());
  }

  // ---------------------------------------------------------------------------
  // Duty periods
  // ---------------------------------------------------------------------------

  /**
   * Folds a driver's segments into duty periods.
   *
   * A period ends where a gap long enough to count as a daily rest opens up.
   * A shorter gap is neither a break nor a rest — it is a long gap inside one
   * duty period, and treating it as a period boundary is how a seven-hour
   * overnight turns into two lawful days.
   */
  public dutyPeriods(driverId: string, extra: DutySegment[] = []): DutyPeriod[] {
    const all = [...this.segments.filter((s) => s.driverId === driverId), ...extra].sort(
      (a, b) => a.from.getTime() - b.from.getTime(),
    );

    const periods: DutyPeriod[] = [];
    let current: DutySegment[] = [];

    for (const segment of all) {
      if (current.length === 0) {
        current = [segment];
        continue;
      }

      const previousEnd = current[current.length - 1].to;
      const gap = minutesBetween(previousEnd, segment.from);

      if (gap >= this.rules.reducedDailyRestMinutes) {
        periods.push(this.buildPeriod(driverId, current));
        current = [segment];
      } else {
        current.push(segment);
      }
    }

    if (current.length > 0) periods.push(this.buildPeriod(driverId, current));
    return periods;
  }

  // ---------------------------------------------------------------------------
  // Breaks
  // ---------------------------------------------------------------------------

  /**
   * The longest run of driving in a period that is not properly broken.
   *
   * A break in one piece resets it. A split break resets it only in the right
   * order: the shorter part first, the longer part second. Thirty minutes then
   * fifteen totals the same forty-five and is not compliant, and an
   * implementation that adds the minutes up passes it every time.
   */
  public longestUnbrokenDriving(period: DutyPeriod): number {
    const { requiredBreakMinutes, splitBreakFirstMinutes, splitBreakSecondMinutes } = this.rules;

    let running = 0;
    let longest = 0;
    let firstPartTaken = false;
    let previous: DutySegment | null = null;

    for (const segment of period.segments) {
      if (previous) {
        const gap = minutesBetween(previous.to, segment.from);

        if (gap >= requiredBreakMinutes) {
          running = 0;
          firstPartTaken = false;
        } else if (gap >= splitBreakSecondMinutes && firstPartTaken) {
          // The longer part, arriving second. This is the only way a split
          // break completes.
          running = 0;
          firstPartTaken = false;
        } else if (gap >= splitBreakFirstMinutes) {
          // Long enough to be the first part of a split, and nothing more.
          // A second gap of this size does not complete the break.
          firstPartTaken = true;
        }
      }

      if (segment.kind === "DRIVING") {
        running += minutesBetween(segment.from, segment.to);
        longest = Math.max(longest, running);
      }

      previous = segment;
    }

    return longest;
  }

  // ---------------------------------------------------------------------------
  // Allowances
  // ---------------------------------------------------------------------------

  /**
   * Extensions and reductions already spent inside the rolling window.
   *
   * Rolling from the departure, not from the start of a calendar week. The
   * calendar version of this rule is a bug that only shows up on Mondays.
   */
  public allowances(driverId: string, departure: Date): AllowanceLedger {
    const windowFrom = addMinutes(departure, -this.rules.rollingWindowDays * 24 * 60);
    const periods = this.dutyPeriods(driverId).filter(
      (period) =>
        period.end.getTime() > windowFrom.getTime() && period.start.getTime() < departure.getTime(),
    );

    const extensionsUsed = periods.filter(
      (period) => period.drivingMinutes > this.rules.maxDailyDrivingMinutes,
    ).length;

    let reductionsUsed = 0;
    for (let index = 1; index < periods.length; index += 1) {
      const rest = minutesBetween(periods[index - 1].end, periods[index].start);
      if (rest >= this.rules.reducedDailyRestMinutes && rest < this.rules.minimumDailyRestMinutes) {
        reductionsUsed += 1;
      }
    }

    return {
      extensionsUsed,
      extensionsRemaining: Math.max(0, this.rules.extensionsPerWindow - extensionsUsed),
      reductionsUsed,
      reductionsRemaining: Math.max(0, this.rules.reductionsPerWindow - reductionsUsed),
      windowFrom,
      windowTo: departure,
    };
  }

  // ---------------------------------------------------------------------------
  // Assessment
  // ---------------------------------------------------------------------------

  /**
   * Assesses a proposed assignment against everything the driver has already
   * done.
   *
   * There is deliberately no way to assess a trip in isolation. The isolated
   * answer is the wrong answer often enough to be dangerous, and an API that
   * offers it is an API somebody will call.
   */
  public assess(
    driverId: string,
    proposed: ProposedSegment[],
    assessedAt: Date,
  ): AssignmentAssessment {
    if (proposed.length === 0) {
      throw new Error("An assignment with no segments is not an assignment.");
    }

    const sorted = [...proposed].sort((a, b) => a.from.getTime() - b.from.getTime());
    for (const segment of sorted) {
      if (segment.to.getTime() <= segment.from.getTime()) {
        throw new Error("A proposed segment ends before it starts.");
      }
    }

    const departure = sorted[0].from;
    const arrival = sorted[sorted.length - 1].to;
    const asSegments: DutySegment[] = sorted.map((segment, index) => ({
      segmentId: `proposed-${index}`,
      driverId,
      tripId: null,
      ...segment,
    }));

    const allowances = this.allowances(driverId, departure);
    const breaches: Breach[] = [];

    this.checkEntitlement(driverId, departure, arrival, breaches);

    const periods = this.dutyPeriods(driverId, asSegments);
    const period = periods.find((candidate) =>
      candidate.segments.some((segment) => segment.segmentId.startsWith("proposed-")),
    )!;

    this.checkDailyRest(driverId, departure, allowances, breaches);
    this.checkDailyDriving(period, allowances, breaches);
    this.checkContinuousDriving(period, breaches);

    const proposedOnly = this.buildPeriod(driverId, asSegments);

    return {
      driverId,
      assessedAt,
      lawful: breaches.length === 0,
      breaches: breaches.sort((a, b) => a.rule.localeCompare(b.rule)),
      earliestLawfulDeparture: this.earliestLawfulDeparture(breaches, departure),
      drivingMinutes: proposedOnly.drivingMinutes,
      dutyMinutes: proposedOnly.dutyMinutes,
      allowances,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private checkEntitlement(
    driverId: string,
    departure: Date,
    arrival: Date,
    breaches: Breach[],
  ): void {
    const entitlement = this.entitlements.get(driverId);

    if (!entitlement) {
      breaches.push({
        rule: "ENTITLEMENT_EXPIRED",
        detail: `${driverId} holds no recorded entitlement`,
        limitMinutes: 0,
        actualMinutes: 0,
        lawfulFrom: null,
      });
      return;
    }

    // Judged against the journey, not the booking. A licence that lapses
    // between the two is the case the check exists for, and waiting only makes
    // it worse — so there is no lawful-from to offer.
    if (
      entitlement.validFrom.getTime() > departure.getTime() ||
      entitlement.validUntil.getTime() < arrival.getTime()
    ) {
      breaches.push({
        rule: "ENTITLEMENT_EXPIRED",
        detail: `${driverId} is not entitled to drive for the whole journey`,
        limitMinutes: 0,
        actualMinutes: 0,
        lawfulFrom: null,
      });
    }
  }

  private checkDailyRest(
    driverId: string,
    departure: Date,
    allowances: AllowanceLedger,
    breaches: Breach[],
  ): void {
    const previous = this.dutyPeriods(driverId)
      .filter((period) => period.end.getTime() <= departure.getTime())
      .sort((a, b) => b.end.getTime() - a.end.getTime())[0];

    if (!previous) return;

    const rest = minutesBetween(previous.end, departure);
    const required =
      allowances.reductionsRemaining > 0
        ? this.rules.reducedDailyRestMinutes
        : this.rules.minimumDailyRestMinutes;

    if (rest >= required) return;

    breaches.push({
      rule: "DAILY_REST",
      detail:
        allowances.reductionsRemaining > 0
          ? `Only ${rest} minutes since the last duty ended, against a reduced rest of ${required}`
          : `Only ${rest} minutes since the last duty ended, and every reduction in the window is spent`,
      limitMinutes: required,
      actualMinutes: rest,
      lawfulFrom: addMinutes(previous.end, required),
    });
  }

  private checkDailyDriving(
    period: DutyPeriod,
    allowances: AllowanceLedger,
    breaches: Breach[],
  ): void {
    const { maxDailyDrivingMinutes, extendedDailyDrivingMinutes } = this.rules;

    if (period.drivingMinutes > extendedDailyDrivingMinutes) {
      breaches.push({
        rule: "DAILY_DRIVING",
        detail: `${period.drivingMinutes} minutes of driving, past even an extended day`,
        limitMinutes: extendedDailyDrivingMinutes,
        actualMinutes: period.drivingMinutes,
        lawfulFrom: null,
      });
      return;
    }

    if (period.drivingMinutes > maxDailyDrivingMinutes && allowances.extensionsRemaining === 0) {
      breaches.push({
        rule: "DAILY_DRIVING",
        detail: `${period.drivingMinutes} minutes of driving needs an extension, and all ${allowances.extensionsUsed} are spent in the window`,
        limitMinutes: maxDailyDrivingMinutes,
        actualMinutes: period.drivingMinutes,
        lawfulFrom: null,
      });
    }
  }

  private checkContinuousDriving(period: DutyPeriod, breaches: Breach[]): void {
    const longest = this.longestUnbrokenDriving(period);
    if (longest <= this.rules.maxContinuousDrivingMinutes) return;

    breaches.push({
      rule: "CONTINUOUS_DRIVING",
      detail: `${longest} minutes of driving without a break taken in the right order`,
      limitMinutes: this.rules.maxContinuousDrivingMinutes,
      actualMinutes: longest,
      // Leaving later does not make the drive shorter. The fix is a break or a
      // second driver, and saying "not before 10am" would be a lie.
      lawfulFrom: null,
    });
  }

  private earliestLawfulDeparture(breaches: Breach[], departure: Date): Date | null {
    if (breaches.length === 0) return departure;
    if (breaches.some((breach) => breach.lawfulFrom === null)) return null;

    return breaches
      .map((breach) => breach.lawfulFrom!)
      .reduce((latest, candidate) => (candidate.getTime() > latest.getTime() ? candidate : latest));
  }

  private buildPeriod(driverId: string, segments: DutySegment[]): DutyPeriod {
    const drivingMinutes = segments
      .filter((segment) => segment.kind === "DRIVING")
      .reduce((sum, segment) => sum + minutesBetween(segment.from, segment.to), 0);

    // Duty covers everything, driving included. Loading the kit, waiting at
    // the ground and riding as the second driver are all duty, and treating
    // them as free time is how a driver arrives at the wheel already out of
    // hours.
    const dutyMinutes = segments.reduce(
      (sum, segment) => sum + minutesBetween(segment.from, segment.to),
      0,
    );

    const breaks: DutyGap[] = [];
    for (let index = 1; index < segments.length; index += 1) {
      const from = segments[index - 1].to;
      const to = segments[index].from;
      const minutes = minutesBetween(from, to);
      if (minutes > 0) breaks.push({ from, to, minutes });
    }

    return {
      driverId,
      start: segments[0].from,
      end: segments[segments.length - 1].to,
      segments,
      drivingMinutes,
      dutyMinutes,
      breaks,
    };
  }
}
