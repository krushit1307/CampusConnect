/**
 * Module: Student Visa Work-Hour Compliance
 * File: src/services/studentVisaWorkHoursService.ts
 * Scope: Resolves the weekly work-hour cap from the student's own programme
 *        calendar, aggregates rostered and worked hours across every rota the
 *        student appears on, splits shifts that straddle a week boundary or a
 *        term/vacation boundary, checks right-to-work evidence as at the shift
 *        date, and separates breaches that can still be prevented from those
 *        already worked (#5257).
 *
 * The platform rosters students onto paid work and calculates what they are
 * owed for it. It has never asked the prior question of whether the student is
 * permitted to work those hours, and that question has a different answer for
 * different students in the same week.
 *
 * The cap is weekly and it is not an average. Twenty-five hours one week and
 * fifteen the next is a breach followed by a compliant week, not an average of
 * twenty. Averaging is the single most common way a rota system reports
 * compliance it does not have.
 *
 * It is also a cap on the aggregate. A student doing twelve hours behind the
 * bar and ten as a coaching assistant has breached it, and neither rota shows
 * the breach because neither rota knows about the other. Aggregation across
 * employers is the whole point; a per-rota check is a check that cannot fail
 * in the case that actually occurs.
 *
 * Term dates are per programme, not per institution. A student whose vacation
 * starts a fortnight before the standard calendar is unrestricted in a week
 * where their coursemates are capped, so the cap is resolved against the
 * student's own calendar and never against a global one.
 *
 * A shift does not respect either boundary. A Sunday night bar shift ending at
 * 02:00 lands in two weeks and contributes to both; a shift on the last day of
 * term is part restricted and part not. Both are handled by intersecting the
 * shift with the week and then with the term periods, rather than by asking
 * which week or which period the shift "is in", which is a question with no
 * correct answer.
 *
 * And right to work expires. A booking made in October for a shift in February
 * is checked today against a visa that will have run out by then, so evidence
 * is evaluated as at the date of the shift with the margin reported.
 *
 * Where the programme calendar does not cover a moment, that moment is treated
 * as term time. The conservative direction is the one that constrains, and the
 * gap is reported through `calendarGaps` rather than being silently resolved.
 */

export type ImmigrationStatus =
  /** Student route. Capped in term time, unrestricted in vacation. */
  | "STUDENT_VISA"
  /** Short-term study. No work permitted at all. */
  | "SHORT_TERM_STUDY"
  /** Graduate route, settled status, or a national with no restriction. */
  | "UNRESTRICTED";

export type StudyLevel = "DEGREE_OR_ABOVE" | "BELOW_DEGREE";

export type TermPeriodKind = "TERM" | "VACATION";

export type ShiftState = "ROSTERED" | "WORKED" | "CANCELLED";

export type RightToWorkDocumentType =
  "PASSPORT" | "BIOMETRIC_RESIDENCE_PERMIT" | "SHARE_CODE" | "VISA_VIGNETTE";

export type BlockerKind =
  | "WORK_NOT_PERMITTED"
  | "WEEKLY_CAP_EXCEEDED"
  | "NO_RIGHT_TO_WORK_EVIDENCE"
  | "RIGHT_TO_WORK_EXPIRED";

export type BreachTiming = "ALREADY_WORKED" | "STILL_PREVENTABLE";

export interface StudentWorker {
  workerId: string;
  programmeId: string;
  status: ImmigrationStatus;
  studyLevel: StudyLevel;
}

export interface RightToWorkDocument {
  workerId: string;
  type: RightToWorkDocumentType;
  /** The date the institution actually performed the check. */
  checkedOn: Date;
  /** Null for evidence that does not expire, such as a settled-status share code. */
  expiresOn: Date | null;
}

export interface TermPeriod {
  programmeId: string;
  kind: TermPeriodKind;
  startsOn: Date;
  /** Exclusive. A period ending on the 1st does not include the 1st. */
  endsOn: Date;
}

export interface Shift {
  shiftId: string;
  workerId: string;
  /** Distinct employers within the institution: the bar, the sports centre, a department. */
  employerId: string;
  rotaId: string;
  startsAt: Date;
  endsAt: Date;
  state: ShiftState;
}

export interface Blocker {
  kind: BlockerKind;
  detail: string;
  remedy: string;
}

/** The part of a shift that falls in one week, split into restricted and not. */
export interface ShiftSegment {
  shiftId: string;
  employerId: string;
  weekStart: Date;
  restrictedHours: number;
  unrestrictedHours: number;
}

export interface WeeklyLoad {
  workerId: string;
  weekStart: Date;
  /** Term-time hours, which are the ones the cap applies to. */
  restrictedHours: number;
  /** Vacation hours, which are uncapped but still worth reporting. */
  unrestrictedHours: number;
  /** Null where the worker has no cap at all. */
  capHours: number | null;
  /** Null where there is no cap. Never negative; a breach is reported separately. */
  headroomHours: number | null;
  employerIds: string[];
}

export interface ShiftAssessment {
  shiftId: string;
  workerId: string;
  permitted: boolean;
  blockers: Blocker[];
  /** Per week the shift touches, the load that would result if it were confirmed. */
  resultingLoad: WeeklyLoad[];
}

export interface Breach {
  workerId: string;
  weekStart: Date;
  restrictedHours: number;
  capHours: number;
  excessHours: number;
  timing: BreachTiming;
  /** Every employer contributing to the week, because the breach belongs to none of them alone. */
  employerIds: string[];
}

export interface CalendarGap {
  programmeId: string;
  from: Date;
  to: Date;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/** Degree-level study on the Student route. */
const DEGREE_LEVEL_CAP_HOURS = 20;
/** Below degree level carries the lower cap. */
const BELOW_DEGREE_CAP_HOURS = 10;

function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

/**
 * Monday 00:00 UTC of the week containing the instant. The cap is a weekly cap
 * and every aggregation in here keys on this, so it is defined once.
 */
export function weekStartOf(instant: Date): Date {
  const day = new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );
  // getUTCDay is 0 for Sunday, which is the end of the week rather than the start.
  const offsetDays = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offsetDays * MS_PER_DAY);
}

function roundHours(ms: number): number {
  return Math.round((ms / MS_PER_HOUR) * 1000) / 1000;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class StudentVisaWorkHoursService {
  private readonly workers = new Map<string, StudentWorker>();
  private readonly documents: RightToWorkDocument[] = [];
  private readonly termPeriods: TermPeriod[] = [];
  private readonly shifts = new Map<string, Shift>();

  registerWorker(worker: StudentWorker): void {
    this.workers.set(worker.workerId, worker);
  }

  registerDocument(document: RightToWorkDocument): void {
    this.documents.push(document);
  }

  registerTermPeriod(period: TermPeriod): void {
    if (period.endsOn.getTime() <= period.startsOn.getTime()) {
      throw new Error("A term period must end after it starts");
    }
    this.termPeriods.push(period);
  }

  /** Idempotent by shift id so a rota can be replayed without double counting. */
  recordShift(shift: Shift): void {
    if (shift.endsAt.getTime() <= shift.startsAt.getTime()) {
      throw new Error(`Shift ${shift.shiftId} must end after it starts`);
    }
    this.shifts.set(shift.shiftId, shift);
  }

  private requireWorker(workerId: string): StudentWorker {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Unknown worker ${workerId}`);
    return worker;
  }

  /**
   * The cap the worker carries in term time, or null where they carry none.
   * Short-term study is a cap of zero rather than an absence of one, because
   * zero and "unrestricted" must not collapse into the same branch.
   */
  capFor(workerId: string): number | null {
    const worker = this.requireWorker(workerId);
    switch (worker.status) {
      case "UNRESTRICTED":
        return null;
      case "SHORT_TERM_STUDY":
        return 0;
      case "STUDENT_VISA":
        return worker.studyLevel === "DEGREE_OR_ABOVE"
          ? DEGREE_LEVEL_CAP_HOURS
          : BELOW_DEGREE_CAP_HOURS;
    }
  }

  private periodsFor(programmeId: string): TermPeriod[] {
    return this.termPeriods
      .filter((period) => period.programmeId === programmeId)
      .sort((a, b) => a.startsOn.getTime() - b.startsOn.getTime());
  }

  /**
   * The hours of an interval that fall in term time for this programme.
   *
   * Anything the calendar does not cover is term time. The alternative — take
   * uncovered time as vacation — makes a missing calendar look like compliance,
   * which is the failure mode worth designing against. The gaps are reported
   * separately so the omission is visible rather than merely safe.
   */
  private restrictedHoursIn(programmeId: string, start: Date, end: Date): number {
    const total = Math.max(0, end.getTime() - start.getTime());
    if (total === 0) return 0;

    const vacationMs = this.periodsFor(programmeId)
      .filter((period) => period.kind === "VACATION")
      .reduce((sum, period) => sum + overlapMs(start, end, period.startsOn, period.endsOn), 0);

    return roundHours(total - vacationMs);
  }

  /**
   * Splits one shift into its per-week parts, each divided into restricted and
   * unrestricted hours.
   *
   * A Sunday bar shift ending at 02:00 belongs to two weeks. Asking which week
   * it is "in" has no correct answer, so it is intersected with each week it
   * touches instead.
   */
  segmentsFor(shift: Shift): ShiftSegment[] {
    const worker = this.requireWorker(shift.workerId);
    const segments: ShiftSegment[] = [];

    let cursor = weekStartOf(shift.startsAt);
    const last = weekStartOf(new Date(shift.endsAt.getTime() - 1));

    while (cursor.getTime() <= last.getTime()) {
      const weekEnd = new Date(cursor.getTime() + MS_PER_WEEK);
      const start = new Date(Math.max(shift.startsAt.getTime(), cursor.getTime()));
      const end = new Date(Math.min(shift.endsAt.getTime(), weekEnd.getTime()));

      if (end.getTime() > start.getTime()) {
        const totalHours = roundHours(end.getTime() - start.getTime());
        const restrictedHours = this.restrictedHoursIn(worker.programmeId, start, end);
        segments.push({
          shiftId: shift.shiftId,
          employerId: shift.employerId,
          weekStart: new Date(cursor.getTime()),
          restrictedHours,
          unrestrictedHours: Math.round((totalHours - restrictedHours) * 1000) / 1000,
        });
      }

      cursor = weekEnd;
    }

    return segments;
  }

  private countableShifts(workerId: string, extra: Shift[] = []): Shift[] {
    const stored = [...this.shifts.values()].filter(
      (shift) => shift.workerId === workerId && shift.state !== "CANCELLED",
    );
    const extras = extra.filter(
      (shift) => shift.workerId === workerId && shift.state !== "CANCELLED",
    );
    // An extra carrying an id already stored is a re-assessment of that shift,
    // not a second one alongside it.
    const extraIds = new Set(extras.map((shift) => shift.shiftId));
    return [...stored.filter((shift) => !extraIds.has(shift.shiftId)), ...extras];
  }

  /**
   * The load in one week across every rota the student appears on. This is the
   * aggregation the per-rota checks cannot do: twelve hours at the bar and ten
   * at the sports centre is a breach that neither rota can see.
   */
  weeklyLoad(workerId: string, weekStart: Date, extra: Shift[] = []): WeeklyLoad {
    const week = weekStartOf(weekStart);
    const cap = this.capFor(workerId);

    const segments = this.countableShifts(workerId, extra)
      .flatMap((shift) => this.segmentsFor(shift))
      .filter((segment) => segment.weekStart.getTime() === week.getTime());

    const restrictedHours =
      Math.round(segments.reduce((sum, s) => sum + s.restrictedHours, 0) * 1000) / 1000;
    const unrestrictedHours =
      Math.round(segments.reduce((sum, s) => sum + s.unrestrictedHours, 0) * 1000) / 1000;

    return {
      workerId,
      weekStart: week,
      restrictedHours,
      unrestrictedHours,
      capHours: cap,
      headroomHours:
        cap === null ? null : Math.max(0, Math.round((cap - restrictedHours) * 1000) / 1000),
      employerIds: [...new Set(segments.map((segment) => segment.employerId))].sort(),
    };
  }

  /**
   * Right-to-work evidence as at the date of the shift rather than as at now.
   * A booking made in October for a February shift is otherwise checked against
   * a visa that will have run out by the time it is worked.
   */
  rightToWorkBlockers(workerId: string, asAt: Date): Blocker[] {
    const documents = this.documents.filter((document) => document.workerId === workerId);

    if (documents.length === 0) {
      return [
        {
          kind: "NO_RIGHT_TO_WORK_EVIDENCE",
          detail: `No right-to-work check is recorded for ${workerId}`,
          remedy: "Complete and record a right-to-work check before rostering any shift",
        },
      ];
    }

    const valid = documents.filter(
      (document) =>
        document.checkedOn.getTime() <= asAt.getTime() &&
        (document.expiresOn === null || document.expiresOn.getTime() > asAt.getTime()),
    );
    if (valid.length > 0) return [];

    const latestExpiry = documents
      .filter((document) => document.expiresOn !== null)
      .sort((a, b) => (b.expiresOn as Date).getTime() - (a.expiresOn as Date).getTime())[0];

    return [
      {
        kind: "RIGHT_TO_WORK_EXPIRED",
        detail: latestExpiry
          ? `Right-to-work evidence expires on ${isoDate(latestExpiry.expiresOn as Date)}, before the shift on ${isoDate(asAt)}`
          : `No right-to-work evidence is in force on ${isoDate(asAt)}`,
        remedy: `Record a follow-up check valid on ${isoDate(asAt)} before the shift is worked`,
      },
    ];
  }

  /**
   * Assesses a shift before it is confirmed, against the weeks it would land
   * in once every other rota is taken into account.
   */
  assessProposedShift(shift: Shift): ShiftAssessment {
    const worker = this.requireWorker(shift.workerId);
    const blockers: Blocker[] = [...this.rightToWorkBlockers(shift.workerId, shift.startsAt)];

    const segments = this.segmentsFor(shift);
    const weeks = [...new Set(segments.map((segment) => segment.weekStart.getTime()))].sort();
    const resultingLoad = weeks.map((week) =>
      this.weeklyLoad(shift.workerId, new Date(week), [shift]),
    );

    const cap = this.capFor(shift.workerId);

    if (worker.status === "SHORT_TERM_STUDY") {
      const restricted = segments.reduce((sum, s) => sum + s.restrictedHours, 0);
      const unrestricted = segments.reduce((sum, s) => sum + s.unrestrictedHours, 0);
      if (restricted + unrestricted > 0) {
        blockers.push({
          kind: "WORK_NOT_PERMITTED",
          detail: `${shift.workerId} is here on short-term study, which permits no work at all`,
          remedy: "Remove the shift; no cap applies because no work is permitted",
        });
      }
    } else if (cap !== null) {
      for (const load of resultingLoad) {
        if (load.restrictedHours > cap) {
          const excess = Math.round((load.restrictedHours - cap) * 1000) / 1000;
          blockers.push({
            kind: "WEEKLY_CAP_EXCEEDED",
            detail:
              `Week of ${isoDate(load.weekStart)} would reach ${load.restrictedHours}h of term-time work ` +
              `against a ${cap}h cap, across ${load.employerIds.join(", ")}`,
            remedy: `Reduce this shift by ${excess}h, move it into vacation, or drop hours on another rota that week`,
          });
        }
      }
    }

    return {
      shiftId: shift.shiftId,
      workerId: shift.workerId,
      permitted: blockers.length === 0,
      blockers,
      resultingLoad,
    };
  }

  /** The hours still available in a week, across all rotas. Null where uncapped. */
  headroom(workerId: string, weekStart: Date): number | null {
    return this.weeklyLoad(workerId, weekStart).headroomHours;
  }

  /**
   * Breaches over a range, split by whether they can still be prevented.
   *
   * The two need different responses. A week still in the future is a rota to
   * change; a week already worked is a sponsor-duty reporting decision, and
   * reporting it as though it were preventable loses the only fact that
   * mattered about it.
   */
  detectBreaches(workerId: string, from: Date, to: Date, asOf: Date): Breach[] {
    const cap = this.capFor(workerId);
    if (cap === null) return [];

    const breaches: Breach[] = [];
    let cursor = weekStartOf(from);
    const last = weekStartOf(to);

    while (cursor.getTime() <= last.getTime()) {
      const load = this.weeklyLoad(workerId, cursor);
      if (load.restrictedHours > cap) {
        const weekEnd = new Date(cursor.getTime() + MS_PER_WEEK);
        const worked = this.countableShifts(workerId).some(
          (shift) =>
            shift.state === "WORKED" &&
            overlapMs(shift.startsAt, shift.endsAt, cursor, weekEnd) > 0,
        );
        breaches.push({
          workerId,
          weekStart: new Date(cursor.getTime()),
          restrictedHours: load.restrictedHours,
          capHours: cap,
          excessHours: Math.round((load.restrictedHours - cap) * 1000) / 1000,
          timing:
            worked || weekEnd.getTime() <= asOf.getTime() ? "ALREADY_WORKED" : "STILL_PREVENTABLE",
          employerIds: load.employerIds,
        });
      }
      cursor = new Date(cursor.getTime() + MS_PER_WEEK);
    }

    return breaches;
  }

  /**
   * The stretches a programme calendar does not cover, so a missing calendar
   * shows up as a missing calendar rather than as twenty compliant weeks.
   */
  calendarGaps(programmeId: string, from: Date, to: Date): CalendarGap[] {
    const covered = this.periodsFor(programmeId)
      .filter((period) => overlapMs(period.startsOn, period.endsOn, from, to) > 0)
      .map((period) => ({
        start: Math.max(period.startsOn.getTime(), from.getTime()),
        end: Math.min(period.endsOn.getTime(), to.getTime()),
      }))
      .sort((a, b) => a.start - b.start);

    const gaps: CalendarGap[] = [];
    let cursor = from.getTime();

    for (const span of covered) {
      if (span.start > cursor) {
        gaps.push({ programmeId, from: new Date(cursor), to: new Date(span.start) });
      }
      cursor = Math.max(cursor, span.end);
    }
    if (cursor < to.getTime()) {
      gaps.push({ programmeId, from: new Date(cursor), to: new Date(to.getTime()) });
    }

    return gaps;
  }
}
