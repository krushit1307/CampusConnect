/**
 * Module: Electrical Safety Register for Loaned and Hired-In Equipment
 * File: src/services/electricalSafetyRegisterService.ts
 * Scope: Resolves the inspection interval per item from its construction class
 *        and the environment it is used in, derives issuability from the
 *        inspection record rather than storing it, keeps a fault open until
 *        somebody other than the reporter closes it, brings hired-in and
 *        member-owned equipment into the register at the point of booking, and
 *        assesses a booking against the supply it will draw from (#5259).
 *
 * The equipment pool already schedules preventive maintenance against usage
 * hours (#4555). That is a reliability question — whether a lamp is near the
 * end of its life. Electrical safety is a different inspection on a different
 * interval with a different consequence: an item that fails it may not be
 * issued at all, whatever its usage meter says.
 *
 * The interval is not a property of the item alone. A 240V extension lead going
 * out to a field in the rain and the same lead living under an office desk are
 * on materially different intervals, and the driver is the environment. Class
 * matters too: earthed metal-cased equipment carries a risk that double-
 * insulated equipment does not, and equipment running at safety-extra-low
 * voltage carries neither. So the interval is resolved from the pair, and
 * re-resolved when an item's typical use changes — from the last inspection,
 * not from the day somebody edited the record, because editing a field does
 * not make an item safer.
 *
 * Issuability is derived. A "needs attention" status on a record that still
 * appears in the bookable list is an item that goes out anyway on a busy
 * Friday. There is no settable availability flag here for the same reason there
 * is no settable one in the fleet register: a flag is what gets cleared by
 * whoever wants the equipment.
 *
 * A fault closes on somebody else's signature. The member who reported a
 * damaged lead marking it fixed is a damaged lead that is still damaged, and
 * the question asked afterwards is who signed and when.
 *
 * The real exposure is the equipment the register has never seen. A club
 * plugging in a member's own amplifier or a supplier's hired-in smoke machine
 * puts it on the same distribution board as everything else, so both enter the
 * register on the way in rather than being outside its scope.
 *
 * And an item can be perfectly sound and still unsafe to issue for a particular
 * booking, because outdoor and temporary installations need protection on the
 * supply. That is a property of what the item is plugged into, so the booking
 * is assessed as a whole and the blocker names the supply rather than the item.
 */

export type EquipmentClass =
  /** Earthed, metal-cased. The class the earth continuity test exists for. */
  | "CLASS_I"
  /** Double-insulated. No protective earth to test. */
  | "CLASS_II"
  /** Safety extra-low voltage. No test required, visual only. */
  | "CLASS_III";

export type UseEnvironment =
  "OFFICE_STATIONARY" | "INDOOR_PORTABLE" | "OUTDOOR" | "CONSTRUCTION_OR_TEMPORARY";

export type Ownership = "OWNED" | "HIRED_IN" | "MEMBER_OWNED";

export type InspectionType = "VISUAL" | "COMBINED_INSPECTION_AND_TEST";

export type InspectionOutcome = "PASS" | "FAIL";

export type Issuability =
  "ISSUABLE" | "NEVER_INSPECTED" | "INSPECTION_LAPSED" | "QUARANTINED" | "RETIRED";

export type BlockerKind =
  | "ITEM_NOT_IN_REGISTER"
  | "ITEM_RETIRED"
  | "ITEM_QUARANTINED"
  | "ITEM_NEVER_INSPECTED"
  | "ITEM_INSPECTION_LAPSED"
  | "SUPPLY_NOT_PROTECTED"
  | "SUPPLY_PROTECTION_UNTESTED";

export interface EquipmentItem {
  itemId: string;
  description: string;
  equipmentClass: EquipmentClass;
  useEnvironment: UseEnvironment;
  ownership: Ownership;
  /** The supplier or the member, for anything not owned by the pool. */
  ownerReference: string | null;
  retiredOn: Date | null;
}

export interface Inspection {
  inspectionId: string;
  itemId: string;
  type: InspectionType;
  performedOn: Date;
  outcome: InspectionOutcome;
  testedBy: string;
  /** The fault this inspection closes, where it closes one. */
  clearsFaultId: string | null;
}

export interface Fault {
  faultId: string;
  itemId: string;
  description: string;
  reportedBy: string;
  reportedOn: Date;
  clearedByInspectionId: string | null;
}

export interface PowerSupply {
  supplyId: string;
  description: string;
  rcdProtected: boolean;
  /** Protection that has never been proved is protection nobody should rely on. */
  lastProtectionTestOn: Date | null;
}

export interface EquipmentBooking {
  bookingId: string;
  itemIds: string[];
  supplyId: string;
  environment: UseEnvironment;
  startsOn: Date;
}

export interface InspectionInterval {
  visualMonths: number;
  /** Null where the class needs no electrical test, only a visual inspection. */
  combinedMonths: number | null;
}

export interface InspectionDue {
  itemId: string;
  visualDueOn: Date | null;
  combinedDueOn: Date | null;
  interval: InspectionInterval;
}

export interface Blocker {
  kind: BlockerKind;
  /** The item, or the supply, depending on which is actually at fault. */
  subject: string;
  detail: string;
  remedy: string;
}

export interface BookingAssessment {
  bookingId: string;
  permitted: boolean;
  blockers: Blocker[];
}

export interface FaultClosure {
  closed: boolean;
  reason: string;
}

/**
 * Intervals in months, by class and environment. The table is the point of the
 * module: a single interval column cannot say that the same lead is on three
 * months outdoors and two years under a desk.
 */
const INTERVALS: Record<UseEnvironment, Record<EquipmentClass, InspectionInterval>> = {
  OFFICE_STATIONARY: {
    CLASS_I: { visualMonths: 24, combinedMonths: 48 },
    CLASS_II: { visualMonths: 24, combinedMonths: null },
    CLASS_III: { visualMonths: 48, combinedMonths: null },
  },
  INDOOR_PORTABLE: {
    CLASS_I: { visualMonths: 12, combinedMonths: 24 },
    CLASS_II: { visualMonths: 24, combinedMonths: null },
    CLASS_III: { visualMonths: 24, combinedMonths: null },
  },
  OUTDOOR: {
    CLASS_I: { visualMonths: 3, combinedMonths: 12 },
    CLASS_II: { visualMonths: 3, combinedMonths: 12 },
    CLASS_III: { visualMonths: 12, combinedMonths: null },
  },
  CONSTRUCTION_OR_TEMPORARY: {
    CLASS_I: { visualMonths: 1, combinedMonths: 3 },
    CLASS_II: { visualMonths: 1, combinedMonths: 3 },
    CLASS_III: { visualMonths: 12, combinedMonths: null },
  },
};

/** Environments where protection on the supply is not optional. */
const ENVIRONMENTS_REQUIRING_PROTECTION: UseEnvironment[] = [
  "OUTDOOR",
  "CONSTRUCTION_OR_TEMPORARY",
];

/** Protection older than this has not been proved recently enough to rely on. */
const PROTECTION_TEST_VALID_MONTHS = 12;

/**
 * Months added without rolling over a short month. Adding a month to 31 January
 * gives 28 February, not 3 March, because a due date that skips a month is a
 * due date that arrives late.
 */
export function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();

  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, lastDayOfTarget),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class ElectricalSafetyRegisterService {
  private readonly items = new Map<string, EquipmentItem>();
  private readonly inspections: Inspection[] = [];
  private readonly faults: Fault[] = [];
  private readonly supplies = new Map<string, PowerSupply>();

  registerItem(item: EquipmentItem): void {
    if (item.ownership !== "OWNED" && !item.ownerReference) {
      throw new Error(
        `Item ${item.itemId} is ${item.ownership} and must name whose equipment it is`,
      );
    }
    this.items.set(item.itemId, item);
  }

  registerSupply(supply: PowerSupply): void {
    this.supplies.set(supply.supplyId, supply);
  }

  private requireItem(itemId: string): EquipmentItem {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`Unknown item ${itemId}`);
    return item;
  }

  /**
   * Equipment the register has never seen, entering it at the point of booking.
   * A member's own amplifier sits on the same distribution board as the pool's
   * stock, so it is assessed on the same terms rather than being out of scope.
   */
  registerTransientItem(
    item: Omit<EquipmentItem, "retiredOn"> & { retiredOn?: Date | null },
  ): EquipmentItem {
    if (item.ownership === "OWNED") {
      throw new Error(
        `Item ${item.itemId} is owned stock and belongs in the register directly, not as a transient`,
      );
    }
    const registered: EquipmentItem = { retiredOn: null, ...item };
    this.registerItem(registered);
    return registered;
  }

  recordInspection(inspection: Inspection): void {
    this.requireItem(inspection.itemId);
    this.inspections.push(inspection);

    if (inspection.clearsFaultId !== null && inspection.outcome === "PASS") {
      const fault = this.faults.find((candidate) => candidate.faultId === inspection.clearsFaultId);
      if (fault) fault.clearedByInspectionId = inspection.inspectionId;
    }
  }

  reportFault(fault: Fault): void {
    this.requireItem(fault.itemId);
    this.faults.push(fault);
  }

  /**
   * A fault closes on somebody else's signature. The member who reported a
   * damaged lead marking it fixed is a damaged lead that is still damaged.
   */
  closeFault(faultId: string, inspection: Inspection): FaultClosure {
    const fault = this.faults.find((candidate) => candidate.faultId === faultId);
    if (!fault) throw new Error(`Unknown fault ${faultId}`);

    if (inspection.testedBy === fault.reportedBy) {
      return {
        closed: false,
        reason: "The person who reported a fault cannot be the one who signs it off",
      };
    }
    if (inspection.outcome !== "PASS") {
      return {
        closed: false,
        reason: "A failed inspection does not close the fault it was investigating",
      };
    }

    this.recordInspection({ ...inspection, clearsFaultId: faultId });
    return { closed: true, reason: `Signed off by ${inspection.testedBy}` };
  }

  /** The interval for an item as it is currently used. */
  intervalFor(itemId: string): InspectionInterval {
    const item = this.requireItem(itemId);
    return INTERVALS[item.useEnvironment][item.equipmentClass];
  }

  /**
   * Changing where an item is used changes when it is next due, and the new due
   * date is measured from the last inspection rather than from today. Editing a
   * field does not make an item safer, and measuring from the edit is how a
   * lead that has been outdoors all term gets another twelve months.
   */
  changeUseEnvironment(itemId: string, environment: UseEnvironment): InspectionDue {
    const item = this.requireItem(itemId);
    this.items.set(itemId, { ...item, useEnvironment: environment });
    return this.nextDue(itemId);
  }

  private lastInspectionOfType(itemId: string, type: InspectionType): Inspection | null {
    return (
      this.inspections
        .filter((inspection) => inspection.itemId === itemId && inspection.type === type)
        .sort((a, b) => b.performedOn.getTime() - a.performedOn.getTime())[0] ?? null
    );
  }

  /**
   * A combined inspection and test includes the visual one, so it satisfies
   * both clocks. Treating them as independent produces a visual inspection
   * demanded the week after a full test.
   */
  private lastSatisfyingVisual(itemId: string): Inspection | null {
    return (
      this.inspections
        .filter((inspection) => inspection.itemId === itemId)
        .sort((a, b) => b.performedOn.getTime() - a.performedOn.getTime())[0] ?? null
    );
  }

  nextDue(itemId: string): InspectionDue {
    const interval = this.intervalFor(itemId);
    const lastVisual = this.lastSatisfyingVisual(itemId);
    const lastCombined = this.lastInspectionOfType(itemId, "COMBINED_INSPECTION_AND_TEST");

    return {
      itemId,
      visualDueOn: lastVisual ? addMonths(lastVisual.performedOn, interval.visualMonths) : null,
      combinedDueOn:
        interval.combinedMonths !== null && lastCombined
          ? addMonths(lastCombined.performedOn, interval.combinedMonths)
          : null,
      interval,
    };
  }

  openFaults(itemId: string): Fault[] {
    return this.faults.filter(
      (fault) => fault.itemId === itemId && fault.clearedByInspectionId === null,
    );
  }

  /**
   * Derived from the inspection record and the open faults. There is no
   * availability column, because a column is the thing that gets cleared by
   * whoever wants the equipment.
   */
  issuability(itemId: string, asOf: Date): Issuability {
    const item = this.requireItem(itemId);

    if (item.retiredOn !== null && item.retiredOn.getTime() <= asOf.getTime()) {
      return "RETIRED";
    }
    if (this.openFaults(itemId).length > 0) return "QUARANTINED";

    const interval = this.intervalFor(itemId);
    const due = this.nextDue(itemId);

    // A most-recent inspection that failed leaves the item quarantined even
    // with no fault raised against it separately.
    const latest = this.lastSatisfyingVisual(itemId);
    if (latest && latest.outcome === "FAIL") return "QUARANTINED";

    if (due.visualDueOn === null) return "NEVER_INSPECTED";
    if (due.visualDueOn.getTime() <= asOf.getTime()) return "INSPECTION_LAPSED";

    if (interval.combinedMonths !== null) {
      if (due.combinedDueOn === null) return "NEVER_INSPECTED";
      if (due.combinedDueOn.getTime() <= asOf.getTime()) return "INSPECTION_LAPSED";
    }

    return "ISSUABLE";
  }

  private itemBlockers(itemId: string, asOf: Date): Blocker[] {
    if (!this.items.has(itemId)) {
      return [
        {
          kind: "ITEM_NOT_IN_REGISTER",
          subject: itemId,
          detail: `${itemId} is not in the register`,
          remedy:
            "Record the item before it is used, including hired-in and member-owned equipment",
        },
      ];
    }

    const item = this.requireItem(itemId);
    const status = this.issuability(itemId, asOf);
    const due = this.nextDue(itemId);

    switch (status) {
      case "ISSUABLE":
        return [];
      case "RETIRED":
        return [
          {
            kind: "ITEM_RETIRED",
            subject: itemId,
            detail: `${item.description} was retired on ${isoDate(item.retiredOn as Date)}`,
            remedy: "Substitute a current item",
          },
        ];
      case "QUARANTINED": {
        const open = this.openFaults(itemId);
        return [
          {
            kind: "ITEM_QUARANTINED",
            subject: itemId,
            detail: open.length
              ? `${item.description} has an open fault: ${open[0].description}`
              : `${item.description} most recently failed inspection`,
            remedy: "Rectify and have the fault signed off by somebody other than the reporter",
          },
        ];
      }
      case "NEVER_INSPECTED":
        return [
          {
            kind: "ITEM_NEVER_INSPECTED",
            subject: itemId,
            detail: `${item.description} has no inspection on record for its ${item.equipmentClass} classification`,
            remedy: "Inspect before first issue",
          },
        ];
      case "INSPECTION_LAPSED": {
        const lapsed =
          due.visualDueOn && due.visualDueOn.getTime() <= asOf.getTime()
            ? due.visualDueOn
            : (due.combinedDueOn as Date);
        return [
          {
            kind: "ITEM_INSPECTION_LAPSED",
            subject: itemId,
            detail:
              `${item.description} was due on ${isoDate(lapsed)} on the ` +
              `${item.useEnvironment} interval and has not been inspected since`,
            remedy: `Re-inspect before ${isoDate(asOf)}`,
          },
        ];
      }
    }
  }

  /**
   * Protection is a property of the supply, so an otherwise sound item can be
   * unsafe to issue for one booking and fine for the next. The blocker names
   * the supply, because replacing the item would not fix anything.
   */
  supplyBlockers(supplyId: string, environment: UseEnvironment, asOf: Date): Blocker[] {
    if (!ENVIRONMENTS_REQUIRING_PROTECTION.includes(environment)) return [];

    const supply = this.supplies.get(supplyId);
    if (!supply) throw new Error(`Unknown supply ${supplyId}`);

    if (!supply.rcdProtected) {
      return [
        {
          kind: "SUPPLY_NOT_PROTECTED",
          subject: supplyId,
          detail: `${supply.description} has no residual current protection, and the booking is ${environment}`,
          remedy: "Move the booking to a protected supply or fit protection at the point of use",
        },
      ];
    }

    if (supply.lastProtectionTestOn === null) {
      return [
        {
          kind: "SUPPLY_PROTECTION_UNTESTED",
          subject: supplyId,
          detail: `${supply.description} is protected but the protection has never been tested`,
          remedy: "Test the device before the booking",
        },
      ];
    }

    const validUntil = addMonths(supply.lastProtectionTestOn, PROTECTION_TEST_VALID_MONTHS);
    if (validUntil.getTime() <= asOf.getTime()) {
      return [
        {
          kind: "SUPPLY_PROTECTION_UNTESTED",
          subject: supplyId,
          detail: `${supply.description} was last proved on ${isoDate(supply.lastProtectionTestOn)}, over ${PROTECTION_TEST_VALID_MONTHS} months before the booking`,
          remedy: "Re-test the device before the booking",
        },
      ];
    }

    return [];
  }

  /**
   * The booking as a whole: every item, plus the supply it draws from. Assessed
   * as at the date of the booking rather than today, so a booking three months
   * out is not cleared against an interval that will have lapsed by then.
   */
  assessBooking(booking: EquipmentBooking): BookingAssessment {
    const blockers = [
      ...booking.itemIds.flatMap((itemId) => this.itemBlockers(itemId, booking.startsOn)),
      ...this.supplyBlockers(booking.supplyId, booking.environment, booking.startsOn),
    ];

    return {
      bookingId: booking.bookingId,
      permitted: blockers.length === 0,
      blockers,
    };
  }

  /** Everything due on or before a date, so the pool can work a list. */
  dueBy(cutoff: Date): InspectionDue[] {
    return [...this.items.values()]
      .filter((item) => item.retiredOn === null)
      .map((item) => this.nextDue(item.itemId))
      .filter((due) => {
        const visual = due.visualDueOn === null || due.visualDueOn.getTime() <= cutoff.getTime();
        const combined =
          due.interval.combinedMonths !== null &&
          (due.combinedDueOn === null || due.combinedDueOn.getTime() <= cutoff.getTime());
        return visual || combined;
      })
      .sort((a, b) => (a.visualDueOn?.getTime() ?? 0) - (b.visualDueOn?.getTime() ?? 0));
  }
}
