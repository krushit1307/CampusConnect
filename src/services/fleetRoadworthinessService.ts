/**
 * Module: Minibus Fleet Roadworthiness
 * File: src/services/fleetRoadworthinessService.ts
 * Scope: Projects inspection due points against calendar and mileage together
 *        including the mileage of the journey being booked, derives grounding
 *        from graded open defects, requires competent-person rectification,
 *        evaluates permit class and driver entitlement against the specific
 *        journey, checks documents as at the journey date, and cascades a
 *        grounding to the bookings already on the vehicle (#5163).
 *
 * The platform already tracks driver duty hours. It tracks nothing about the
 * vehicle, and a minibus offered for booking is reasonably assumed by the
 * student booking it to be one that may lawfully be driven.
 *
 * Inspection intervals are whichever comes first, and mileage is the one that
 * surprises people. A minibus that did four away fixtures in a fortnight
 * reaches 6,000 miles a month before it reaches ten weeks, and a scheduler
 * counting weeks books it anyway. The interval has to be projected forward too:
 * a 400-mile booking on a vehicle 5,800 miles into its cycle crosses the
 * threshold in the middle of the journey, which is a different fact from being
 * due next month.
 *
 * A defect is not a boolean and grounding is not a status flag. A cracked
 * mirror housing is rectified at the next service; a brake imbalance grounds
 * the vehicle immediately; a failed passenger door lock grounds it for carrying
 * passengers and not for a movement to the garage. Availability is therefore
 * derived from the open defects rather than stored, because a stored flag is
 * the thing that gets cleared by whoever wants the vehicle.
 *
 * Rectification is verified by somebody other than the person who reported it.
 * A driver marking their own reported defect as fixed is a defect that is still
 * there, and the question asked afterwards is who signed and when.
 *
 * Permit class binds the journey, not the vehicle. A section 19 permit covers
 * the organisation's own members on a non-profit basis; the same minibus on the
 * same day is lawful for the hockey team and unlawful for the external group
 * that hired it, and the difference is entirely in the booking.
 *
 * And documents expire independently and silently. A booking made three months
 * out is checked today against an MOT that will have run out by then, so every
 * document is evaluated as at the journey date with the margin reported.
 */

export type DefectSeverity = "RECTIFY_AT_SERVICE" | "GROUND_FOR_PASSENGERS" | "GROUND_IMMEDIATELY";

export type VehicleAvailability = "AVAILABLE" | "PASSENGERS_PROHIBITED" | "GROUNDED";

export type DocumentType =
  "MOT" | "VEHICLE_TAX" | "INSURANCE" | "PERMIT" | "TACHOGRAPH_CALIBRATION";

export type PermitClass = "SECTION_19" | "SECTION_22" | "PSV";

export type JourneyPurpose = "MEMBERS_NON_PROFIT" | "EXTERNAL_HIRE" | "REPAIR_MOVEMENT";

export type ChargeBasis = "NONE" | "COST_RECOVERY" | "PROFIT";

export type InspectionTrigger = "CALENDAR" | "MILEAGE";

export type BlockerKind =
  | "INSPECTION_OVERDUE"
  | "INSPECTION_DUE_MID_JOURNEY"
  | "VEHICLE_GROUNDED"
  | "PASSENGER_USE_PROHIBITED"
  | "DOCUMENT_EXPIRED"
  | "PERMIT_CLASS_INVALID"
  | "DRIVER_NOT_ENTITLED";

export interface FleetVehicle {
  vehicleId: string;
  registration: string;
  maxAuthorisedMassKg: number;
  passengerSeats: number;
  odometerKm: number;
  inspectionIntervalWeeks: number;
  inspectionIntervalKm: number;
}

export interface VehicleInspection {
  inspectionId: string;
  vehicleId: string;
  performedOn: Date;
  odometerKm: number;
}

export interface VehicleDefect {
  defectId: string;
  vehicleId: string;
  severity: DefectSeverity;
  description: string;
  reportedBy: string;
  reportedOn: Date;
  rectifiedBy: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
}

export interface VehicleDocument {
  vehicleId: string;
  type: DocumentType;
  expiresOn: Date;
}

export interface TransportPermit {
  permitId: string;
  vehicleId: string;
  permitClass: PermitClass;
  membersOnly: boolean;
  separateChargePermitted: boolean;
  expiresOn: Date;
}

export interface Driver {
  driverId: string;
  dateOfBirth: Date;
  licenceAcquiredOn: Date;
  /** A D1 entitlement, as opposed to driving a minibus on a category B licence. */
  holdsD1: boolean;
}

export interface VehicleBooking {
  bookingId: string;
  vehicleId: string;
  driverId: string;
  purpose: JourneyPurpose;
  chargeBasis: ChargeBasis;
  departsAt: Date;
  estimatedKm: number;
  carriesPassengers: boolean;
  abroad: boolean;
  withTrailer: boolean;
}

export interface InspectionDue {
  dueOn: Date;
  dueAtOdometerKm: number;
  /** Which of the two comes first at the usage rate given. */
  trigger: InspectionTrigger;
}

export interface Blocker {
  kind: BlockerKind;
  detail: string;
  remedy: string;
}

export interface BookingAssessment {
  bookingId: string;
  vehicleId: string;
  permitted: boolean;
  availability: VehicleAvailability;
  blockers: Blocker[];
}

export interface CascadeEntry {
  bookingId: string;
  departsAt: Date;
  reallocatableTo: string | null;
  reason: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/** Category B minibus driving is permitted only in a narrow set of circumstances. */
const CATEGORY_B_MAX_MASS_KG = 3500;
const CATEGORY_B_MIN_AGE_YEARS = 21;
const CATEGORY_B_MIN_LICENCE_YEARS = 2;
const D1_MAX_MASS_WITH_TRAILER_KG = 8250;

function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (365.25 * MS_PER_DAY);
}

export class FleetRoadworthinessService {
  private readonly vehicles = new Map<string, FleetVehicle>();
  private readonly inspections: VehicleInspection[] = [];
  private readonly defects: VehicleDefect[] = [];
  private readonly documents: VehicleDocument[] = [];
  private readonly permits: TransportPermit[] = [];
  private readonly drivers = new Map<string, Driver>();

  registerVehicle(vehicle: FleetVehicle): void {
    this.vehicles.set(vehicle.vehicleId, vehicle);
  }

  recordInspection(inspection: VehicleInspection): void {
    this.inspections.push(inspection);
  }

  reportDefect(defect: VehicleDefect): void {
    this.defects.push(defect);
  }

  registerDocument(document: VehicleDocument): void {
    this.documents.push(document);
  }

  registerPermit(permit: TransportPermit): void {
    this.permits.push(permit);
  }

  registerDriver(driver: Driver): void {
    this.drivers.set(driver.driverId, driver);
  }

  private requireVehicle(vehicleId: string): FleetVehicle {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) throw new Error(`Unknown vehicle ${vehicleId}`);
    return vehicle;
  }

  private lastInspection(vehicleId: string): VehicleInspection | null {
    return (
      this.inspections
        .filter((inspection) => inspection.vehicleId === vehicleId)
        .sort((a, b) => b.performedOn.getTime() - a.performedOn.getTime())[0] ?? null
    );
  }

  /**
   * Both due points, and which one arrives first at the rate the vehicle is
   * actually being used. A fleet that counts weeks and a fleet that counts
   * miles each miss half the fleet.
   */
  nextInspectionDue(vehicleId: string, kmPerWeek: number): InspectionDue {
    const vehicle = this.requireVehicle(vehicleId);
    const last = this.lastInspection(vehicleId);
    if (!last) {
      throw new Error(`Vehicle ${vehicleId} has never been inspected`);
    }

    const dueOn = new Date(
      last.performedOn.getTime() + vehicle.inspectionIntervalWeeks * MS_PER_WEEK,
    );
    const dueAtOdometerKm = last.odometerKm + vehicle.inspectionIntervalKm;

    const weeksToMileage = kmPerWeek > 0 ? vehicle.inspectionIntervalKm / kmPerWeek : Infinity;

    return {
      dueOn,
      dueAtOdometerKm,
      trigger: weeksToMileage < vehicle.inspectionIntervalWeeks ? "MILEAGE" : "CALENDAR",
    };
  }

  openDefects(vehicleId: string): VehicleDefect[] {
    return this.defects.filter(
      (defect) => defect.vehicleId === vehicleId && defect.verifiedAt === null,
    );
  }

  /**
   * Availability derived from the open defects rather than stored. A stored
   * flag is the thing that gets cleared by whoever wants the vehicle.
   */
  availability(vehicleId: string): VehicleAvailability {
    const open = this.openDefects(vehicleId);
    if (open.some((defect) => defect.severity === "GROUND_IMMEDIATELY")) return "GROUNDED";
    if (open.some((defect) => defect.severity === "GROUND_FOR_PASSENGERS")) {
      return "PASSENGERS_PROHIBITED";
    }
    return "AVAILABLE";
  }

  /**
   * A movement to the garage is exactly what a grounded vehicle needs, and
   * exactly what a single availability flag prevents. Permitted where every
   * open defect permits it and nobody is being carried.
   */
  mayMoveForRepair(vehicleId: string): boolean {
    return !this.openDefects(vehicleId).some((defect) => defect.severity === "GROUND_IMMEDIATELY");
  }

  /**
   * A defect closes on somebody else's signature. The reporter marking their
   * own report as fixed is a defect that is still there.
   */
  rectifyDefect(
    defectId: string,
    rectification: { rectifiedBy: string; verifiedBy: string; verifiedAt: Date },
  ): { closed: boolean; reason: string } {
    const defect = this.defects.find((candidate) => candidate.defectId === defectId);
    if (!defect) throw new Error(`Unknown defect ${defectId}`);

    if (rectification.verifiedBy === defect.reportedBy) {
      return {
        closed: false,
        reason: "The person who reported a defect cannot verify its rectification",
      };
    }

    defect.rectifiedBy = rectification.rectifiedBy;
    defect.verifiedBy = rectification.verifiedBy;
    defect.verifiedAt = rectification.verifiedAt;
    return { closed: true, reason: `Verified by ${rectification.verifiedBy}` };
  }

  /**
   * Documents as at the journey date rather than as at now, with the margin, so
   * a booking three months out is not checked against an MOT that expires next
   * week.
   */
  documentBlockers(vehicleId: string, journeyDate: Date): Blocker[] {
    return this.documents
      .filter((document) => document.vehicleId === vehicleId)
      .filter((document) => document.expiresOn.getTime() <= journeyDate.getTime())
      .map((document) => ({
        kind: "DOCUMENT_EXPIRED" as const,
        detail: `${document.type} expires on ${document.expiresOn.toISOString().slice(0, 10)}, before the journey on ${journeyDate.toISOString().slice(0, 10)}`,
        remedy: `Renew the ${document.type} before ${journeyDate.toISOString().slice(0, 10)}`,
      }));
  }

  /**
   * The permit answers a question about the journey. The same minibus is lawful
   * for the hockey team and unlawful for the group that hired it.
   */
  permitBlocker(vehicleId: string, booking: VehicleBooking): Blocker | null {
    if (booking.purpose === "REPAIR_MOVEMENT") return null;

    const permit = this.permits
      .filter(
        (candidate) =>
          candidate.vehicleId === vehicleId &&
          candidate.expiresOn.getTime() > booking.departsAt.getTime(),
      )
      .sort((a, b) => b.expiresOn.getTime() - a.expiresOn.getTime())[0];

    if (!permit) {
      return {
        kind: "PERMIT_CLASS_INVALID",
        detail: "No permit in force for this vehicle on the journey date",
        remedy: "Obtain a permit covering this journey or use a licensed operator",
      };
    }

    if (permit.permitClass === "PSV") return null;

    if (permit.membersOnly && booking.purpose === "EXTERNAL_HIRE") {
      return {
        kind: "PERMIT_CLASS_INVALID",
        detail: `Permit ${permit.permitId} covers the organisation's own members and this journey is an external hire`,
        remedy: "Refuse the hire or arrange it through a licensed operator",
      };
    }

    if (!permit.separateChargePermitted && booking.chargeBasis === "PROFIT") {
      return {
        kind: "PERMIT_CLASS_INVALID",
        detail: `Permit ${permit.permitId} is non-profit-making and this journey is charged at a profit`,
        remedy: "Charge at cost recovery or below",
      };
    }

    return null;
  }

  /**
   * Entitlement is a question about the licence, the driver's age, the weight
   * of the vehicle and where it is going — not about whether somebody has been
   * added to a list of drivers.
   */
  entitlementBlocker(booking: VehicleBooking): Blocker | null {
    const driver = this.drivers.get(booking.driverId);
    if (!driver) {
      return {
        kind: "DRIVER_NOT_ENTITLED",
        detail: `No driver record for ${booking.driverId}`,
        remedy: "Record the driver's licence details before the journey",
      };
    }

    const vehicle = this.requireVehicle(booking.vehicleId);

    if (driver.holdsD1) {
      const massWithTrailer = booking.withTrailer
        ? vehicle.maxAuthorisedMassKg + 750
        : vehicle.maxAuthorisedMassKg;
      if (massWithTrailer > D1_MAX_MASS_WITH_TRAILER_KG) {
        return {
          kind: "DRIVER_NOT_ENTITLED",
          detail: `Combined mass of ${massWithTrailer}kg exceeds the D1 limit of ${D1_MAX_MASS_WITH_TRAILER_KG}kg`,
          remedy: "Use a driver with category D entitlement or travel without the trailer",
        };
      }
      return null;
    }

    const age = yearsBetween(driver.dateOfBirth, booking.departsAt);
    const licenceYears = yearsBetween(driver.licenceAcquiredOn, booking.departsAt);

    if (age < CATEGORY_B_MIN_AGE_YEARS) {
      return {
        kind: "DRIVER_NOT_ENTITLED",
        detail: `Driver is ${age.toFixed(1)} on the journey date, below the minimum of ${CATEGORY_B_MIN_AGE_YEARS}`,
        remedy: "Assign a driver aged 21 or over",
      };
    }

    if (licenceYears < CATEGORY_B_MIN_LICENCE_YEARS) {
      return {
        kind: "DRIVER_NOT_ENTITLED",
        detail: `Licence held for ${licenceYears.toFixed(1)} years, below the minimum of ${CATEGORY_B_MIN_LICENCE_YEARS}`,
        remedy: "Assign a driver who has held a licence for two years or more",
      };
    }

    if (vehicle.maxAuthorisedMassKg > CATEGORY_B_MAX_MASS_KG) {
      return {
        kind: "DRIVER_NOT_ENTITLED",
        detail: `${vehicle.registration} has a maximum authorised mass of ${vehicle.maxAuthorisedMassKg}kg, above the ${CATEGORY_B_MAX_MASS_KG}kg limit for a category B licence`,
        remedy: "Assign a D1 holder or use a lighter vehicle",
      };
    }

    if (booking.withTrailer) {
      return {
        kind: "DRIVER_NOT_ENTITLED",
        detail: "A category B licence does not cover a minibus with a trailer",
        remedy: "Assign a D1 holder or travel without the trailer",
      };
    }

    if (booking.abroad) {
      return {
        kind: "DRIVER_NOT_ENTITLED",
        detail: "A category B minibus entitlement does not extend outside the United Kingdom",
        remedy: "Assign a D1 holder for the journey abroad",
      };
    }

    if (booking.chargeBasis === "PROFIT") {
      return {
        kind: "DRIVER_NOT_ENTITLED",
        detail:
          "A category B minibus entitlement does not cover a journey driven for hire or reward",
        remedy: "Charge at cost recovery or below, or assign a D1 holder",
      };
    }

    return null;
  }

  /**
   * The whole question for one booking. Every blocker is collected rather than
   * returning at the first, because a vehicle that fails on four counts and is
   * reported as failing on one gets re-presented four times.
   */
  assessBooking(booking: VehicleBooking): BookingAssessment {
    const vehicle = this.requireVehicle(booking.vehicleId);
    const availability = this.availability(booking.vehicleId);
    const blockers: Blocker[] = [];

    // A defect grounding the vehicle immediately refuses the movement to the
    // garage as well: that is what "immediately" means, and the vehicle goes on
    // a recovery truck instead.
    if (availability === "GROUNDED") {
      blockers.push({
        kind: "VEHICLE_GROUNDED",
        detail: `${vehicle.registration} has an open defect grounding it immediately`,
        remedy:
          "Recover the vehicle rather than driving it, and have the defect verified before it returns to service",
      });
    } else if (availability === "PASSENGERS_PROHIBITED" && booking.carriesPassengers) {
      blockers.push({
        kind: "PASSENGER_USE_PROHIBITED",
        detail: `${vehicle.registration} has an open defect prohibiting passenger use`,
        remedy: "Rectify the defect or move the vehicle without passengers",
      });
    }

    const last = this.lastInspection(booking.vehicleId);
    if (last) {
      const due = this.nextInspectionDue(booking.vehicleId, 0);
      if (
        booking.departsAt.getTime() >= due.dueOn.getTime() ||
        vehicle.odometerKm >= due.dueAtOdometerKm
      ) {
        blockers.push({
          kind: "INSPECTION_OVERDUE",
          detail: `Inspection due on ${due.dueOn.toISOString().slice(0, 10)} or at ${due.dueAtOdometerKm}km; the vehicle is at ${vehicle.odometerKm}km`,
          remedy: "Inspect the vehicle before the journey",
        });
      } else if (vehicle.odometerKm + booking.estimatedKm > due.dueAtOdometerKm) {
        blockers.push({
          kind: "INSPECTION_DUE_MID_JOURNEY",
          detail: `The journey of ${booking.estimatedKm}km takes the vehicle past its ${due.dueAtOdometerKm}km inspection point`,
          remedy: "Inspect before departure or split the journey across vehicles",
        });
      }
    }

    blockers.push(...this.documentBlockers(booking.vehicleId, booking.departsAt));

    const permitBlocker = this.permitBlocker(booking.vehicleId, booking);
    if (permitBlocker) blockers.push(permitBlocker);

    const entitlementBlocker = this.entitlementBlocker(booking);
    if (entitlementBlocker) blockers.push(entitlementBlocker);

    return {
      bookingId: booking.bookingId,
      vehicleId: booking.vehicleId,
      permitted: blockers.length === 0,
      availability,
      blockers,
    };
  }

  /**
   * Grounding a vehicle is not the end of it: there are bookings already on it,
   * and each one is either somebody else's problem now or nobody's. Ranked by
   * departure, because the one leaving on Saturday needs answering first.
   */
  cascadeGrounding(vehicleId: string, bookings: VehicleBooking[]): CascadeEntry[] {
    const affected = bookings
      .filter((booking) => booking.vehicleId === vehicleId)
      .filter((booking) => !this.assessBooking(booking).permitted)
      .sort((a, b) => a.departsAt.getTime() - b.departsAt.getTime());

    const alternatives = [...this.vehicles.keys()].filter((candidate) => candidate !== vehicleId);

    return affected.map((booking) => {
      const substitute = alternatives.find(
        (candidateId) => this.assessBooking({ ...booking, vehicleId: candidateId }).permitted,
      );

      return {
        bookingId: booking.bookingId,
        departsAt: booking.departsAt,
        reallocatableTo: substitute ?? null,
        reason: substitute
          ? `Moved to ${this.requireVehicle(substitute).registration}`
          : "No other vehicle in the fleet clears this journey",
      };
    });
  }
}
