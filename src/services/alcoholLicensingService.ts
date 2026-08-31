/**
 * Module: Alcohol Licensing Compliance
 * File: src/services/alcoholLicensingService.ts
 * Scope: Evaluates an event against the premises licence in force — permitted
 *        hours that cross midnight, capacity conditions, designated premises
 *        supervisor and door supervisor conditions, activity restrictions — or,
 *        where the event falls outside it, against the Temporary Event Notice
 *        allowance and all of its interacting counters (#5161).
 *
 * The licence conditions are a two-page annex nobody has read since the last
 * review hearing, and the TEN allowance is a set of counters that exists only
 * in the head of the general manager. The platform publishes the event and
 * takes the ticket money without either being consulted.
 *
 * Permitted hours cross midnight, and the licence knows it. A period of 11:00
 * to 02:00 is one period, not two, and an event running 22:00 to 01:00 sits
 * inside it. Comparing clock times without normalising across the boundary
 * rejects the compliant event and accepts the one starting at 03:00, so hours
 * are held here as minutes from the start of the week and a period simply runs
 * past the end of its day.
 *
 * Capacity is three numbers and the smallest one is real. A licence condition
 * capping the licensable area at 250 is independent of the fire capacity of 400
 * and of the number of tickets put on sale, and the ticketing system currently
 * knows one of the three. Which one binds is returned with the answer, because
 * the argument that follows is always about whose number it was.
 *
 * A condition can require a person, and a person has to actually be there. "A
 * DPS must be on the premises" is satisfiable only by a named individual whose
 * personal licence is in force on that date and who is on the roster for that
 * event. A licence held by somebody on holiday is not a DPS on the premises.
 *
 * The TEN counters interact, and each of them is capable of being the one that
 * bites. Notices per premises per year, days per premises per year, days per
 * notice, a lower ceiling for a giver who holds no personal licence, and a
 * minimum interval between notices at the same premises — a committee planning
 * a summer series exhausts one of these in May and finds out in June. Counting
 * notices without counting days, or counting days without attributing them to
 * the right giver, produces a different wrong answer each time.
 */

export type ComplianceRoute = "PREMISES_LICENCE" | "TEN_REQUIRED" | "UNLICENSED";

export type BreachKind =
  | "OUTSIDE_PERMITTED_HOURS"
  | "CAPACITY_EXCEEDED"
  | "NO_DPS_ON_PREMISES"
  | "DPS_LICENCE_NOT_IN_FORCE"
  | "INSUFFICIENT_DOOR_SUPERVISORS"
  | "ACTIVITY_RESTRICTED"
  | "NO_LICENCE_FOR_PREMISES";

export type TenCounter =
  | "NOTICES_PER_PREMISES"
  | "DAYS_PER_PREMISES"
  | "DAYS_PER_NOTICE"
  | "NOTICES_PER_GIVER"
  | "MINIMUM_INTERVAL";

export type CapacitySource = "LICENCE_CONDITION" | "PHYSICAL_CAPACITY" | "TICKET_ALLOCATION";

/** Minutes from midnight. An end past 1440 is a period that runs into the next day. */
export interface LicensedPeriod {
  /** 0 is Sunday, matching Date#getUTCDay. The day the period *starts*. */
  startDay: number;
  startMinute: number;
  endMinute: number;
}

export interface CapacityCondition {
  kind: "CAPACITY";
  conditionId: string;
  maxOccupancy: number;
}

export interface DpsCondition {
  kind: "DPS_PRESENT";
  conditionId: string;
}

export interface DoorSupervisorCondition {
  kind: "DOOR_SUPERVISORS";
  conditionId: string;
  /** Below this headcount the condition does not bite at all. */
  thresholdHeadcount: number;
  onePerHeadcount: number;
}

export interface ActivityRestrictionCondition {
  kind: "ACTIVITY_RESTRICTION";
  conditionId: string;
  activity: string;
  /** Minutes from midnight on the day the event starts. */
  notAfterMinute: number;
}

export type LicenceCondition =
  CapacityCondition | DpsCondition | DoorSupervisorCondition | ActivityRestrictionCondition;

export interface PremisesLicence {
  licenceId: string;
  premisesId: string;
  permittedPeriods: LicensedPeriod[];
  conditions: LicenceCondition[];
}

export interface PersonalLicence {
  holderId: string;
  validFrom: Date;
  validTo: Date;
}

export interface RosteredPerson {
  personId: string;
  role: "DPS" | "DOOR_SUPERVISOR" | "BAR_STAFF";
}

export interface EventActivity {
  activity: string;
  /** Minutes from midnight on the event's start day. */
  endsAtMinute: number;
}

export interface LicensableEvent {
  eventId: string;
  premisesId: string;
  startsAt: Date;
  endsAt: Date;
  physicalCapacity: number;
  ticketAllocation: number;
  expectedHeadcount: number;
  roster: RosteredPerson[];
  activities: EventActivity[];
}

export interface Breach {
  kind: BreachKind;
  conditionId: string | null;
  detail: string;
  remedy: string;
}

export interface CapacityDetermination {
  bindingCapacity: number;
  source: CapacitySource;
}

export interface LicenceAssessment {
  eventId: string;
  lawful: boolean;
  route: ComplianceRoute;
  licenceId: string | null;
  capacity: CapacityDetermination;
  breaches: Breach[];
}

export interface TemporaryEventNotice {
  noticeId: string;
  premisesId: string;
  givenBy: string;
  giverHoldsPersonalLicence: boolean;
  from: Date;
  to: Date;
  withdrawn?: boolean;
}

export interface TenLimits {
  noticesPerPremisesPerYear: number;
  daysPerPremisesPerYear: number;
  maxDaysPerNotice: number;
  noticesPerPersonalLicenceHolderPerYear: number;
  noticesPerOtherGiverPerYear: number;
  minimumIntervalDays: number;
}

export interface TenCounterState {
  counter: TenCounter;
  used: number;
  limit: number;
  wouldBecome: number;
}

export interface TenAssessment {
  permitted: boolean;
  exhausted: TenCounter | null;
  counters: TenCounterState[];
  detail: string;
}

export interface AmendmentAssessment {
  wasLawful: boolean;
  isLawful: boolean;
  /** Breaches introduced by the amendment, as opposed to ones already present. */
  introduced: Breach[];
  resolved: Breach[];
}

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Minutes from the start of the week (Sunday 00:00 UTC). */
export function weekMinute(date: Date): number {
  return date.getUTCDay() * MINUTES_PER_DAY + date.getUTCHours() * 60 + date.getUTCMinutes();
}

function minuteOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

/** Days a notice covers, counting both the first and the last. */
export function daysCovered(from: Date, to: Date): number {
  return dayNumber(to) - dayNumber(from) + 1;
}

export class AlcoholLicensingService {
  private readonly licences = new Map<string, PremisesLicence>();
  private readonly personalLicences = new Map<string, PersonalLicence>();
  private readonly notices: TemporaryEventNotice[] = [];

  constructor(private readonly limits: TenLimits) {}

  registerLicence(licence: PremisesLicence): void {
    this.licences.set(licence.premisesId, licence);
  }

  registerPersonalLicence(licence: PersonalLicence): void {
    this.personalLicences.set(licence.holderId, licence);
  }

  recordNotice(notice: TemporaryEventNotice): void {
    this.notices.push(notice);
  }

  licenceFor(premisesId: string): PremisesLicence | null {
    return this.licences.get(premisesId) ?? null;
  }

  /**
   * Whether an event's window sits inside one permitted period. Periods are
   * held as minutes from the start of the week and may run past the end of
   * their day, so 11:00–02:00 is one period and an event from 22:00 to 01:00 is
   * inside it. The week wraps, so a Saturday-night period reaching into Sunday
   * is checked against the following week too.
   */
  withinPermittedHours(licence: PremisesLicence, startsAt: Date, endsAt: Date): boolean {
    const start = weekMinute(startsAt);
    const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
    const end = start + durationMinutes;

    return licence.permittedPeriods.some((period) => {
      const periodStart = period.startDay * MINUTES_PER_DAY + period.startMinute;
      const periodEnd = period.startDay * MINUTES_PER_DAY + period.endMinute;
      const insideThisWeek = start >= periodStart && end <= periodEnd;
      const insideNextWeek =
        start + MINUTES_PER_WEEK >= periodStart && end + MINUTES_PER_WEEK <= periodEnd;
      return insideThisWeek || insideNextWeek;
    });
  }

  /**
   * The smallest of the three numbers, and which one it was. A licence
   * condition, a fire capacity and a ticket allocation are independent facts,
   * and only one of them is currently visible to whoever is selling tickets.
   */
  bindingCapacity(licence: PremisesLicence | null, event: LicensableEvent): CapacityDetermination {
    const condition = licence?.conditions.find(
      (item): item is CapacityCondition => item.kind === "CAPACITY",
    );

    const candidates: Array<{ value: number; source: CapacitySource }> = [
      { value: event.physicalCapacity, source: "PHYSICAL_CAPACITY" },
      { value: event.ticketAllocation, source: "TICKET_ALLOCATION" },
    ];
    if (condition) {
      candidates.push({ value: condition.maxOccupancy, source: "LICENCE_CONDITION" });
    }

    // Ties resolve to the licence condition, because that is the one somebody
    // has to be told about.
    const binding = candidates.reduce((lowest, candidate) =>
      candidate.value < lowest.value ||
      (candidate.value === lowest.value && candidate.source === "LICENCE_CONDITION")
        ? candidate
        : lowest,
    );

    return { bindingCapacity: binding.value, source: binding.source };
  }

  private personalLicenceInForce(personId: string, at: Date): boolean {
    const licence = this.personalLicences.get(personId);
    if (!licence) return false;
    return at.getTime() >= licence.validFrom.getTime() && at.getTime() < licence.validTo.getTime();
  }

  private evaluateConditions(licence: PremisesLicence, event: LicensableEvent): Breach[] {
    const breaches: Breach[] = [];

    for (const condition of licence.conditions) {
      if (condition.kind === "CAPACITY") {
        if (event.ticketAllocation > condition.maxOccupancy) {
          breaches.push({
            kind: "CAPACITY_EXCEEDED",
            conditionId: condition.conditionId,
            detail: `${event.ticketAllocation} tickets against a licensed occupancy of ${condition.maxOccupancy}`,
            remedy: `Reduce the allocation to ${condition.maxOccupancy}`,
          });
        }
        continue;
      }

      if (condition.kind === "DPS_PRESENT") {
        const rostered = event.roster.filter((person) => person.role === "DPS");
        if (rostered.length === 0) {
          breaches.push({
            kind: "NO_DPS_ON_PREMISES",
            conditionId: condition.conditionId,
            detail: "No designated premises supervisor is rostered for this event",
            remedy: "Roster a personal licence holder as DPS",
          });
        } else if (
          !rostered.some((person) => this.personalLicenceInForce(person.personId, event.startsAt))
        ) {
          breaches.push({
            kind: "DPS_LICENCE_NOT_IN_FORCE",
            conditionId: condition.conditionId,
            detail: `No rostered DPS holds a personal licence in force on ${event.startsAt.toISOString().slice(0, 10)}`,
            remedy: "Roster a DPS whose personal licence is in force on the event date",
          });
        }
        continue;
      }

      if (condition.kind === "DOOR_SUPERVISORS") {
        if (event.expectedHeadcount < condition.thresholdHeadcount) continue;
        const required = Math.ceil(event.expectedHeadcount / condition.onePerHeadcount);
        const rostered = event.roster.filter((person) => person.role === "DOOR_SUPERVISOR").length;
        if (rostered < required) {
          breaches.push({
            kind: "INSUFFICIENT_DOOR_SUPERVISORS",
            conditionId: condition.conditionId,
            detail: `${rostered} rostered against ${required} required for ${event.expectedHeadcount} attendees`,
            remedy: `Roster ${required - rostered} more door supervisor(s)`,
          });
        }
        continue;
      }

      const restricted = event.activities.find((item) => item.activity === condition.activity);
      if (restricted && restricted.endsAtMinute > condition.notAfterMinute) {
        breaches.push({
          kind: "ACTIVITY_RESTRICTED",
          conditionId: condition.conditionId,
          detail: `${condition.activity} runs to ${restricted.endsAtMinute} minutes against a restriction at ${condition.notAfterMinute}`,
          remedy: `Stop ${condition.activity} by ${condition.notAfterMinute} minutes past midnight`,
        });
      }
    }

    return breaches;
  }

  /**
   * The whole question for one event. An event outside permitted hours is not
   * unlawful in itself — it is an event that needs a Temporary Event Notice,
   * which is a different conversation with a different answer.
   */
  assessEvent(event: LicensableEvent): LicenceAssessment {
    const licence = this.licenceFor(event.premisesId);
    const capacity = this.bindingCapacity(licence, event);

    if (!licence) {
      return {
        eventId: event.eventId,
        lawful: false,
        route: "UNLICENSED",
        licenceId: null,
        capacity,
        breaches: [
          {
            kind: "NO_LICENCE_FOR_PREMISES",
            conditionId: null,
            detail: `No premises licence is held for ${event.premisesId}`,
            remedy: "Give a Temporary Event Notice or move the event to licensed premises",
          },
        ],
      };
    }

    const breaches = this.evaluateConditions(licence, event);
    const withinHours = this.withinPermittedHours(licence, event.startsAt, event.endsAt);

    if (!withinHours) {
      breaches.unshift({
        kind: "OUTSIDE_PERMITTED_HOURS",
        conditionId: null,
        detail: `${event.startsAt.toISOString()} to ${event.endsAt.toISOString()} falls outside the permitted hours`,
        remedy: "Bring the event inside permitted hours or give a Temporary Event Notice",
      });
    }

    return {
      eventId: event.eventId,
      lawful: breaches.length === 0,
      route: withinHours ? "PREMISES_LICENCE" : "TEN_REQUIRED",
      licenceId: licence.licenceId,
      capacity,
      breaches,
    };
  }

  private noticesInYear(year: number): TemporaryEventNotice[] {
    return this.notices.filter(
      (notice) => !notice.withdrawn && notice.from.getUTCFullYear() === year,
    );
  }

  /**
   * Every counter, evaluated together, with the one that bites named. Counting
   * notices without counting days, or counting days without attributing them to
   * the giver, produces a different wrong answer each time.
   */
  assessNotice(proposed: TemporaryEventNotice): TenAssessment {
    const year = proposed.from.getUTCFullYear();
    const existing = this.noticesInYear(year).filter(
      (notice) => notice.noticeId !== proposed.noticeId,
    );

    const atPremises = existing.filter((notice) => notice.premisesId === proposed.premisesId);
    const byGiver = existing.filter((notice) => notice.givenBy === proposed.givenBy);

    const daysThisNotice = daysCovered(proposed.from, proposed.to);
    const daysAtPremises = atPremises.reduce(
      (total, notice) => total + daysCovered(notice.from, notice.to),
      0,
    );

    const giverLimit = proposed.giverHoldsPersonalLicence
      ? this.limits.noticesPerPersonalLicenceHolderPerYear
      : this.limits.noticesPerOtherGiverPerYear;

    // The interval counter is a gap rather than a total, so it is expressed as
    // days elapsed against the minimum the licence requires.
    const previousAtPremises = atPremises
      .filter((notice) => notice.to.getTime() <= proposed.from.getTime())
      .sort((a, b) => b.to.getTime() - a.to.getTime())[0];
    const intervalDays = previousAtPremises
      ? dayNumber(proposed.from) - dayNumber(previousAtPremises.to)
      : this.limits.minimumIntervalDays;

    const counters: TenCounterState[] = [
      {
        counter: "NOTICES_PER_PREMISES",
        used: atPremises.length,
        limit: this.limits.noticesPerPremisesPerYear,
        wouldBecome: atPremises.length + 1,
      },
      {
        counter: "DAYS_PER_PREMISES",
        used: daysAtPremises,
        limit: this.limits.daysPerPremisesPerYear,
        wouldBecome: daysAtPremises + daysThisNotice,
      },
      {
        counter: "DAYS_PER_NOTICE",
        used: 0,
        limit: this.limits.maxDaysPerNotice,
        wouldBecome: daysThisNotice,
      },
      {
        counter: "NOTICES_PER_GIVER",
        used: byGiver.length,
        limit: giverLimit,
        wouldBecome: byGiver.length + 1,
      },
      {
        counter: "MINIMUM_INTERVAL",
        used: intervalDays,
        limit: this.limits.minimumIntervalDays,
        wouldBecome: intervalDays,
      },
    ];

    const exhausted =
      counters.find((state) =>
        state.counter === "MINIMUM_INTERVAL"
          ? state.wouldBecome < state.limit
          : state.wouldBecome > state.limit,
      ) ?? null;

    return {
      permitted: exhausted === null,
      exhausted: exhausted?.counter ?? null,
      counters,
      detail: exhausted
        ? exhausted.counter === "MINIMUM_INTERVAL"
          ? `Only ${exhausted.used} day(s) since the last notice at these premises, against a minimum of ${exhausted.limit}`
          : `${exhausted.counter} would reach ${exhausted.wouldBecome} against a limit of ${exhausted.limit}`
        : "Within every allowance",
    };
  }

  /**
   * An amendment is a fresh determination, not an inherited verdict. Extending
   * an event by an hour, moving it or raising the allocation each turn a lawful
   * event into a different question, and the change is made by whoever is
   * nearest the admin screen.
   */
  assessAmendment(original: LicensableEvent, amended: LicensableEvent): AmendmentAssessment {
    const before = this.assessEvent(original);
    const after = this.assessEvent(amended);

    const key = (breach: Breach) => `${breach.kind}:${breach.conditionId ?? "-"}`;
    const beforeKeys = new Set(before.breaches.map(key));
    const afterKeys = new Set(after.breaches.map(key));

    return {
      wasLawful: before.lawful,
      isLawful: after.lawful,
      introduced: after.breaches.filter((breach) => !beforeKeys.has(key(breach))),
      resolved: before.breaches.filter((breach) => !afterKeys.has(key(breach))),
    };
  }

  /**
   * What is left at a premises for the rest of the year, so a summer series is
   * planned against the allowance rather than into it.
   */
  remainingAllowance(
    premisesId: string,
    year: number,
  ): { noticesRemaining: number; daysRemaining: number } {
    const atPremises = this.noticesInYear(year).filter(
      (notice) => notice.premisesId === premisesId,
    );
    const daysUsed = atPremises.reduce(
      (total, notice) => total + daysCovered(notice.from, notice.to),
      0,
    );

    return {
      noticesRemaining: Math.max(0, this.limits.noticesPerPremisesPerYear - atPremises.length),
      daysRemaining: Math.max(0, this.limits.daysPerPremisesPerYear - daysUsed),
    };
  }
}
