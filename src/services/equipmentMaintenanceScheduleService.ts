/**
 * Module: Usage-Hour Preventive Maintenance Scheduler
 * File: src/services/equipmentMaintenanceScheduleService.ts
 * Scope: Schedules preventive maintenance on shared club equipment against both
 *        a usage-hour meter and a calendar interval, whichever falls due first,
 *        with usage accrued from the checkout records the platform already
 *        writes (#4555).
 *
 * A calendar interval is the wrong axis for almost everything in the pool. A
 * projector used four hours a semester and one used four hundred both get
 * serviced in March; the second has a dead lamp by January and the first gets
 * stripped down for nothing. What kills a lamp, an extruder or a drone motor is
 * hours of operation. The platform already knows those hours — every checkout
 * has a start and an end — and has never connected them to a decision.
 *
 * Two things are worth knowing before reading on.
 *
 * The meter due instant is derived exactly, not projected. Walking the checkout
 * intervals and finding the moment the accumulated hours crossed the threshold
 * gives an answer that is reproducible and defensible; a forecast would be
 * neither, and the forecast lives separately in `projectNextDue` where its
 * uncertainty is visible.
 *
 * Every predicate takes the evaluation instant as an argument. Nothing reads
 * the wall clock, so the state of the fleet on any past date is reproducible.
 */

export type MaintenanceStatus = "OK" | "DUE" | "DEFERRED" | "LOCKED_OUT";

export type DueTrigger = "NONE" | "METER" | "CALENDAR";

export type DeferralOutcome =
  | "DEFERRED"
  | "REFUSED_NOT_DUE"
  | "REFUSED_CONSECUTIVE_LIMIT"
  | "REFUSED_HOURS_CAP"
  | "REFUSED_DAYS_CAP";

/** Past this many hours beyond the meter due point the asset stops going out. */
export const MAX_OVERDUE_HOURS = 20;

/** Past this many days beyond the calendar due point, likewise. */
export const MAX_OVERDUE_DAYS = 30;

/** Two postponements is a scheduling problem; three is an excuse. */
export const MAX_CONSECUTIVE_DEFERRALS = 2;

/** Trailing window the usage-rate projection is drawn from. */
export const PROJECTION_WINDOW_DAYS = 28;

/** Below either of these the window has not seen enough to extrapolate from. */
export const MIN_PROJECTION_CHECKOUTS = 3;
export const MIN_PROJECTION_SPAN_DAYS = 7;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export interface MaintenancePlan {
  assetId: string;
  clubId: string;
  assetName: string;
  /** Hours of operation between services. */
  meterIntervalHours: number;
  /** Days between services regardless of use. */
  calendarIntervalDays: number;
  /** The clock starts here until the first service is completed. */
  commissionedAt: Date;
}

export interface CheckoutRecord {
  checkoutId: string;
  assetId: string;
  borrowerUserId: string;
  checkedOutAt: Date;
  /** Null while the asset is still out. */
  returnedAt: Date | null;
}

export interface ServiceRecord {
  assetId: string;
  completedAt: Date;
  performedBy: string;
  notes: string;
}

export interface DeferralRecord {
  assetId: string;
  grantedAt: Date;
  grantedBy: string;
  reason: string;
}

export interface MaintenanceAssessment {
  assetId: string;
  assessedAt: Date;
  status: MaintenanceStatus;
  /** Which clock ran out first, and therefore what to open the case for. */
  trigger: DueTrigger;
  hoursSinceService: number;
  daysSinceService: number;
  meterDueAt: Date | null;
  calendarDueAt: Date;
  overdueHours: number;
  overdueDays: number;
  consecutiveDeferrals: number;
  checkoutBlocked: boolean;
  blockedReason: string | null;
}

export interface DueProjection {
  assetId: string;
  /** Null when the window has too little history to extrapolate from. */
  projectedDueAt: Date | null;
  observedHoursPerDay: number | null;
  reason: "PROJECTED" | "INSUFFICIENT_HISTORY" | "NO_OBSERVED_USAGE" | "ALREADY_DUE";
}

interface TrackedAsset extends MaintenancePlan {
  services: ServiceRecord[];
  deferrals: DeferralRecord[];
}

export class EquipmentMaintenanceScheduleService {
  private readonly assets: Map<string, TrackedAsset>;
  private readonly checkouts: Map<string, CheckoutRecord[]>;

  constructor() {
    this.assets = new Map();
    this.checkouts = new Map();
  }

  // ---------------------------------------------------------------------------
  // Plans
  // ---------------------------------------------------------------------------

  public registerAsset(plan: MaintenancePlan): void {
    if (this.assets.has(plan.assetId)) {
      throw new Error(`Asset ${plan.assetId} already has a maintenance plan.`);
    }
    if (plan.meterIntervalHours <= 0) {
      throw new Error(`Meter interval for ${plan.assetId} must be positive.`);
    }
    if (plan.calendarIntervalDays <= 0) {
      throw new Error(`Calendar interval for ${plan.assetId} must be positive.`);
    }
    this.assets.set(plan.assetId, { ...plan, services: [], deferrals: [] });
    this.checkouts.set(plan.assetId, []);
  }

  // ---------------------------------------------------------------------------
  // Usage, accrued from checkouts
  // ---------------------------------------------------------------------------

  /**
   * Records a checkout, refusing one that overlaps another on the same asset.
   *
   * The overlap check is not tidiness. Usage is the sum of the checkout
   * intervals, so two records covering the same afternoon accrue two hours of
   * wear per elapsed hour and bring the service forward on evidence that does
   * not exist. A double-booked asset is a booking bug, and absorbing it here
   * would turn it into a maintenance bug as well.
   */
  public recordCheckout(record: CheckoutRecord): void {
    this.requireAsset(record.assetId);

    if (record.returnedAt && record.returnedAt.getTime() < record.checkedOutAt.getTime()) {
      throw new Error(`Checkout ${record.checkoutId} cannot be returned before it went out.`);
    }

    const existing = this.checkoutsFor(record.assetId);
    const clash = existing.find((other) => this.overlaps(other, record));
    if (clash) {
      throw new Error(
        `Checkout ${record.checkoutId} overlaps ${clash.checkoutId} on the same asset; ` +
          `two records over one interval would accrue usage twice.`,
      );
    }

    existing.push({ ...record });
    existing.sort((a, b) => a.checkedOutAt.getTime() - b.checkedOutAt.getTime());
  }

  public closeCheckout(checkoutId: string, assetId: string, returnedAt: Date): void {
    const record = this.checkoutsFor(assetId).find((entry) => entry.checkoutId === checkoutId);
    if (!record) {
      throw new Error(`Unknown checkout ${checkoutId} on asset ${assetId}.`);
    }
    if (record.returnedAt) {
      throw new Error(`Checkout ${checkoutId} was already returned.`);
    }
    if (returnedAt.getTime() < record.checkedOutAt.getTime()) {
      throw new Error(`Checkout ${checkoutId} cannot be returned before it went out.`);
    }
    record.returnedAt = returnedAt;
  }

  /** Hours the asset was out between two instants. */
  public usageHoursBetween(assetId: string, from: Date, to: Date): number {
    return this.round(this.usageMsBetween(assetId, from.getTime(), to.getTime()) / MS_PER_HOUR);
  }

  // ---------------------------------------------------------------------------
  // The dual-interval assessment
  // ---------------------------------------------------------------------------

  /**
   * Where one asset stands at a given instant.
   *
   * `trigger` reports which clock ran out first rather than merely that one
   * did. A technician needs to know whether to check the lamp or the seals
   * before they open the case, and "due" on its own does not say.
   */
  public assess(assetId: string, assessedAt: Date): MaintenanceAssessment {
    const asset = this.requireAsset(assetId);
    const baselineAt = this.baselineAt(asset);

    const hoursSinceService = this.round(
      this.usageMsBetween(assetId, baselineAt.getTime(), assessedAt.getTime()) / MS_PER_HOUR,
    );
    const daysSinceService = this.round(
      Math.max(0, assessedAt.getTime() - baselineAt.getTime()) / MS_PER_DAY,
    );

    const calendarDueAt = new Date(baselineAt.getTime() + asset.calendarIntervalDays * MS_PER_DAY);
    const meterDueAt = this.meterDueAt(asset, baselineAt);

    const calendarDue = assessedAt.getTime() >= calendarDueAt.getTime();
    const meterDue = meterDueAt !== null && assessedAt.getTime() >= meterDueAt.getTime();

    let trigger: DueTrigger = "NONE";
    if (meterDue && calendarDue) {
      // Both clocks have run out; the one that ran out first is the one that
      // describes what went wrong.
      trigger = meterDueAt!.getTime() <= calendarDueAt.getTime() ? "METER" : "CALENDAR";
    } else if (meterDue) {
      trigger = "METER";
    } else if (calendarDue) {
      trigger = "CALENDAR";
    }

    const overdueHours = meterDue
      ? this.round(
          this.usageMsBetween(assetId, meterDueAt!.getTime(), assessedAt.getTime()) / MS_PER_HOUR,
        )
      : 0;
    const overdueDays = calendarDue
      ? this.round((assessedAt.getTime() - calendarDueAt.getTime()) / MS_PER_DAY)
      : 0;

    const consecutiveDeferrals = this.consecutiveDeferrals(asset, assessedAt);
    const cap = this.capBreached(overdueHours, overdueDays, consecutiveDeferrals);

    let status: MaintenanceStatus;
    if (cap) {
      status = "LOCKED_OUT";
    } else if (trigger === "NONE") {
      status = "OK";
    } else if (consecutiveDeferrals > 0) {
      status = "DEFERRED";
    } else {
      status = "DUE";
    }

    return {
      assetId,
      assessedAt,
      status,
      trigger,
      hoursSinceService,
      daysSinceService,
      meterDueAt,
      calendarDueAt,
      overdueHours,
      overdueDays,
      consecutiveDeferrals,
      checkoutBlocked: status === "LOCKED_OUT",
      blockedReason: cap,
    };
  }

  /** The whole fleet, worst first, for the weekly maintenance list. */
  public assessFleet(clubId: string, assessedAt: Date): MaintenanceAssessment[] {
    const rank: Record<MaintenanceStatus, number> = {
      LOCKED_OUT: 0,
      DUE: 1,
      DEFERRED: 2,
      OK: 3,
    };
    return [...this.assets.values()]
      .filter((asset) => asset.clubId === clubId)
      .map((asset) => this.assess(asset.assetId, assessedAt))
      .sort(
        (a, b) =>
          rank[a.status] - rank[b.status] ||
          b.overdueHours - a.overdueHours ||
          a.assetId.localeCompare(b.assetId),
      );
  }

  // ---------------------------------------------------------------------------
  // Deferral and completion
  // ---------------------------------------------------------------------------

  /**
   * Postpone a due service.
   *
   * Bounded in three directions, because an unbounded deferral is just a
   * service that never happens with a paper trail attached. Past any cap the
   * answer is not another deferral but a lockout, which is the only lever that
   * makes the service actually get booked.
   */
  public deferService(
    assetId: string,
    at: Date,
    grantedBy: string,
    reason: string,
  ): { outcome: DeferralOutcome; consecutiveDeferrals: number } {
    const asset = this.requireAsset(assetId);
    const assessment = this.assess(assetId, at);

    if (assessment.trigger === "NONE") {
      return { outcome: "REFUSED_NOT_DUE", consecutiveDeferrals: assessment.consecutiveDeferrals };
    }
    if (assessment.consecutiveDeferrals >= MAX_CONSECUTIVE_DEFERRALS) {
      return {
        outcome: "REFUSED_CONSECUTIVE_LIMIT",
        consecutiveDeferrals: assessment.consecutiveDeferrals,
      };
    }
    if (assessment.overdueHours > MAX_OVERDUE_HOURS) {
      return {
        outcome: "REFUSED_HOURS_CAP",
        consecutiveDeferrals: assessment.consecutiveDeferrals,
      };
    }
    if (assessment.overdueDays > MAX_OVERDUE_DAYS) {
      return { outcome: "REFUSED_DAYS_CAP", consecutiveDeferrals: assessment.consecutiveDeferrals };
    }

    asset.deferrals.push({ assetId, grantedAt: at, grantedBy, reason });
    return {
      outcome: "DEFERRED",
      consecutiveDeferrals: assessment.consecutiveDeferrals + 1,
    };
  }

  /**
   * Records a completed service.
   *
   * Both clocks restart from the completion instant, not from the due date they
   * missed. Restarting from the due date means a service performed three weeks
   * late is three weeks into its next interval the moment the technician puts
   * the panel back on, and the asset spends the rest of its life catching up
   * with a schedule it has already fallen off.
   */
  public completeService(record: ServiceRecord): void {
    const asset = this.requireAsset(record.assetId);
    const last = asset.services[asset.services.length - 1];
    if (last && record.completedAt.getTime() < last.completedAt.getTime()) {
      throw new Error(
        `Service on ${record.assetId} cannot predate the previous service at ` +
          `${last.completedAt.toISOString()}.`,
      );
    }
    asset.services.push({ ...record });
  }

  // ---------------------------------------------------------------------------
  // Projection
  // ---------------------------------------------------------------------------

  /**
   * When the meter is likely to run out, from the trailing usage rate.
   *
   * Kept apart from `assess` on purpose. The assessment is exact and the
   * projection is a guess, and a club planning a service window is entitled to
   * know which of the two it is looking at.
   *
   * With too little history it returns nothing rather than a date. Extrapolating
   * a year of wear from one afternoon's checkout produces a confident-looking
   * figure that is worse than an admission of ignorance, because somebody will
   * book a technician against it.
   */
  public projectNextDue(assetId: string, from: Date): DueProjection {
    const asset = this.requireAsset(assetId);
    const assessment = this.assess(assetId, from);

    if (assessment.trigger !== "NONE") {
      return { assetId, projectedDueAt: null, observedHoursPerDay: null, reason: "ALREADY_DUE" };
    }

    const windowStart = new Date(from.getTime() - PROJECTION_WINDOW_DAYS * MS_PER_DAY);
    const inWindow = this.checkoutsFor(assetId).filter(
      (checkout) =>
        this.checkoutEnd(checkout) > windowStart.getTime() &&
        checkout.checkedOutAt.getTime() < from.getTime(),
    );

    const observedFrom = Math.max(windowStart.getTime(), asset.commissionedAt.getTime());
    const spanDays = (from.getTime() - observedFrom) / MS_PER_DAY;

    if (inWindow.length < MIN_PROJECTION_CHECKOUTS || spanDays < MIN_PROJECTION_SPAN_DAYS) {
      return {
        assetId,
        projectedDueAt: null,
        observedHoursPerDay: null,
        reason: "INSUFFICIENT_HISTORY",
      };
    }

    const windowHours = this.usageMsBetween(assetId, observedFrom, from.getTime()) / MS_PER_HOUR;
    const hoursPerDay = windowHours / spanDays;

    if (hoursPerDay <= 0) {
      return {
        assetId,
        projectedDueAt: null,
        observedHoursPerDay: 0,
        reason: "NO_OBSERVED_USAGE",
      };
    }

    const hoursRemaining = asset.meterIntervalHours - assessment.hoursSinceService;
    const daysRemaining = hoursRemaining / hoursPerDay;
    const meterProjected = from.getTime() + daysRemaining * MS_PER_DAY;

    return {
      assetId,
      // The calendar clock is exact, so the honest projection is the earlier of
      // the forecast meter date and the date the calendar already guarantees.
      projectedDueAt: new Date(Math.min(meterProjected, assessment.calendarDueAt.getTime())),
      observedHoursPerDay: this.round(hoursPerDay),
      reason: "PROJECTED",
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * The exact instant accumulated usage since the baseline crossed the meter
   * interval, found by walking the checkout intervals rather than dividing by
   * an average. Null while the asset has not run long enough to get there.
   */
  private meterDueAt(asset: TrackedAsset, baselineAt: Date): Date | null {
    const targetMs = asset.meterIntervalHours * MS_PER_HOUR;
    let accumulated = 0;

    for (const checkout of this.checkoutsFor(asset.assetId)) {
      const start = Math.max(checkout.checkedOutAt.getTime(), baselineAt.getTime());
      const end = this.checkoutEnd(checkout);
      if (end <= start) continue;

      const span = end - start;
      if (accumulated + span >= targetMs) {
        return new Date(start + (targetMs - accumulated));
      }
      accumulated += span;
    }

    return null;
  }

  private baselineAt(asset: TrackedAsset): Date {
    const last = asset.services[asset.services.length - 1];
    return last ? last.completedAt : asset.commissionedAt;
  }

  /** Deferrals granted since the last completed service; a service clears them. */
  private consecutiveDeferrals(asset: TrackedAsset, at: Date): number {
    const baseline = this.baselineAt(asset).getTime();
    return asset.deferrals.filter(
      (deferral) =>
        deferral.grantedAt.getTime() >= baseline && deferral.grantedAt.getTime() <= at.getTime(),
    ).length;
  }

  private capBreached(
    overdueHours: number,
    overdueDays: number,
    consecutiveDeferrals: number,
  ): string | null {
    if (overdueHours > MAX_OVERDUE_HOURS) {
      return `${overdueHours} hours past the meter due point, over the ${MAX_OVERDUE_HOURS}-hour cap`;
    }
    if (overdueDays > MAX_OVERDUE_DAYS) {
      return `${overdueDays} days past the calendar due point, over the ${MAX_OVERDUE_DAYS}-day cap`;
    }
    if (consecutiveDeferrals > MAX_CONSECUTIVE_DEFERRALS) {
      return `${consecutiveDeferrals} consecutive deferrals, over the limit of ${MAX_CONSECUTIVE_DEFERRALS}`;
    }
    return null;
  }

  private usageMsBetween(assetId: string, fromMs: number, toMs: number): number {
    if (toMs <= fromMs) return 0;
    let total = 0;
    for (const checkout of this.checkoutsFor(assetId)) {
      const start = Math.max(checkout.checkedOutAt.getTime(), fromMs);
      const end = Math.min(this.checkoutEnd(checkout), toMs);
      if (end > start) total += end - start;
    }
    return total;
  }

  /**
   * An open checkout is treated as still running. The asset is out and being
   * used; pretending otherwise until somebody remembers to scan it back in
   * would let an unreturned item accrue nothing at all.
   */
  private checkoutEnd(checkout: CheckoutRecord): number {
    return checkout.returnedAt ? checkout.returnedAt.getTime() : Number.POSITIVE_INFINITY;
  }

  private overlaps(a: CheckoutRecord, b: CheckoutRecord): boolean {
    return (
      a.checkedOutAt.getTime() < this.checkoutEnd(b) &&
      b.checkedOutAt.getTime() < this.checkoutEnd(a)
    );
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private requireAsset(assetId: string): TrackedAsset {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Unknown asset ${assetId}.`);
    }
    return asset;
  }

  private checkoutsFor(assetId: string): CheckoutRecord[] {
    const log = this.checkouts.get(assetId);
    if (!log) throw new Error(`Unknown asset ${assetId}.`);
    return log;
  }
}
