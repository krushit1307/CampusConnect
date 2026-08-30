/**
 * Module: Irregular-Hours Holiday Entitlement Accrual
 * File: src/services/casualHolidayAccrualService.ts
 * Scope: Accrues leave per pay period from hours worked and hours credited
 *        during statutory leave, caps accrual at the statutory maximum for the
 *        worker's own pattern, applies leave to the year its dates fall in,
 *        checks rolled-up holiday pay per period, computes payment in lieu at
 *        termination from average weekly pay over the reference period, and
 *        separates carry-over from balance that lapses (#5262).
 *
 * Nearly all student staffing here is irregular-hours work: a bar shift, a
 * stewarding block, three weeks of open days and then nothing until October.
 * The platform computes gross pay for those hours. Nobody computes the holiday
 * those hours earn, and the entitlement accrues whether or not anyone tracks it.
 *
 * Entitlement accrues per hour, not as an annual allowance handed over up
 * front. The rate is 5.6 weeks over the 46.4 remaining working weeks — 12.07% —
 * and it is not arbitrary. Handing a part-year worker "28 days" produces an
 * entitlement that is wrong for everyone who did not work a full year, in
 * whichever direction happens to be worse for them.
 *
 * The percentage does bind at the top, though. Somebody who works all 52 weeks,
 * taking no leave at all, accrues 6.28 weeks by the formula and is entitled to
 * 5.6, so the cap is applied against the worker's own average week rather than
 * against a notional full-time one.
 *
 * Hours not worked because the worker was on sick or family leave still accrue
 * entitlement. An implementation that multiplies hours worked by 12.07% and
 * stops gets this wrong precisely in the months where getting it wrong matters
 * most to the person it happens to.
 *
 * Leave-year boundaries cut the accrual rather than the year. Three hundred
 * hours in July and forty in September are two different balances depending on
 * where the year falls, and a pay period straddling the boundary belongs partly
 * to each. Leave taken is applied to the year its dates fall in, not the year
 * it was booked in.
 *
 * Rolled-up holiday pay is permissible for these workers only if it is paid as
 * it accrues and itemised separately on the payslip. Paying it as a lump at the
 * end, or folding it into the hourly rate without saying so, does not discharge
 * the obligation — so a period that paid the right amount without itemising it
 * is reported as non-compliant rather than passing on the arithmetic alone.
 *
 * And payment in lieu at termination is computed from average weekly pay over
 * the reference period, skipping weeks with no pay and extending the lookback
 * to compensate. For a student whose rate rose in April that is a different
 * number from the current rate, and it is the one they are owed.
 *
 * Hours are carried to three decimal places and money in whole pence. Money is
 * rounded half-up at the point it becomes payable, and only there.
 */

export type NonCompliance = "ROLLED_UP_UNDERPAID" | "ROLLED_UP_NOT_ITEMISED" | "ROLLED_UP_NOT_PAID";

export interface LeaveYear {
  workerId: string;
  startsOn: Date;
  /** Exclusive. A year ending on 1 April does not include 1 April. */
  endsOn: Date;
}

export interface PayPeriod {
  periodId: string;
  workerId: string;
  startsOn: Date;
  /** Exclusive. */
  endsOn: Date;
  hoursWorked: number;
  /**
   * Hours the worker did not work because they were on sick or family leave.
   * These accrue entitlement exactly as worked hours do.
   */
  statutoryLeaveHoursCredited: number;
  hourlyRatePence: number;
  /** What was actually paid as holiday pay in this period, in pence. */
  rolledUpPaidPence: number;
  /** Whether it was shown separately on the payslip, which is a separate question. */
  rolledUpItemised: boolean;
}

export interface LeaveTaken {
  leaveId: string;
  workerId: string;
  /** The date the leave was taken, which decides the year it belongs to. */
  takenOn: Date;
  hours: number;
}

export interface Accrual {
  workerId: string;
  leaveYearStart: Date;
  /** Before the cap, so the cap is visible when it bites. */
  rawAccruedHours: number;
  cappedAccruedHours: number;
  capHours: number;
  capApplied: boolean;
  hoursWorked: number;
  statutoryLeaveHoursCredited: number;
  averageWeeklyHours: number;
}

export interface Balance {
  workerId: string;
  leaveYearStart: Date;
  accruedHours: number;
  carriedInHours: number;
  takenHours: number;
  remainingHours: number;
}

export interface PeriodCompliance {
  periodId: string;
  accruedHours: number;
  duePence: number;
  paidPence: number;
  itemised: boolean;
  compliant: boolean;
  problems: NonCompliance[];
}

export interface WeeklyPay {
  weekStart: Date;
  grossPence: number;
  hours: number;
}

export interface ReferencePeriod {
  weeks: WeeklyPay[];
  /** Weeks with no pay, skipped, with the lookback extended to compensate. */
  weeksSkipped: number;
  averageWeeklyPayPence: number;
  averageWeeklyHours: number;
}

export interface TerminationPayment {
  workerId: string;
  terminationDate: Date;
  untakenHours: number;
  reference: ReferencePeriod;
  weeksOwed: number;
  amountPence: number;
  reason: string;
}

export interface CarryOverAssessment {
  workerId: string;
  leaveYearStart: Date;
  untakenHours: number;
  carriedHours: number;
  lapsedHours: number;
  reasons: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/** 5.6 weeks over the 46.4 remaining working weeks. */
const STATUTORY_LEAVE_WEEKS = 5.6;
const REMAINING_WORKING_WEEKS = 46.4;
export const ACCRUAL_RATE = STATUTORY_LEAVE_WEEKS / REMAINING_WORKING_WEEKS;

/** Leave the worker was prevented from taking carries this far. */
const PREVENTED_CARRY_WEEKS = 4;
/** Leave carried by agreement carries this far, and no further. */
const AGREED_CARRY_WEEKS = 1.6;

/** The reference period for average pay, and how far back it may reach. */
const REFERENCE_WEEKS = 52;
const MAX_LOOKBACK_WEEKS = 104;

function roundHours(hours: number): number {
  return Math.round(hours * 1000) / 1000;
}

function roundPence(pence: number): number {
  return Math.round(pence);
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday 00:00 UTC of the week containing the instant. */
export function weekStartOf(instant: Date): Date {
  const day = startOfDay(instant);
  const offsetDays = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offsetDays * MS_PER_DAY);
}

function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class CasualHolidayAccrualService {
  private readonly leaveYears: LeaveYear[] = [];
  private readonly periods = new Map<string, PayPeriod>();
  private readonly leave = new Map<string, LeaveTaken>();
  /** leaveYearStart ISO -> hours carried in from the year before. */
  private readonly carriedIn = new Map<string, number>();

  registerLeaveYear(leaveYear: LeaveYear): void {
    if (leaveYear.endsOn.getTime() <= leaveYear.startsOn.getTime()) {
      throw new Error("A leave year must end after it starts");
    }
    this.leaveYears.push(leaveYear);
  }

  recordPayPeriod(period: PayPeriod): void {
    if (period.endsOn.getTime() <= period.startsOn.getTime()) {
      throw new Error(`Pay period ${period.periodId} must end after it starts`);
    }
    if (period.hoursWorked < 0 || period.statutoryLeaveHoursCredited < 0) {
      throw new Error(`Pay period ${period.periodId} cannot carry negative hours`);
    }
    this.periods.set(period.periodId, period);
  }

  recordLeaveTaken(taken: LeaveTaken): void {
    if (taken.hours <= 0) {
      throw new Error(`Leave ${taken.leaveId} must be a positive number of hours`);
    }
    this.leave.set(taken.leaveId, taken);
  }

  /** Hours carried into a leave year from the one before it. */
  setCarriedIn(workerId: string, leaveYearStart: Date, hours: number): void {
    this.carriedIn.set(`${workerId}|${isoDate(leaveYearStart)}`, hours);
  }

  leaveYearContaining(workerId: string, date: Date): LeaveYear {
    const found = this.leaveYears.find(
      (year) =>
        year.workerId === workerId &&
        year.startsOn.getTime() <= date.getTime() &&
        year.endsOn.getTime() > date.getTime(),
    );
    if (!found) {
      throw new Error(`No leave year covers ${isoDate(date)} for ${workerId}`);
    }
    return found;
  }

  /**
   * Entitlement earned by one pay period: 12.07% of the hours worked plus the
   * hours credited during statutory leave.
   *
   * The credited hours are the part an "hours worked times 12.07%"
   * implementation drops, and it drops them in exactly the months where the
   * worker is least able to notice.
   */
  accrualForPeriod(periodId: string): number {
    const period = this.periods.get(periodId);
    if (!period) throw new Error(`Unknown pay period ${periodId}`);
    return roundHours((period.hoursWorked + period.statutoryLeaveHoursCredited) * ACCRUAL_RATE);
  }

  private periodsOverlapping(workerId: string, from: Date, to: Date): PayPeriod[] {
    return [...this.periods.values()]
      .filter((period) => period.workerId === workerId)
      .filter((period) => overlapMs(period.startsOn, period.endsOn, from, to) > 0)
      .sort((a, b) => a.startsOn.getTime() - b.startsOn.getTime());
  }

  /**
   * The share of a pay period falling inside a window.
   *
   * A period straddling the leave-year boundary belongs partly to each year.
   * The period does not record hours per day, so the split is pro-rata on
   * elapsed time — an approximation, stated here rather than hidden, and a far
   * smaller error than assigning the whole period to one side.
   */
  private proportionInWindow(period: PayPeriod, from: Date, to: Date): number {
    const total = period.endsOn.getTime() - period.startsOn.getTime();
    if (total <= 0) return 0;
    return overlapMs(period.startsOn, period.endsOn, from, to) / total;
  }

  /**
   * The weeks in which the worker actually did something, which is the base for
   * their own average week. Dividing by every week in the year would give a
   * part-year worker an average of almost nothing and a cap to match.
   */
  private weeksWithHours(workerId: string, from: Date, to: Date): number {
    const weeks = new Set<number>();

    for (const period of this.periodsOverlapping(workerId, from, to)) {
      if (period.hoursWorked + period.statutoryLeaveHoursCredited <= 0) continue;

      let cursor = weekStartOf(new Date(Math.max(period.startsOn.getTime(), from.getTime())));
      const end = Math.min(period.endsOn.getTime(), to.getTime());
      while (cursor.getTime() < end) {
        weeks.add(cursor.getTime());
        cursor = new Date(cursor.getTime() + MS_PER_WEEK);
      }
    }
    return weeks.size;
  }

  /**
   * Accrual over a leave year, with the cap applied against the worker's own
   * average week.
   *
   * Somebody working all 52 weeks accrues 6.28 weeks by the formula and is
   * entitled to 5.6. The cap exists for exactly that person, and applying it
   * against a notional full-time week instead would cut a part-time worker's
   * entitlement for no reason.
   */
  accrual(workerId: string, leaveYearStart: Date): Accrual {
    const year = this.leaveYearContaining(workerId, leaveYearStart);

    let hoursWorked = 0;
    let credited = 0;

    for (const period of this.periodsOverlapping(workerId, year.startsOn, year.endsOn)) {
      const share = this.proportionInWindow(period, year.startsOn, year.endsOn);
      hoursWorked += period.hoursWorked * share;
      credited += period.statutoryLeaveHoursCredited * share;
    }

    const rawAccruedHours = roundHours((hoursWorked + credited) * ACCRUAL_RATE);
    const weeks = this.weeksWithHours(workerId, year.startsOn, year.endsOn);
    const averageWeeklyHours = weeks > 0 ? roundHours((hoursWorked + credited) / weeks) : 0;
    const capHours = roundHours(averageWeeklyHours * STATUTORY_LEAVE_WEEKS);

    const cappedAccruedHours = capHours > 0 ? roundHours(Math.min(rawAccruedHours, capHours)) : 0;

    return {
      workerId,
      leaveYearStart: year.startsOn,
      rawAccruedHours,
      cappedAccruedHours,
      capHours,
      capApplied: cappedAccruedHours < rawAccruedHours,
      hoursWorked: roundHours(hoursWorked),
      statutoryLeaveHoursCredited: roundHours(credited),
      averageWeeklyHours,
    };
  }

  /**
   * Leave applied to the year its dates fall in. Leave booked in March and
   * taken in April belongs to the year containing April, whatever the booking
   * screen said at the time.
   */
  leaveTakenInYear(workerId: string, leaveYearStart: Date): number {
    const year = this.leaveYearContaining(workerId, leaveYearStart);
    return roundHours(
      [...this.leave.values()]
        .filter((taken) => taken.workerId === workerId)
        .filter(
          (taken) =>
            taken.takenOn.getTime() >= year.startsOn.getTime() &&
            taken.takenOn.getTime() < year.endsOn.getTime(),
        )
        .reduce((sum, taken) => sum + taken.hours, 0),
    );
  }

  balance(workerId: string, leaveYearStart: Date): Balance {
    const year = this.leaveYearContaining(workerId, leaveYearStart);
    const accrued = this.accrual(workerId, year.startsOn).cappedAccruedHours;
    const carried = this.carriedIn.get(`${workerId}|${isoDate(year.startsOn)}`) ?? 0;
    const taken = this.leaveTakenInYear(workerId, year.startsOn);

    return {
      workerId,
      leaveYearStart: year.startsOn,
      accruedHours: accrued,
      carriedInHours: carried,
      takenHours: taken,
      remainingHours: roundHours(accrued + carried - taken),
    };
  }

  /**
   * Rolled-up holiday pay for one period: what was due, what was paid, and
   * whether it was itemised.
   *
   * Paying the right amount without showing it separately does not discharge
   * the obligation, so the arithmetic alone is not enough to pass.
   */
  periodCompliance(periodId: string): PeriodCompliance {
    const period = this.periods.get(periodId);
    if (!period) throw new Error(`Unknown pay period ${periodId}`);

    const accruedHours = this.accrualForPeriod(periodId);
    const duePence = roundPence(accruedHours * period.hourlyRatePence);
    const problems: NonCompliance[] = [];

    if (duePence > 0 && period.rolledUpPaidPence <= 0) {
      problems.push("ROLLED_UP_NOT_PAID");
    } else if (period.rolledUpPaidPence < duePence) {
      problems.push("ROLLED_UP_UNDERPAID");
    }

    if (duePence > 0 && !period.rolledUpItemised) {
      problems.push("ROLLED_UP_NOT_ITEMISED");
    }

    return {
      periodId,
      accruedHours,
      duePence,
      paidPence: period.rolledUpPaidPence,
      itemised: period.rolledUpItemised,
      compliant: problems.length === 0,
      problems,
    };
  }

  /** Every period for a worker that did not discharge the obligation. */
  nonCompliantPeriods(workerId: string): PeriodCompliance[] {
    return [...this.periods.values()]
      .filter((period) => period.workerId === workerId)
      .sort((a, b) => a.startsOn.getTime() - b.startsOn.getTime())
      .map((period) => this.periodCompliance(period.periodId))
      .filter((compliance) => !compliance.compliant);
  }

  /**
   * Pay and hours by week, apportioned from the pay periods. Weekly is the
   * granularity the reference period is defined in, and a fortnightly or
   * monthly period has to be spread across it rather than dropped into one week.
   */
  weeklyPay(workerId: string, from: Date, to: Date): WeeklyPay[] {
    const byWeek = new Map<number, WeeklyPay>();

    for (const period of this.periodsOverlapping(workerId, from, to)) {
      const totalMs = period.endsOn.getTime() - period.startsOn.getTime();
      if (totalMs <= 0) continue;

      let cursor = weekStartOf(period.startsOn);
      while (cursor.getTime() < period.endsOn.getTime()) {
        const weekEnd = new Date(cursor.getTime() + MS_PER_WEEK);
        const share = overlapMs(period.startsOn, period.endsOn, cursor, weekEnd) / totalMs;

        if (share > 0 && overlapMs(cursor, weekEnd, from, to) > 0) {
          const existing = byWeek.get(cursor.getTime()) ?? {
            weekStart: new Date(cursor.getTime()),
            grossPence: 0,
            hours: 0,
          };
          existing.grossPence += period.hoursWorked * period.hourlyRatePence * share;
          existing.hours += period.hoursWorked * share;
          byWeek.set(cursor.getTime(), existing);
        }
        cursor = weekEnd;
      }
    }

    return [...byWeek.values()]
      .map((week) => ({
        weekStart: week.weekStart,
        grossPence: roundPence(week.grossPence),
        hours: roundHours(week.hours),
      }))
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }

  /**
   * The reference period: the last 52 weeks in which the worker was actually
   * paid, looking back no further than 104 weeks.
   *
   * Weeks with no pay are skipped rather than averaged in as zero. A student
   * who worked one week in three would otherwise have an average weekly pay a
   * third of what they earn, which is the wrong number in the one calculation
   * where they cannot go back and query it.
   */
  referencePeriod(workerId: string, endingOn: Date): ReferencePeriod {
    const end = weekStartOf(endingOn);
    const from = new Date(end.getTime() - MAX_LOOKBACK_WEEKS * MS_PER_WEEK);

    const paidWeeks = this.weeklyPay(workerId, from, end).filter((week) => week.grossPence > 0);
    const weeks = paidWeeks.slice(-REFERENCE_WEEKS);

    // The weeks the lookback had to reach over to find its paid ones. Counted
    // from the earliest week actually used rather than from the full 104-week
    // window, so a worker who started in March is not reported as having had
    // fifty skipped weeks before they were employed.
    const earliest = weeks[0]?.weekStart;
    const spannedWeeks = earliest
      ? Math.round((end.getTime() - earliest.getTime()) / MS_PER_WEEK)
      : 0;
    const weeksSkipped = Math.max(0, spannedWeeks - weeks.length);

    const totalPence = weeks.reduce((sum, week) => sum + week.grossPence, 0);
    const totalHours = weeks.reduce((sum, week) => sum + week.hours, 0);

    return {
      weeks,
      weeksSkipped,
      averageWeeklyPayPence: weeks.length > 0 ? roundPence(totalPence / weeks.length) : 0,
      averageWeeklyHours: weeks.length > 0 ? roundHours(totalHours / weeks.length) : 0,
    };
  }

  /**
   * Payment in lieu of the untaken balance, at average weekly pay over the
   * reference period rather than at the rate in force on the last day.
   *
   * For a student whose rate rose in April these are different numbers, and the
   * average is the one they are owed.
   */
  terminationPayInLieu(workerId: string, terminationDate: Date): TerminationPayment {
    const year = this.leaveYearContaining(workerId, terminationDate);
    const balance = this.balance(workerId, year.startsOn);
    const reference = this.referencePeriod(workerId, terminationDate);

    const untakenHours = Math.max(0, balance.remainingHours);
    const weeksOwed =
      reference.averageWeeklyHours > 0
        ? roundHours(untakenHours / reference.averageWeeklyHours)
        : 0;
    const amountPence = roundPence(weeksOwed * reference.averageWeeklyPayPence);

    return {
      workerId,
      terminationDate,
      untakenHours,
      reference,
      weeksOwed,
      amountPence,
      reason:
        reference.weeks.length === 0
          ? "No paid weeks in the reference period, so no average could be struck"
          : `${untakenHours}h untaken is ${weeksOwed} weeks at an average of ${reference.averageWeeklyHours}h, ` +
            `paid at £${(reference.averageWeeklyPayPence / 100).toFixed(2)} a week over ${reference.weeks.length} paid weeks`,
    };
  }

  /**
   * What carries into the next year and what lapses at the boundary.
   *
   * Leave the worker was prevented from taking is not the same as leave they
   * did not get round to booking, and collapsing the two either gives away
   * entitlement that lapsed or takes away entitlement that did not.
   */
  carryOverAssessment(
    workerId: string,
    leaveYearStart: Date,
    options: { preventedHours?: number; agreedHours?: number } = {},
  ): CarryOverAssessment {
    const year = this.leaveYearContaining(workerId, leaveYearStart);
    const balance = this.balance(workerId, year.startsOn);
    const accrual = this.accrual(workerId, year.startsOn);
    const untakenHours = Math.max(0, balance.remainingHours);

    const preventedCap = roundHours(accrual.averageWeeklyHours * PREVENTED_CARRY_WEEKS);
    const agreedCap = roundHours(accrual.averageWeeklyHours * AGREED_CARRY_WEEKS);

    const prevented = Math.min(options.preventedHours ?? 0, untakenHours, preventedCap);
    const agreed = Math.min(
      options.agreedHours ?? 0,
      Math.max(0, untakenHours - prevented),
      agreedCap,
    );

    const carriedHours = roundHours(prevented + agreed);
    const lapsedHours = roundHours(untakenHours - carriedHours);
    const reasons: string[] = [];

    if (prevented > 0) {
      reasons.push(
        `${roundHours(prevented)}h carried as leave the worker was prevented from taking`,
      );
    }
    if (agreed > 0) {
      reasons.push(`${roundHours(agreed)}h carried by agreement`);
    }
    if (lapsedHours > 0) {
      reasons.push(
        `${lapsedHours}h lapsed at the end of the leave year on ${isoDate(year.endsOn)}`,
      );
    }
    if (reasons.length === 0) {
      reasons.push("No untaken balance at the end of the leave year");
    }

    return {
      workerId,
      leaveYearStart: year.startsOn,
      untakenHours,
      carriedHours,
      lapsedHours,
      reasons,
    };
  }
}
