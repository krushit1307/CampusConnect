/**
 * Module: Volunteer Competency Currency
 * File: src/services/volunteerCompetencyService.ts
 * Scope: Resolves whether a volunteer is current in a competency as at a given
 *        shift date, evaluates role requirements expressed as floors and
 *        attendance ratios at once, applies bounded supervision substitution,
 *        and reports each gap with the cheapest remedy that closes it (#5160).
 *
 * Holding a certificate and being current are different facts. The certificate
 * was awarded on a date; the currency it confers has a validity period, often a
 * grace period after expiry, and sometimes a refresher cycle shorter than the
 * original award. A boolean "qualified" column records the first fact and
 * answers questions about the second one wrongly, which is how somebody works a
 * year past their safeguarding renewal.
 *
 * The question is always asked about a future date. Rosters are built weeks
 * ahead, so a volunteer current today whose certificate expires before the
 * shift is not current for that shift, and one who is lapsed today with a
 * refresher booked before it is. Evaluating at "now" gets both cases backwards,
 * so every predicate here takes the date it is being asked about.
 *
 * Role requirements are floors and ratios simultaneously. A sports fixture
 * needs one first aider per hundred attendees, minimum one, and the minimum
 * does not scale down for a small crowd. Expressed as a list of badges the role
 * needs, the small event is over-staffed and the large one is under-staffed by
 * exactly the amount that matters.
 *
 * Supervision substitutes for currency, but only for competencies where that is
 * a real arrangement, only within the supervisor's ratio, and — for the ones
 * that carry a floor for a reason — only above that floor. Unbounded, it
 * produces a shift that is nominally compliant and is actually one current
 * person notionally supervising nine lapsed ones. Applied to the floor, it
 * produces a fixture whose only first aider is not a first aider.
 *
 * And a self-declared certificate nobody has looked at is not the same as one
 * whose evidence a member of staff has seen. Roles differ in which they will
 * accept, so the distinction is carried through rather than flattened at the
 * point the award is recorded.
 */

export type CurrencyStatus = "CURRENT" | "IN_GRACE" | "LAPSED" | "NEVER_HELD";

export type RemedyKind =
  "NONE" | "VERIFY_EVIDENCE" | "ADD_SUPERVISOR" | "BOOK_REFRESHER" | "ROSTER_CURRENT_HOLDER";

export interface Competency {
  competencyId: string;
  name: string;
  /** Calendar months from the award date. */
  validityMonths: number;
  /** Days after expiry during which work is still permitted. Zero means it stops dead. */
  graceDays: number;
  /** Whether a lapsed holder may work under supervision at all. */
  supervisable: boolean;
  /** How many lapsed holders one current holder can supervise at once. */
  supervisionRatio: number;
  /**
   * Whether supervised holders count towards the requirement's floor. False for
   * the competencies where the floor exists precisely so that somebody on site
   * actually holds it.
   */
  supervisionCoversFloor: boolean;
  safetyCritical: boolean;
}

export interface CompetencyAward {
  awardId: string;
  volunteerId: string;
  competencyId: string;
  awardedOn: Date;
  /** Whether a member of staff has actually seen the certificate. */
  verified: boolean;
  verifiedBy?: string;
}

export interface RefresherBooking {
  bookingId: string;
  volunteerId: string;
  competencyId: string;
  scheduledFor: Date;
}

export interface RoleRequirement {
  roleId: string;
  competencyId: string;
  /** The floor. Applies however small the event is. */
  minimumCount: number;
  /** One holder per this many attendees. Null where the requirement does not scale. */
  onePerAttendees: number | null;
  acceptsUnverifiedEvidence: boolean;
  supervisionPermitted: boolean;
}

export interface ShiftAssignment {
  volunteerId: string;
  /** Supervisors are the ones whose currency creates supervision capacity. */
  asSupervisor: boolean;
}

export interface Shift {
  shiftId: string;
  eventId: string;
  eventName: string;
  roleId: string;
  startsAt: Date;
  expectedAttendance: number;
  assignments: ShiftAssignment[];
}

export interface CurrencyResolution {
  volunteerId: string;
  competencyId: string;
  status: CurrencyStatus;
  /** Null where the competency has never been awarded. */
  expiresOn: Date | null;
  verified: boolean;
  /** Set where a booked refresher is what makes the holder current. */
  restoredByBookingId: string | null;
}

export interface RequirementFinding {
  competencyId: string;
  competencyName: string;
  requiredCount: number;
  /** Holders counting in their own right — current, or in grace where permitted. */
  outrightCount: number;
  /** Lapsed holders brought in under supervision, within the ratio. */
  supervisedCount: number;
  /** Assigned holders who could count if their evidence were verified. */
  unverifiedCount: number;
  shortfall: number;
  met: boolean;
  remedy: RemedyKind;
  remedyDetail: string;
  severity: number;
}

export interface ShiftCompliance {
  shiftId: string;
  eventId: string;
  roleId: string;
  startsAt: Date;
  compliant: boolean;
  findings: RequirementFinding[];
  worstSeverity: number;
}

/**
 * Calendar months, clamped at the end of the month. A certificate awarded on 31
 * August and valid for six months expires on 28 February, not on 3 March, and
 * rolling the overflow forward would hand somebody three extra days of currency
 * once a year.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetMonth = result.getUTCMonth() + months;
  const dayOfMonth = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(targetMonth);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth));

  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const REMEDY_ORDER: RemedyKind[] = [
  "NONE",
  "VERIFY_EVIDENCE",
  "ADD_SUPERVISOR",
  "BOOK_REFRESHER",
  "ROSTER_CURRENT_HOLDER",
];

export class VolunteerCompetencyService {
  private readonly competencies = new Map<string, Competency>();
  private readonly awards: CompetencyAward[] = [];
  private readonly refreshers: RefresherBooking[] = [];
  private readonly requirements: RoleRequirement[] = [];

  registerCompetency(competency: Competency): void {
    if (competency.validityMonths <= 0) {
      throw new Error(`Competency ${competency.competencyId} must have a positive validity period`);
    }
    this.competencies.set(competency.competencyId, competency);
  }

  recordAward(award: CompetencyAward): void {
    this.awards.push(award);
  }

  bookRefresher(booking: RefresherBooking): void {
    this.refreshers.push(booking);
  }

  addRoleRequirement(requirement: RoleRequirement): void {
    this.requirements.push(requirement);
  }

  requirementsForRole(roleId: string): RoleRequirement[] {
    return this.requirements.filter((requirement) => requirement.roleId === roleId);
  }

  /**
   * Currency as at a date, not as at now. The latest award is the one that
   * counts — a refresher awarded in March supersedes the original from three
   * years ago rather than sitting alongside it.
   */
  resolveCurrency(volunteerId: string, competencyId: string, asOf: Date): CurrencyResolution {
    const competency = this.competencies.get(competencyId);
    if (!competency) {
      throw new Error(`Unknown competency ${competencyId}`);
    }

    const held = this.awards
      .filter((award) => award.volunteerId === volunteerId && award.competencyId === competencyId)
      .sort((a, b) => b.awardedOn.getTime() - a.awardedOn.getTime());

    // A refresher sat before the shift date restores currency from the day it
    // is taken, which is the whole reason it was booked.
    const restoring = this.refreshers
      .filter(
        (booking) =>
          booking.volunteerId === volunteerId &&
          booking.competencyId === competencyId &&
          booking.scheduledFor.getTime() <= asOf.getTime(),
      )
      .sort((a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime())[0];

    const latest = held[0] ?? null;

    if (restoring) {
      const restoredExpiry = addMonths(restoring.scheduledFor, competency.validityMonths);
      if (asOf.getTime() < restoredExpiry.getTime()) {
        return {
          volunteerId,
          competencyId,
          status: "CURRENT",
          expiresOn: restoredExpiry,
          // A refresher is only bookable against a competency already held, and
          // an unverified original stays unverified until somebody looks at it.
          verified: latest?.verified ?? false,
          restoredByBookingId: restoring.bookingId,
        };
      }
    }

    if (!latest) {
      return {
        volunteerId,
        competencyId,
        status: "NEVER_HELD",
        expiresOn: null,
        verified: false,
        restoredByBookingId: null,
      };
    }

    const expiresOn = addMonths(latest.awardedOn, competency.validityMonths);
    const graceEndsOn = addDays(expiresOn, competency.graceDays);

    let status: CurrencyStatus;
    if (asOf.getTime() < expiresOn.getTime()) {
      status = "CURRENT";
    } else if (competency.graceDays > 0 && asOf.getTime() < graceEndsOn.getTime()) {
      status = "IN_GRACE";
    } else {
      status = "LAPSED";
    }

    return {
      volunteerId,
      competencyId,
      status,
      expiresOn,
      verified: latest.verified,
      restoredByBookingId: null,
    };
  }

  /**
   * The floor and the ratio at once. A fixture for forty people still needs the
   * minimum; one for two hundred and fifty needs three, not one.
   */
  requiredCountFor(requirement: RoleRequirement, expectedAttendance: number): number {
    const fromRatio = requirement.onePerAttendees
      ? Math.ceil(expectedAttendance / requirement.onePerAttendees)
      : 0;
    return Math.max(requirement.minimumCount, fromRatio);
  }

  private evaluateRequirement(requirement: RoleRequirement, shift: Shift): RequirementFinding {
    const competency = this.competencies.get(requirement.competencyId);
    if (!competency) {
      throw new Error(`Unknown competency ${requirement.competencyId}`);
    }

    const requiredCount = this.requiredCountFor(requirement, shift.expectedAttendance);

    const resolutions = shift.assignments.map((assignment) => ({
      assignment,
      resolution: this.resolveCurrency(
        assignment.volunteerId,
        requirement.competencyId,
        shift.startsAt,
      ),
    }));

    const usable = resolutions.filter(({ resolution }) => {
      if (resolution.status === "LAPSED" || resolution.status === "NEVER_HELD") return false;
      if (!resolution.verified && !requirement.acceptsUnverifiedEvidence) return false;
      return true;
    });

    // Counted separately so the remedy can distinguish "nobody holds this" from
    // "somebody holds it and nobody has looked at the certificate".
    const unverifiedCount = resolutions.filter(
      ({ resolution }) =>
        !resolution.verified &&
        !requirement.acceptsUnverifiedEvidence &&
        (resolution.status === "CURRENT" || resolution.status === "IN_GRACE"),
    ).length;

    const outrightCount = usable.length;

    const supervisorCapacity =
      competency.supervisable && requirement.supervisionPermitted
        ? usable.filter(
            ({ assignment, resolution }) =>
              assignment.asSupervisor && resolution.status === "CURRENT",
          ).length * competency.supervisionRatio
        : 0;

    const lapsedHolders = resolutions.filter(
      ({ resolution }) => resolution.status === "LAPSED",
    ).length;

    const supervisedCount = Math.min(lapsedHolders, supervisorCapacity);

    const countedTowardsTotal = outrightCount + supervisedCount;
    // Supervision reaches the floor only where the competency says it may. A
    // fixture whose sole first aider is supervised has no first aider.
    const countedTowardsFloor = competency.supervisionCoversFloor
      ? countedTowardsTotal
      : outrightCount;

    const totalShortfall = Math.max(0, requiredCount - countedTowardsTotal);
    const floorShortfall = Math.max(0, requirement.minimumCount - countedTowardsFloor);
    const shortfall = Math.max(totalShortfall, floorShortfall);
    const met = shortfall === 0;

    let remedy: RemedyKind = "NONE";
    let remedyDetail = "Requirement met";

    if (!met) {
      if (unverifiedCount >= shortfall) {
        remedy = "VERIFY_EVIDENCE";
        remedyDetail = `${unverifiedCount} assigned holder(s) would count once their evidence is verified`;
      } else if (
        floorShortfall === 0 &&
        competency.supervisable &&
        requirement.supervisionPermitted &&
        lapsedHolders > supervisedCount
      ) {
        remedy = "ADD_SUPERVISOR";
        remedyDetail = `${lapsedHolders - supervisedCount} lapsed holder(s) are beyond the supervision ratio of ${competency.supervisionRatio}`;
      } else if (lapsedHolders > 0) {
        remedy = "BOOK_REFRESHER";
        remedyDetail = `${lapsedHolders} assigned holder(s) have lapsed before the shift date`;
      } else {
        remedy = "ROSTER_CURRENT_HOLDER";
        remedyDetail = `${shortfall} more current holder(s) of ${competency.name} needed on this shift`;
      }
    }

    return {
      competencyId: requirement.competencyId,
      competencyName: competency.name,
      requiredCount,
      outrightCount,
      supervisedCount,
      unverifiedCount,
      shortfall,
      met,
      remedy,
      remedyDetail,
      severity: met ? 0 : (competency.safetyCritical ? 100 : 40) + shortfall,
    };
  }

  /**
   * The whole question for one shift. Gaps come back ranked so a missing first
   * aider is read before an unverified food hygiene certificate.
   */
  assessShift(shift: Shift): ShiftCompliance {
    const findings = this.requirementsForRole(shift.roleId)
      .map((requirement) => this.evaluateRequirement(requirement, shift))
      .sort(
        (a, b) =>
          b.severity - a.severity ||
          REMEDY_ORDER.indexOf(a.remedy) - REMEDY_ORDER.indexOf(b.remedy) ||
          a.competencyId.localeCompare(b.competencyId),
      );

    return {
      shiftId: shift.shiftId,
      eventId: shift.eventId,
      roleId: shift.roleId,
      startsAt: shift.startsAt,
      compliant: findings.every((finding) => finding.met),
      findings,
      worstSeverity: findings.reduce((worst, finding) => Math.max(worst, finding.severity), 0),
    };
  }

  /**
   * The same assessment across a roster, keeping only the shifts that need
   * something doing and putting the ones that need it soonest and worst first.
   */
  assessRoster(shifts: Shift[]): ShiftCompliance[] {
    return shifts
      .map((shift) => this.assessShift(shift))
      .filter((compliance) => !compliance.compliant)
      .sort(
        (a, b) => b.worstSeverity - a.worstSeverity || a.startsAt.getTime() - b.startsAt.getTime(),
      );
  }

  /**
   * Everyone whose currency runs out inside a window, so refreshers are booked
   * before the shifts are, rather than after somebody notices on the night.
   */
  expiringBetween(
    from: Date,
    to: Date,
  ): Array<{ volunteerId: string; competencyId: string; expiresOn: Date }> {
    const seen = new Set<string>();
    const expiring: Array<{ volunteerId: string; competencyId: string; expiresOn: Date }> = [];

    for (const award of this.awards) {
      const key = `${award.volunteerId}:${award.competencyId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const resolution = this.resolveCurrency(award.volunteerId, award.competencyId, from);
      if (!resolution.expiresOn) continue;
      if (
        resolution.expiresOn.getTime() >= from.getTime() &&
        resolution.expiresOn.getTime() < to.getTime()
      ) {
        expiring.push({
          volunteerId: award.volunteerId,
          competencyId: award.competencyId,
          expiresOn: resolution.expiresOn,
        });
      }
    }

    return expiring.sort((a, b) => a.expiresOn.getTime() - b.expiresOn.getTime());
  }
}
