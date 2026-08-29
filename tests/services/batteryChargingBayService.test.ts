/**
 * Test suite: Battery Charging Bay Register (#4926)
 * File: tests/services/batteryChargingBayService.test.ts
 *
 * The cases worth writing down are the ones a socket count and a green tick
 * both pass: a bench with sockets to spare and no watt-hours left, a charge
 * that is fine to start after lunch and still running at four in the morning,
 * two packs of identical nominal capacity that are not the same amount of
 * bench, and a swollen pack that somebody wants topped up before the next run.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  BatteryChargingBayService,
  HAZARD_FACTOR,
  LIPO_STORAGE_STATE_OF_CHARGE,
} from "../../src/services/batteryChargingBayService";

const WORKSHOP = "bay-workshop-bench";
const OVERNIGHT = "bay-fireproof-cabinet";
const CUPBOARD = "bay-store-cupboard";
const SOLVENT_BAY = "bay-paint-store";
const SEGREGATED = "bay-quarantine-store";
const TINY = "bay-tiny-shelf";

const LIPO_PACK = "pack-lipo-6s";
const LIPO_BIG = "pack-lipo-competition";
const LIPO_BIG_2 = "pack-lipo-competition-2";
const ION_PACK = "pack-vmount-190";
const ION_SMALL = "pack-vmount-100";
const IRON_PACK = "pack-lifepo4-a";
const IRON_PACK_2 = "pack-lifepo4-b";

const OWNER = "user-robotics-captain";
const REVIEWER = "user-technician-morgan";
const UNTRAINED = "user-committee-member";

/** Midday, well inside supervised hours on every bay below. */
const NOON = new Date("2027-10-14T12:00:00.000Z");
const HOUR = 3_600_000;

function at(hours: number): Date {
  return new Date(NOON.getTime() + hours * HOUR);
}

function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

function build(): BatteryChargingBayService {
  const service = new BatteryChargingBayService();

  // 08:00 to 20:00 supervised on every bay; what differs is what happens after.
  const supervised = { supervisedFromMinute: 480, supervisedToMinute: 1_200 };

  service.registerBay({
    bayId: WORKSHOP,
    label: "Workshop bench",
    energyCapacityWh: 1_000,
    ventilationClass: 2,
    overnightCapable: false,
    segregated: false,
    adjacentHazards: [],
    ...supervised,
  });

  service.registerBay({
    bayId: OVERNIGHT,
    label: "Fireproof cabinet",
    energyCapacityWh: 2_000,
    ventilationClass: 2,
    overnightCapable: true,
    segregated: false,
    adjacentHazards: [],
    ...supervised,
  });

  // Well enough ventilated for lithium-iron and not for anything else.
  service.registerBay({
    bayId: CUPBOARD,
    label: "Store cupboard",
    energyCapacityWh: 500,
    ventilationClass: 1,
    overnightCapable: true,
    segregated: false,
    adjacentHazards: [],
    ...supervised,
  });

  service.registerBay({
    bayId: SOLVENT_BAY,
    label: "Paint store shelf",
    energyCapacityWh: 1_000,
    ventilationClass: 2,
    overnightCapable: true,
    segregated: false,
    adjacentHazards: ["solvent store", "spare stationery"],
    ...supervised,
  });

  service.registerBay({
    bayId: SEGREGATED,
    label: "Quarantine store",
    energyCapacityWh: 500,
    ventilationClass: 2,
    overnightCapable: true,
    segregated: true,
    adjacentHazards: [],
    ...supervised,
  });

  // Exactly one hundred watt-hours of bench, to make the chemistry difference
  // decide the answer on its own.
  service.registerBay({
    bayId: TINY,
    label: "Tiny shelf",
    energyCapacityWh: 100,
    ventilationClass: 2,
    overnightCapable: true,
    segregated: false,
    adjacentHazards: [],
    ...supervised,
  });

  service.prohibitHazard("solvent store");
  service.registerCompetentReviewer(REVIEWER);

  service.registerPack({
    packId: LIPO_PACK,
    ownerId: OWNER,
    label: "6S competition LiPo",
    chemistry: "LIPO",
    capacityWh: 100,
    cellCount: 6,
  });
  service.registerPack({
    packId: LIPO_BIG,
    ownerId: OWNER,
    label: "Competition traction pack",
    chemistry: "LIPO",
    capacityWh: 400,
    cellCount: 12,
  });
  service.registerPack({
    packId: LIPO_BIG_2,
    ownerId: OWNER,
    label: "Competition traction pack (spare)",
    chemistry: "LIPO",
    capacityWh: 400,
    cellCount: 12,
  });
  service.registerPack({
    packId: ION_PACK,
    ownerId: "user-film-society",
    label: "V-mount 190Wh",
    chemistry: "LI_ION",
    capacityWh: 200,
    cellCount: 8,
  });
  service.registerPack({
    packId: ION_SMALL,
    ownerId: "user-film-society",
    label: "V-mount 100Wh",
    chemistry: "LI_ION",
    capacityWh: 100,
    cellCount: 4,
  });
  service.registerPack({
    packId: IRON_PACK,
    ownerId: "user-estates",
    label: "LiFePO4 utility pack",
    chemistry: "LIFEPO4",
    capacityWh: 100,
    cellCount: 4,
  });
  service.registerPack({
    packId: IRON_PACK_2,
    ownerId: "user-estates",
    label: "LiFePO4 utility pack (spare)",
    chemistry: "LIFEPO4",
    capacityWh: 100,
    cellCount: 4,
  });

  return service;
}

describe("BatteryChargingBayService — energy, not sockets", () => {
  let service: BatteryChargingBayService;

  beforeEach(() => {
    service = build();
  });

  test("books a charge that fits the bench", () => {
    const result = service.bookCharge({
      packId: LIPO_PACK,
      bayId: WORKSHOP,
      chargerWatts: 50,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.5,
      startAt: NOON,
    });

    expect(result.outcome).toBe("BOOKED");
    expect(result.session?.reservedWh).toBe(75);
  });

  test("reserves the energy that will be on the bench, not the energy added", () => {
    // Charging from 20% to 50% adds 30 Wh and leaves 50 Wh sitting there.
    const result = service.bookCharge({
      packId: LIPO_PACK,
      bayId: WORKSHOP,
      chargerWatts: 50,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.5,
      startAt: NOON,
    });

    expect(result.session?.reservedWh).toBe(100 * 0.5 * HAZARD_FACTOR.LIPO);
  });

  test("refuses a second pack that takes the bench over its rating", () => {
    service.bookCharge({
      packId: LIPO_BIG,
      bayId: WORKSHOP,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    const second = service.bookCharge({
      packId: LIPO_BIG_2,
      bayId: WORKSHOP,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    expect(second.outcome).toBe("REFUSED_ENERGY_CAPACITY");
  });

  test("reports the overage in watt-hours rather than as a refusal alone", () => {
    service.bookCharge({
      packId: LIPO_BIG,
      bayId: WORKSHOP,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    const second = service.bookCharge({
      packId: LIPO_BIG_2,
      bayId: WORKSHOP,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    expect(second.overageWh).toBe(200);
    expect(second.detail).toContain("200 Wh over");
  });

  test("a refused booking reserves nothing", () => {
    service.bookCharge({
      packId: LIPO_BIG,
      bayId: WORKSHOP,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });
    service.bookCharge({
      packId: LIPO_BIG_2,
      bayId: WORKSHOP,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    expect(service.reservedWhDuring(WORKSHOP, NOON, at(4))).toBe(600);
  });

  test("two charges that do not overlap in time both fit", () => {
    const first = service.bookCharge({
      packId: IRON_PACK,
      bayId: TINY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });
    const second = service.bookCharge({
      packId: IRON_PACK_2,
      bayId: TINY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: at(4),
    });

    expect(first.outcome).toBe("BOOKED");
    expect(second.outcome).toBe("BOOKED");
  });

  test("two charges that overlap by ten minutes do not", () => {
    service.bookCharge({
      packId: IRON_PACK,
      bayId: TINY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    const second = service.bookCharge({
      packId: IRON_PACK_2,
      bayId: TINY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: new Date(NOON.getTime() + 10 * 60_000),
    });

    expect(second.outcome).toBe("REFUSED_ENERGY_CAPACITY");
    expect(second.overageWh).toBe(60);
  });

  test("a completed charge stops holding the bench", () => {
    const first = service.bookCharge({
      packId: IRON_PACK,
      bayId: TINY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });
    service.completeSession(first.session?.sessionId as string);

    expect(service.reservedWhDuring(TINY, NOON, at(1))).toBe(0);
  });

  test("refuses a pack that is already booked onto a charger", () => {
    service.bookCharge({
      packId: IRON_PACK,
      bayId: TINY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    const second = service.bookCharge({
      packId: IRON_PACK,
      bayId: OVERNIGHT,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: at(6),
    });

    expect(second.outcome).toBe("REFUSED_PACK_ALREADY_CHARGING");
  });
});

describe("BatteryChargingBayService — chemistry decides the answer", () => {
  let service: BatteryChargingBayService;

  beforeEach(() => {
    service = build();
  });

  test("three packs of the same capacity are three different amounts of bench", () => {
    expect(service.effectiveLoadWh(LIPO_PACK, 1)).toBe(150);
    expect(service.effectiveLoadWh(ION_SMALL, 1)).toBe(120);
    expect(service.effectiveLoadWh(IRON_PACK, 1)).toBe(80);
  });

  test("the tolerant chemistry fits a bench the intolerant one does not", () => {
    const iron = service.bookCharge({
      packId: IRON_PACK,
      bayId: TINY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });
    service.completeSession(iron.session?.sessionId as string);

    const lipo = service.bookCharge({
      packId: LIPO_PACK,
      bayId: TINY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    expect(iron.outcome).toBe("BOOKED");
    expect(lipo.outcome).toBe("REFUSED_ENERGY_CAPACITY");
    expect(lipo.overageWh).toBe(50);
  });

  test("a bay ventilated for lithium-iron is not ventilated for a LiPo", () => {
    const iron = service.bookCharge({
      packId: IRON_PACK,
      bayId: CUPBOARD,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });
    const lipo = service.bookCharge({
      packId: LIPO_PACK,
      bayId: CUPBOARD,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    expect(iron.outcome).toBe("BOOKED");
    expect(lipo.outcome).toBe("REFUSED_VENTILATION");
    expect(lipo.detail).toContain("class 2");
  });

  test("effectiveLoadWh is zero for a pack that does not exist", () => {
    expect(service.effectiveLoadWh("pack-imaginary", 1)).toBe(0);
  });
});

describe("BatteryChargingBayService — unattended is a property of the finish", () => {
  let service: BatteryChargingBayService;

  beforeEach(() => {
    service = build();
  });

  test("projects the finish from the pack, its state of charge and the charger", () => {
    const finish = service.projectFinish(LIPO_PACK, 50, 0.2, 0.5, NOON) as Date;

    // 30 Wh into the cell, 33.3 Wh drawn at 50 W, forty minutes.
    expect(minutesBetween(NOON, finish)).toBe(40);
  });

  test("a charge that starts supervised and finishes unsupervised is refused", () => {
    const result = service.bookCharge({
      packId: ION_PACK,
      bayId: WORKSHOP,
      chargerWatts: 20,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.4,
      startAt: at(7),
    });

    expect(service.isSupervisedAt(WORKSHOP, at(7))).toBe(true);
    expect(result.outcome).toBe("REFUSED_UNATTENDED_FINISH");
    expect(service.isSupervisedAt(WORKSHOP, result.projectedFinishAt as Date)).toBe(false);
  });

  test("the refusal reports when the charge would still be running", () => {
    const result = service.bookCharge({
      packId: ION_PACK,
      bayId: WORKSHOP,
      chargerWatts: 20,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.4,
      startAt: at(7),
    });

    expect(minutesBetween(at(7), result.projectedFinishAt as Date)).toBe(133);
  });

  test("the same charge is accepted in an overnight-capable bay", () => {
    const result = service.bookCharge({
      packId: ION_PACK,
      bayId: OVERNIGHT,
      chargerWatts: 20,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.4,
      startAt: at(7),
    });

    expect(result.outcome).toBe("BOOKED");
  });

  test("a charge that finishes inside supervised hours is accepted anywhere", () => {
    expect(
      service.bookCharge({
        packId: ION_PACK,
        bayId: WORKSHOP,
        chargerWatts: 200,
        startStateOfCharge: 0.2,
        targetStateOfCharge: 0.4,
        startAt: NOON,
      }).outcome,
    ).toBe("BOOKED");
  });

  test("a LiPo above storage charge must not be left unattended overnight", () => {
    const result = service.bookCharge({
      packId: LIPO_PACK,
      bayId: OVERNIGHT,
      chargerWatts: 20,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.9,
      startAt: at(7),
    });

    expect(result.outcome).toBe("REFUSED_UNATTENDED_FULL_CHARGE");
    expect(result.detail).toContain("90%");
  });

  test("the same LiPo may sit overnight at storage charge", () => {
    const result = service.bookCharge({
      packId: LIPO_PACK,
      bayId: OVERNIGHT,
      chargerWatts: 20,
      startStateOfCharge: 0.2,
      targetStateOfCharge: LIPO_STORAGE_STATE_OF_CHARGE,
      startAt: at(7),
    });

    expect(result.outcome).toBe("BOOKED");
    expect(service.isSupervisedAt(OVERNIGHT, result.projectedFinishAt as Date)).toBe(false);
  });

  test("the same LiPo may be charged full while somebody is watching it", () => {
    expect(
      service.bookCharge({
        packId: LIPO_PACK,
        bayId: OVERNIGHT,
        chargerWatts: 200,
        startStateOfCharge: 0.2,
        targetStateOfCharge: 0.9,
        startAt: NOON,
      }).outcome,
    ).toBe("BOOKED");
  });

  test("supervised hours are inclusive at the start and exclusive at the end", () => {
    expect(service.isSupervisedAt(WORKSHOP, new Date("2027-10-14T08:00:00.000Z"))).toBe(true);
    expect(service.isSupervisedAt(WORKSHOP, new Date("2027-10-14T07:59:00.000Z"))).toBe(false);
    expect(service.isSupervisedAt(WORKSHOP, new Date("2027-10-14T19:59:00.000Z"))).toBe(true);
    expect(service.isSupervisedAt(WORKSHOP, new Date("2027-10-14T20:00:00.000Z"))).toBe(false);
  });

  test("an unknown bay is never supervised", () => {
    expect(service.isSupervisedAt("bay-imaginary", NOON)).toBe(false);
  });
});

describe("BatteryChargingBayService — what else is in the room", () => {
  let service: BatteryChargingBayService;

  beforeEach(() => {
    service = build();
  });

  test("refuses a bay that shares its space with a prohibited hazard", () => {
    const result = service.bookCharge({
      packId: IRON_PACK,
      bayId: SOLVENT_BAY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
    });

    expect(result.outcome).toBe("REFUSED_CO_LOCATION");
    expect(result.detail).toContain("solvent store");
  });

  test("a hazard nobody has prohibited does not block a bay", () => {
    const clean = new BatteryChargingBayService();
    clean.registerBay({
      bayId: SOLVENT_BAY,
      label: "Paint store shelf",
      energyCapacityWh: 1_000,
      ventilationClass: 2,
      supervisedFromMinute: 480,
      supervisedToMinute: 1_200,
      overnightCapable: true,
      segregated: false,
      adjacentHazards: ["spare stationery"],
    });
    clean.registerPack({
      packId: IRON_PACK,
      ownerId: "user-estates",
      label: "LiFePO4 utility pack",
      chemistry: "LIFEPO4",
      capacityWh: 100,
      cellCount: 4,
    });

    expect(
      clean.bookCharge({
        packId: IRON_PACK,
        bayId: SOLVENT_BAY,
        chargerWatts: 200,
        startStateOfCharge: 0.2,
        targetStateOfCharge: 1,
        startAt: NOON,
      }).outcome,
    ).toBe("BOOKED");
  });
});

describe("BatteryChargingBayService — quarantine removes a pack from inventory", () => {
  let service: BatteryChargingBayService;

  beforeEach(() => {
    service = build();
  });

  test("an incident quarantines the pack immediately", () => {
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "SWELLING",
      reportedBy: OWNER,
      reportedAt: NOON,
    });

    expect(service.getPack(LIPO_PACK)?.condition).toBe("QUARANTINED");
    expect(service.getPack(LIPO_PACK)?.quarantineReason).toBe("SWELLING");
  });

  test("a quarantined pack cannot be booked onto any charger", () => {
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "SWELLING",
      reportedBy: OWNER,
      reportedAt: NOON,
    });

    const result = service.bookCharge({
      packId: LIPO_PACK,
      bayId: OVERNIGHT,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.5,
      startAt: NOON,
    });

    expect(result.outcome).toBe("REFUSED_PACK_QUARANTINED");
    expect(result.detail).toContain("SWELLING");
  });

  test("an incident voids a charge that was already booked", () => {
    const booked = service.bookCharge({
      packId: LIPO_PACK,
      bayId: WORKSHOP,
      chargerWatts: 50,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.5,
      startAt: NOON,
    });

    service.recordIncident({
      packId: LIPO_PACK,
      kind: "IMPACT_DAMAGE",
      reportedBy: OWNER,
      reportedAt: NOON,
    });

    expect(service.getSession(booked.session?.sessionId as string)?.status).toBe("VOIDED");
    expect(service.reservedWhDuring(WORKSHOP, NOON, at(2))).toBe(0);
  });

  test("a quarantined pack must not go on a shared bench with capacity to spare", () => {
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "SWELLING",
      reportedBy: OWNER,
      reportedAt: NOON,
    });

    const result = service.assignQuarantineStorage(LIPO_PACK, WORKSHOP);

    expect(result.outcome).toBe("REFUSED_BAY_NOT_SEGREGATED");
    expect(service.reservedWhDuring(WORKSHOP, NOON, at(4))).toBe(0);
  });

  test("a quarantined pack goes to the segregated store", () => {
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "SWELLING",
      reportedBy: OWNER,
      reportedAt: NOON,
    });

    expect(service.assignQuarantineStorage(LIPO_PACK, SEGREGATED).outcome).toBe("STORED");
    expect(service.quarantineLocation(LIPO_PACK)).toBe(SEGREGATED);
  });

  test("a serviceable pack does not belong in segregated storage", () => {
    expect(service.assignQuarantineStorage(LIPO_PACK, SEGREGATED).outcome).toBe(
      "REFUSED_NOT_QUARANTINED",
    );
  });

  test("only a named competent reviewer may return a pack to service", () => {
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "OVER_DISCHARGE",
      reportedBy: OWNER,
      reportedAt: NOON,
    });

    expect(service.releaseFromQuarantine(LIPO_PACK, UNTRAINED).outcome).toBe(
      "REFUSED_REVIEWER_NOT_COMPETENT",
    );
    expect(service.getPack(LIPO_PACK)?.condition).toBe("QUARANTINED");
  });

  test("a competent reviewer can return a recoverable pack to service", () => {
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "OVER_DISCHARGE",
      reportedBy: OWNER,
      reportedAt: NOON,
    });
    service.assignQuarantineStorage(LIPO_PACK, SEGREGATED);

    const result = service.releaseFromQuarantine(LIPO_PACK, REVIEWER);

    expect(result.outcome).toBe("RELEASED");
    expect(service.getPack(LIPO_PACK)?.condition).toBe("SERVICEABLE");
    expect(service.quarantineLocation(LIPO_PACK)).toBeNull();
  });

  test("a released pack can be charged again", () => {
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "FAILED_POST_CHECK",
      reportedBy: OWNER,
      reportedAt: NOON,
    });
    service.releaseFromQuarantine(LIPO_PACK, REVIEWER);

    expect(
      service.bookCharge({
        packId: LIPO_PACK,
        bayId: WORKSHOP,
        chargerWatts: 50,
        startStateOfCharge: 0.2,
        targetStateOfCharge: 0.5,
        startAt: NOON,
      }).outcome,
    ).toBe("BOOKED");
  });

  test("a swollen pack never comes back, whoever reviews it", () => {
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "SWELLING",
      reportedBy: OWNER,
      reportedAt: NOON,
    });

    const result = service.releaseFromQuarantine(LIPO_PACK, REVIEWER);

    expect(result.outcome).toBe("REFUSED_UNRECOVERABLE");
    expect(service.getPack(LIPO_PACK)?.condition).toBe("QUARANTINED");
  });

  test("releasing a pack that is not quarantined reports so", () => {
    expect(service.releaseFromQuarantine(LIPO_PACK, REVIEWER).outcome).toBe(
      "REFUSED_NOT_QUARANTINED",
    );
  });

  test("incidents are kept against the pack", () => {
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "IMPACT_DAMAGE",
      reportedBy: OWNER,
      reportedAt: NOON,
      notes: "Dropped off the bench during the heat",
    });
    service.releaseFromQuarantine(LIPO_PACK, REVIEWER);
    service.recordIncident({
      packId: LIPO_PACK,
      kind: "FAILED_POST_CHECK",
      reportedBy: OWNER,
      reportedAt: at(2),
    });

    const incidents = service.incidentsFor(LIPO_PACK);

    expect(incidents).toHaveLength(2);
    expect(incidents[0].notes).toContain("Dropped off the bench");
  });

  test("an incident against a pack nobody registered records nothing", () => {
    expect(
      service.recordIncident({
        packId: "pack-imaginary",
        kind: "SWELLING",
        reportedBy: OWNER,
        reportedAt: NOON,
      }),
    ).toBeNull();
  });

  test("storage and release refuse unknown packs and bays", () => {
    expect(service.assignQuarantineStorage("pack-imaginary", SEGREGATED).outcome).toBe(
      "REFUSED_UNKNOWN_PACK",
    );
    expect(service.assignQuarantineStorage(LIPO_PACK, "bay-imaginary").outcome).toBe(
      "REFUSED_UNKNOWN_BAY",
    );
    expect(service.releaseFromQuarantine("pack-imaginary", REVIEWER).outcome).toBe(
      "REFUSED_UNKNOWN_PACK",
    );
  });
});

describe("BatteryChargingBayService — amending a booked session", () => {
  let service: BatteryChargingBayService;
  let sessionId: string;

  beforeEach(() => {
    service = build();
    sessionId = service.bookCharge({
      packId: LIPO_PACK,
      bayId: WORKSHOP,
      chargerWatts: 50,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.5,
      startAt: NOON,
    }).session?.sessionId as string;
  });

  test("changing the charger rate voids the session", () => {
    const amendment = service.amendSession(sessionId, { chargerWatts: 200 });

    expect(amendment.voidedSessionId).toBe(sessionId);
    expect(service.getSession(sessionId)?.status).toBe("VOIDED");
  });

  test("changing the target state of charge voids the session", () => {
    service.amendSession(sessionId, { targetStateOfCharge: 0.9 });

    expect(service.getSession(sessionId)?.status).toBe("VOIDED");
  });

  test("changing the window voids the session", () => {
    service.amendSession(sessionId, { startAt: at(7) });

    expect(service.getSession(sessionId)?.status).toBe("VOIDED");
  });

  test("moving the pack to another bay voids the session", () => {
    service.amendSession(sessionId, { bayId: OVERNIGHT });

    expect(service.getSession(sessionId)?.status).toBe("VOIDED");
  });

  test("a voided session stops holding the bench", () => {
    service.amendSession(sessionId, { chargerWatts: 200 });

    expect(service.reservedWhDuring(WORKSHOP, NOON, at(2))).toBe(0);
  });

  test("the amended charge has to be re-booked and re-assessed", () => {
    service.amendSession(sessionId, { targetStateOfCharge: 0.9 });

    const rebooked = service.bookCharge({
      packId: LIPO_PACK,
      bayId: WORKSHOP,
      chargerWatts: 50,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 0.9,
      startAt: at(7),
    });

    expect(rebooked.outcome).toBe("REFUSED_UNATTENDED_FINISH");
  });

  test("an amendment that changes nothing voids nothing", () => {
    expect(service.amendSession(sessionId, {}).amended).toBe(false);
    expect(service.getSession(sessionId)?.status).toBe("BOOKED");
  });

  test("a session cannot be amended twice", () => {
    service.amendSession(sessionId, { chargerWatts: 200 });

    expect(service.amendSession(sessionId, { chargerWatts: 100 }).amended).toBe(false);
  });

  test("amending a session that does not exist reports no change", () => {
    expect(service.amendSession("session-imaginary", { chargerWatts: 100 }).amended).toBe(false);
  });

  test("cancelling records why", () => {
    expect(service.cancelSession(sessionId, "Competition postponed")).toBe(true);
    expect(service.getSession(sessionId)?.voidedReason).toBe("Competition postponed");
  });

  test("a session cannot be cancelled or completed twice", () => {
    service.completeSession(sessionId);

    expect(service.completeSession(sessionId)).toBe(false);
    expect(service.cancelSession(sessionId, "Too late")).toBe(false);
  });
});

describe("BatteryChargingBayService — inputs that are not a charge", () => {
  let service: BatteryChargingBayService;

  beforeEach(() => {
    service = build();
  });

  function book(overrides: Record<string, number>): string {
    return service.bookCharge({
      packId: IRON_PACK,
      bayId: TINY,
      chargerWatts: 200,
      startStateOfCharge: 0.2,
      targetStateOfCharge: 1,
      startAt: NOON,
      ...overrides,
    }).outcome;
  }

  test("refuses a target at or below the current state of charge", () => {
    expect(book({ targetStateOfCharge: 0.2 })).toBe("REFUSED_INVALID_CHARGE_STATE");
    expect(book({ targetStateOfCharge: 0.1 })).toBe("REFUSED_INVALID_CHARGE_STATE");
  });

  test("refuses a target above full", () => {
    expect(book({ targetStateOfCharge: 1.2 })).toBe("REFUSED_INVALID_CHARGE_STATE");
  });

  test("refuses a negative starting state of charge", () => {
    expect(book({ startStateOfCharge: -0.1 })).toBe("REFUSED_INVALID_CHARGE_STATE");
  });

  test("refuses a charger that supplies nothing", () => {
    expect(book({ chargerWatts: 0 })).toBe("REFUSED_INVALID_CHARGE_STATE");
  });

  test("projectFinish returns nothing for an impossible charge", () => {
    expect(service.projectFinish(IRON_PACK, 200, 0.5, 0.5, NOON)).toBeNull();
    expect(service.projectFinish(IRON_PACK, 0, 0.2, 1, NOON)).toBeNull();
    expect(service.projectFinish("pack-imaginary", 200, 0.2, 1, NOON)).toBeNull();
  });

  test("refuses a pack or bay nobody registered", () => {
    expect(
      service.bookCharge({
        packId: "pack-imaginary",
        bayId: TINY,
        chargerWatts: 200,
        startStateOfCharge: 0.2,
        targetStateOfCharge: 1,
        startAt: NOON,
      }).outcome,
    ).toBe("REFUSED_UNKNOWN_PACK");

    expect(
      service.bookCharge({
        packId: IRON_PACK,
        bayId: "bay-imaginary",
        chargerWatts: 200,
        startStateOfCharge: 0.2,
        targetStateOfCharge: 1,
        startAt: NOON,
      }).outcome,
    ).toBe("REFUSED_UNKNOWN_BAY");
  });
});

describe("BatteryChargingBayService — registration guards", () => {
  let service: BatteryChargingBayService;

  beforeEach(() => {
    service = build();
  });

  test("rejects a pack with no capacity", () => {
    expect(() =>
      service.registerPack({
        packId: "pack-x",
        ownerId: OWNER,
        label: "X",
        chemistry: "LIPO",
        capacityWh: 0,
        cellCount: 4,
      }),
    ).toThrow(/non-positive capacity/);
  });

  test("rejects a pack with no cells", () => {
    expect(() =>
      service.registerPack({
        packId: "pack-x",
        ownerId: OWNER,
        label: "X",
        chemistry: "LIPO",
        capacityWh: 100,
        cellCount: 0,
      }),
    ).toThrow(/non-positive cell count/);
  });

  test("rejects a bay with no energy capacity", () => {
    expect(() =>
      service.registerBay({
        bayId: "bay-x",
        label: "X",
        energyCapacityWh: 0,
        ventilationClass: 2,
        supervisedFromMinute: 480,
        supervisedToMinute: 1_200,
        overnightCapable: false,
        segregated: false,
        adjacentHazards: [],
      }),
    ).toThrow(/non-positive energy capacity/);
  });

  test("rejects a bay whose supervised window makes no sense", () => {
    const invalid = [
      { supervisedFromMinute: 1_200, supervisedToMinute: 480 },
      { supervisedFromMinute: -1, supervisedToMinute: 1_200 },
      { supervisedFromMinute: 480, supervisedToMinute: 1_500 },
      { supervisedFromMinute: 480, supervisedToMinute: 480 },
    ];

    for (const window of invalid) {
      expect(() =>
        service.registerBay({
          bayId: "bay-x",
          label: "X",
          energyCapacityWh: 500,
          ventilationClass: 2,
          overnightCapable: false,
          segregated: false,
          adjacentHazards: [],
          ...window,
        }),
      ).toThrow(/invalid supervised window/);
    }
  });

  test("getters return nothing for records that were never created", () => {
    expect(service.getPack("pack-imaginary")).toBeNull();
    expect(service.getSession("session-imaginary")).toBeNull();
    expect(service.quarantineLocation("pack-imaginary")).toBeNull();
    expect(service.incidentsFor("pack-imaginary")).toEqual([]);
  });

  test("a new pack starts serviceable", () => {
    expect(service.getPack(LIPO_PACK)?.condition).toBe("SERVICEABLE");
    expect(service.getPack(LIPO_PACK)?.quarantineReason).toBeNull();
  });
});
