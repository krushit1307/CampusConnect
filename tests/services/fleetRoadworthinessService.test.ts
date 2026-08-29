/**
 * Test suite: Minibus Fleet Roadworthiness (#5163)
 * File: tests/services/fleetRoadworthinessService.test.ts
 *
 * The cases worth writing down are the ones a booking screen and a "roadworthy"
 * checkbox both miss: the minibus that reaches 6,000km a month before it
 * reaches ten weeks, the 400km booking that crosses the threshold halfway to
 * the fixture, the driver marking their own reported defect as fixed, the same
 * vehicle being lawful for the hockey team and unlawful for the group that
 * hired it, and the MOT that expires between the booking and the journey.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  FleetRoadworthinessService,
  type VehicleBooking,
  type VehicleDefect,
} from "../../src/services/fleetRoadworthinessService";

const INSPECTED_ON = new Date("2029-01-01T09:00:00.000Z");
const DEPARTS = new Date("2029-02-10T07:00:00.000Z");

function defect(
  overrides: Partial<VehicleDefect> & Pick<VehicleDefect, "defectId" | "severity">,
): VehicleDefect {
  return {
    vehicleId: "veh-01",
    description: "Reported at the weekly walkaround",
    reportedBy: "drv-b",
    reportedOn: new Date("2029-02-01T09:00:00.000Z"),
    rectifiedBy: null,
    verifiedBy: null,
    verifiedAt: null,
    ...overrides,
  };
}

function booking(overrides: Partial<VehicleBooking> = {}): VehicleBooking {
  return {
    bookingId: "bkg-01",
    vehicleId: "veh-01",
    driverId: "drv-b",
    purpose: "MEMBERS_NON_PROFIT",
    chargeBasis: "NONE",
    departsAt: DEPARTS,
    estimatedKm: 100,
    carriesPassengers: true,
    abroad: false,
    withTrailer: false,
    ...overrides,
  };
}

function build(): FleetRoadworthinessService {
  const service = new FleetRoadworthinessService();

  service.registerVehicle({
    vehicleId: "veh-01",
    registration: "MB01 UNI",
    maxAuthorisedMassKg: 3500,
    passengerSeats: 16,
    odometerKm: 5800,
    inspectionIntervalWeeks: 10,
    inspectionIntervalKm: 6000,
  });
  service.registerVehicle({
    vehicleId: "veh-02",
    registration: "MB02 UNI",
    maxAuthorisedMassKg: 4600,
    passengerSeats: 16,
    odometerKm: 200,
    inspectionIntervalWeeks: 10,
    inspectionIntervalKm: 6000,
  });
  service.registerVehicle({
    vehicleId: "veh-03",
    registration: "MB03 UNI",
    maxAuthorisedMassKg: 3500,
    passengerSeats: 14,
    odometerKm: 400,
    inspectionIntervalWeeks: 10,
    inspectionIntervalKm: 6000,
  });

  for (const vehicleId of ["veh-01", "veh-02", "veh-03"]) {
    service.recordInspection({
      inspectionId: `insp-${vehicleId}`,
      vehicleId,
      performedOn: INSPECTED_ON,
      odometerKm: vehicleId === "veh-01" ? 0 : 0,
    });
    service.registerDocument({
      vehicleId,
      type: "MOT",
      expiresOn: new Date("2029-06-01T00:00:00.000Z"),
    });
    service.registerDocument({
      vehicleId,
      type: "VEHICLE_TAX",
      expiresOn: new Date("2029-12-01T00:00:00.000Z"),
    });
    service.registerDocument({
      vehicleId,
      type: "INSURANCE",
      expiresOn: new Date("2029-09-01T00:00:00.000Z"),
    });
    service.registerPermit({
      permitId: `per-${vehicleId}`,
      vehicleId,
      permitClass: "SECTION_19",
      membersOnly: true,
      separateChargePermitted: false,
      expiresOn: new Date("2030-01-01T00:00:00.000Z"),
    });
  }

  service.registerDriver({
    driverId: "drv-b",
    dateOfBirth: new Date("2005-01-01T00:00:00.000Z"),
    licenceAcquiredOn: new Date("2024-01-01T00:00:00.000Z"),
    holdsD1: false,
  });
  service.registerDriver({
    driverId: "drv-d1",
    dateOfBirth: new Date("1998-01-01T00:00:00.000Z"),
    licenceAcquiredOn: new Date("2018-01-01T00:00:00.000Z"),
    holdsD1: true,
  });
  service.registerDriver({
    driverId: "drv-young",
    dateOfBirth: new Date("2010-06-01T00:00:00.000Z"),
    licenceAcquiredOn: new Date("2026-08-01T00:00:00.000Z"),
    holdsD1: false,
  });
  service.registerDriver({
    driverId: "drv-new",
    dateOfBirth: new Date("2000-01-01T00:00:00.000Z"),
    licenceAcquiredOn: new Date("2028-01-01T00:00:00.000Z"),
    holdsD1: false,
  });

  return service;
}

function kinds(assessment: { blockers: Array<{ kind: string }> }): string[] {
  return assessment.blockers.map((blocker) => blocker.kind);
}

describe("inspection intervals as whichever comes first", () => {
  let service: FleetRoadworthinessService;

  beforeEach(() => {
    service = build();
  });

  test("a hard-worked minibus reaches its mileage point before its calendar one", () => {
    expect(service.nextInspectionDue("veh-01", 800).trigger).toBe("MILEAGE");
  });

  test("a lightly used one reaches its calendar point first", () => {
    expect(service.nextInspectionDue("veh-01", 200).trigger).toBe("CALENDAR");
  });

  test("a journey that crosses the mileage point is due before it leaves, not after", () => {
    const assessment = service.assessBooking(booking({ estimatedKm: 400 }));

    expect(kinds(assessment)).toContain("INSPECTION_DUE_MID_JOURNEY");
    expect(assessment.permitted).toBe(false);
  });

  test("a short journey on the same vehicle does not cross it", () => {
    expect(service.assessBooking(booking({ estimatedKm: 100 })).permitted).toBe(true);
  });

  test("a departure after the calendar point is overdue rather than due mid-journey", () => {
    const assessment = service.assessBooking(
      booking({ departsAt: new Date("2029-03-20T07:00:00.000Z"), estimatedKm: 50 }),
    );

    expect(kinds(assessment)).toContain("INSPECTION_OVERDUE");
    expect(kinds(assessment)).not.toContain("INSPECTION_DUE_MID_JOURNEY");
  });
});

describe("graded defects and grounding", () => {
  let service: FleetRoadworthinessService;

  beforeEach(() => {
    service = build();
  });

  test("a defect for the next service does not take the vehicle off the road", () => {
    service.reportDefect(defect({ defectId: "dfc-mirror", severity: "RECTIFY_AT_SERVICE" }));

    expect(service.availability("veh-01")).toBe("AVAILABLE");
    expect(service.assessBooking(booking()).permitted).toBe(true);
  });

  test("a failed passenger door lock stops the vehicle carrying passengers", () => {
    service.reportDefect(defect({ defectId: "dfc-door", severity: "GROUND_FOR_PASSENGERS" }));

    const assessment = service.assessBooking(booking());
    expect(assessment.availability).toBe("PASSENGERS_PROHIBITED");
    expect(kinds(assessment)).toContain("PASSENGER_USE_PROHIBITED");
  });

  test("and still lets it be driven to the garage empty", () => {
    service.reportDefect(defect({ defectId: "dfc-door", severity: "GROUND_FOR_PASSENGERS" }));

    const assessment = service.assessBooking(
      booking({ purpose: "REPAIR_MOVEMENT", carriesPassengers: false, estimatedKm: 20 }),
    );

    expect(service.mayMoveForRepair("veh-01")).toBe(true);
    expect(assessment.permitted).toBe(true);
  });

  test("a brake imbalance refuses even the movement to the garage", () => {
    service.reportDefect(defect({ defectId: "dfc-brakes", severity: "GROUND_IMMEDIATELY" }));

    expect(service.availability("veh-01")).toBe("GROUNDED");
    expect(service.mayMoveForRepair("veh-01")).toBe(false);
    expect(
      kinds(
        service.assessBooking(
          booking({ purpose: "REPAIR_MOVEMENT", carriesPassengers: false, estimatedKm: 20 }),
        ),
      ),
    ).toContain("VEHICLE_GROUNDED");
  });

  test("the person who reported a defect cannot be the one who signs it off", () => {
    service.reportDefect(defect({ defectId: "dfc-brakes", severity: "GROUND_IMMEDIATELY" }));

    const selfSigned = service.rectifyDefect("dfc-brakes", {
      rectifiedBy: "drv-b",
      verifiedBy: "drv-b",
      verifiedAt: new Date("2029-02-05T09:00:00.000Z"),
    });

    expect(selfSigned.closed).toBe(false);
    expect(service.availability("veh-01")).toBe("GROUNDED");
  });

  test("a competent person's signature closes it and the vehicle returns to service", () => {
    service.reportDefect(defect({ defectId: "dfc-brakes", severity: "GROUND_IMMEDIATELY" }));

    const verified = service.rectifyDefect("dfc-brakes", {
      rectifiedBy: "gar-fleet",
      verifiedBy: "usr-transport-officer",
      verifiedAt: new Date("2029-02-05T09:00:00.000Z"),
    });

    expect(verified.closed).toBe(true);
    expect(service.availability("veh-01")).toBe("AVAILABLE");
    expect(service.openDefects("veh-01")).toHaveLength(0);
  });
});

describe("permit class as a question about the journey", () => {
  let service: FleetRoadworthinessService;

  beforeEach(() => {
    service = build();
  });

  test("the members-only permit does not cover an external hire on the same vehicle", () => {
    const members = service.assessBooking(booking());
    const hire = service.assessBooking(booking({ purpose: "EXTERNAL_HIRE" }));

    expect(members.permitted).toBe(true);
    expect(kinds(hire)).toContain("PERMIT_CLASS_INVALID");
  });

  test("a non-profit permit does not cover a journey charged at a profit", () => {
    const assessment = service.assessBooking(
      booking({ chargeBasis: "PROFIT", driverId: "drv-d1" }),
    );

    expect(kinds(assessment)).toContain("PERMIT_CLASS_INVALID");
  });

  test("cost recovery is not a profit", () => {
    expect(service.assessBooking(booking({ chargeBasis: "COST_RECOVERY" })).permitted).toBe(true);
  });

  test("a permit that expires before the journey is no permit on the day", () => {
    const expiring = build();
    expiring.registerPermit({
      permitId: "per-old",
      vehicleId: "veh-01",
      permitClass: "SECTION_19",
      membersOnly: true,
      separateChargePermitted: false,
      expiresOn: new Date("2029-01-15T00:00:00.000Z"),
    });

    expect(expiring.assessBooking(booking()).permitted).toBe(true);
  });

  test("a movement for repair does not need a permit at all", () => {
    const noPermit = new FleetRoadworthinessService();
    noPermit.registerVehicle({
      vehicleId: "veh-01",
      registration: "MB01 UNI",
      maxAuthorisedMassKg: 3500,
      passengerSeats: 16,
      odometerKm: 100,
      inspectionIntervalWeeks: 10,
      inspectionIntervalKm: 6000,
    });
    noPermit.recordInspection({
      inspectionId: "insp-01",
      vehicleId: "veh-01",
      performedOn: INSPECTED_ON,
      odometerKm: 0,
    });
    noPermit.registerDriver({
      driverId: "drv-b",
      dateOfBirth: new Date("2005-01-01T00:00:00.000Z"),
      licenceAcquiredOn: new Date("2024-01-01T00:00:00.000Z"),
      holdsD1: false,
    });

    expect(
      noPermit.assessBooking(booking({ purpose: "REPAIR_MOVEMENT", carriesPassengers: false }))
        .permitted,
    ).toBe(true);
    expect(kinds(noPermit.assessBooking(booking()))).toContain("PERMIT_CLASS_INVALID");
  });
});

describe("driver entitlement against the vehicle and the journey", () => {
  let service: FleetRoadworthinessService;

  beforeEach(() => {
    service = build();
  });

  test("a D1 holder takes the heavier minibus and a category B licence does not", () => {
    expect(
      service.assessBooking(booking({ vehicleId: "veh-02", driverId: "drv-d1" })).permitted,
    ).toBe(true);

    const assessment = service.assessBooking(booking({ vehicleId: "veh-02" }));
    expect(kinds(assessment)).toContain("DRIVER_NOT_ENTITLED");
    expect(assessment.blockers[0].detail).toContain("4600kg");
  });

  test("a driver under 21 on the journey date is not entitled whatever the vehicle", () => {
    const assessment = service.assessBooking(booking({ driverId: "drv-young" }));

    expect(assessment.blockers[0].detail).toContain("below the minimum of 21");
  });

  test("a licence held for less than two years is not enough", () => {
    const assessment = service.assessBooking(booking({ driverId: "drv-new" }));

    expect(assessment.blockers[0].detail).toContain("Licence held for");
  });

  test("a trailer takes the journey outside a category B entitlement and stays inside D1", () => {
    expect(kinds(service.assessBooking(booking({ withTrailer: true })))).toContain(
      "DRIVER_NOT_ENTITLED",
    );
    expect(
      service.assessBooking(booking({ withTrailer: true, driverId: "drv-d1" })).permitted,
    ).toBe(true);
  });

  test("a combination too heavy for D1 is refused even for a D1 holder", () => {
    service.registerVehicle({
      vehicleId: "veh-heavy",
      registration: "MB04 UNI",
      maxAuthorisedMassKg: 7600,
      passengerSeats: 16,
      odometerKm: 100,
      inspectionIntervalWeeks: 10,
      inspectionIntervalKm: 6000,
    });
    service.recordInspection({
      inspectionId: "insp-heavy",
      vehicleId: "veh-heavy",
      performedOn: INSPECTED_ON,
      odometerKm: 0,
    });

    service.registerPermit({
      permitId: "per-heavy",
      vehicleId: "veh-heavy",
      permitClass: "SECTION_19",
      membersOnly: true,
      separateChargePermitted: false,
      expiresOn: new Date("2030-01-01T00:00:00.000Z"),
    });

    const assessment = service.assessBooking(
      booking({ vehicleId: "veh-heavy", driverId: "drv-d1", withTrailer: true }),
    );

    expect(kinds(assessment)).toEqual(["DRIVER_NOT_ENTITLED"]);
    expect(assessment.blockers[0].detail).toContain("8350kg");
  });

  test("a journey abroad is outside a category B minibus entitlement", () => {
    expect(service.assessBooking(booking({ abroad: true })).blockers[0].detail).toContain(
      "outside the United Kingdom",
    );
  });

  test("a driver with no record is not entitled rather than assumed to be", () => {
    expect(kinds(service.assessBooking(booking({ driverId: "drv-unknown" })))).toContain(
      "DRIVER_NOT_ENTITLED",
    );
  });
});

describe("documents as at the journey date", () => {
  let service: FleetRoadworthinessService;

  beforeEach(() => {
    service = build();
  });

  test("an MOT that expires between the booking and the journey is a blocker", () => {
    const assessment = service.assessBooking(
      booking({ departsAt: new Date("2029-07-01T07:00:00.000Z"), estimatedKm: 50 }),
    );

    const expired = assessment.blockers.find((blocker) => blocker.kind === "DOCUMENT_EXPIRED");
    expect(expired?.detail).toContain("MOT");
  });

  test("documents in force on the day raise nothing", () => {
    expect(service.documentBlockers("veh-01", DEPARTS)).toEqual([]);
  });

  test("every blocker is reported rather than the first one found", () => {
    service.reportDefect(defect({ defectId: "dfc-brakes", severity: "GROUND_IMMEDIATELY" }));

    const assessment = service.assessBooking(
      booking({
        vehicleId: "veh-01",
        driverId: "drv-young",
        purpose: "EXTERNAL_HIRE",
        departsAt: new Date("2029-07-01T07:00:00.000Z"),
      }),
    );

    expect(kinds(assessment)).toEqual([
      "VEHICLE_GROUNDED",
      "INSPECTION_OVERDUE",
      "DOCUMENT_EXPIRED",
      "PERMIT_CLASS_INVALID",
      "DRIVER_NOT_ENTITLED",
    ]);
  });
});

describe("cascading a grounding onto the bookings already made", () => {
  let service: FleetRoadworthinessService;

  beforeEach(() => {
    service = build();
    service.reportDefect(defect({ defectId: "dfc-brakes", severity: "GROUND_IMMEDIATELY" }));
  });

  test("affected bookings come back soonest first with a substitute where the fleet has one", () => {
    const cascade = service.cascadeGrounding("veh-01", [
      booking({ bookingId: "bkg-late", departsAt: new Date("2029-02-20T07:00:00.000Z") }),
      booking({ bookingId: "bkg-soon", departsAt: new Date("2029-02-12T07:00:00.000Z") }),
      booking({ bookingId: "bkg-other-vehicle", vehicleId: "veh-03" }),
    ]);

    expect(cascade.map((entry) => entry.bookingId)).toEqual(["bkg-soon", "bkg-late"]);
    expect(cascade[0].reallocatableTo).toBe("veh-03");
    expect(cascade[0].reason).toContain("MB03 UNI");
  });

  test("a journey no other vehicle clears is reported as not reallocatable", () => {
    const cascade = service.cascadeGrounding("veh-01", [
      booking({ bookingId: "bkg-trailer", withTrailer: true }),
    ]);

    expect(cascade[0].reallocatableTo).toBeNull();
    expect(cascade[0].reason).toContain("No other vehicle");
  });
});
