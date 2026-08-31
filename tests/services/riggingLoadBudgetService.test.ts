/**
 * Test suite: Stage Rigging Load Budget (#4703)
 * File: tests/services/riggingLoadBudgetService.test.ts
 *
 * The cases that matter here are the ones where the intuitive arithmetic and
 * the real arithmetic disagree: a bridle that raises tension above the share,
 * a beam that passes on total while a point on it fails, and a certificate
 * that lapses between the plan being drafted and the get-in.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  RiggingLoadBudgetService,
  DEFAULT_DYNAMIC_FACTOR,
  type Inspection,
  type RiggedLoad,
} from "../../src/services/riggingLoadBudgetService";

const VENUE = "venue-sports-hall";
const OTHER_VENUE = "venue-studio-theatre";

const BEAM = "struct-roof-beam";
const TRUSS = "struct-truss";
const OTHER_BEAM = "struct-studio-bar";

const POINT_A = "point-a";
const POINT_B = "point-b";
const POINT_C = "point-c";
const POINT_LAPSED = "point-lapsed";
const OTHER_POINT = "point-studio-1";

const PLAN = "plan-winter-ball";
const RIGGER = "rigger-sam";

const GET_IN = new Date("2027-02-10T09:00:00.000Z");
const DAY = 86_400_000;

function day(offset: number): Date {
  return new Date(GET_IN.getTime() + offset * DAY);
}

function validCert(id: string): Inspection {
  return { certificateId: id, inspectedAt: day(-120), validUntil: day(60) };
}

/** Expires eight days after the get-in, so the same plan can be asked twice. */
function shortCert(id: string): Inspection {
  return { certificateId: id, inspectedAt: day(-180), validUntil: day(8) };
}

function load(overrides: Partial<RiggedLoad> = {}): RiggedLoad {
  return {
    loadId: "load-1",
    label: "Projector screen",
    weightKg: 100,
    attachment: "STATIC",
    bridle: { legPointIds: [POINT_A], includedAngleDegrees: 0 },
    ...overrides,
  };
}

function build(): RiggingLoadBudgetService {
  const service = new RiggingLoadBudgetService();

  service.registerStructure({
    structureId: BEAM,
    venueId: VENUE,
    label: "Sports hall roof beam",
    totalSwlKg: 500,
    perPointSwlKg: 250,
    inspection: validCert("cert-beam"),
  });
  service.registerStructure({
    structureId: TRUSS,
    venueId: VENUE,
    label: "Ground-support truss",
    totalSwlKg: 300,
    perPointSwlKg: 200,
    inspection: validCert("cert-truss"),
  });
  service.registerStructure({
    structureId: OTHER_BEAM,
    venueId: OTHER_VENUE,
    label: "Studio lighting bar",
    totalSwlKg: 200,
    perPointSwlKg: 100,
    inspection: validCert("cert-studio"),
  });

  service.registerHardware({
    hardwareId: "hw-hoist-a",
    kind: "HOIST",
    label: "Half-tonne chain hoist",
    swlKg: 500,
    inspection: validCert("cert-hoist-a"),
  });
  service.registerHardware({
    hardwareId: "hw-hoist-b",
    kind: "HOIST",
    label: "Half-tonne chain hoist",
    swlKg: 500,
    inspection: validCert("cert-hoist-b"),
  });
  service.registerHardware({
    hardwareId: "hw-sling-a",
    kind: "SLING",
    label: "2 m round sling",
    swlKg: 300,
    inspection: validCert("cert-sling-a"),
  });
  service.registerHardware({
    hardwareId: "hw-shackle-a",
    kind: "SHACKLE",
    label: "Bow shackle",
    swlKg: 400,
    inspection: validCert("cert-shackle-a"),
  });
  service.registerHardware({
    hardwareId: "hw-sling-weak",
    kind: "SLING",
    label: "1 m steel, the old one",
    swlKg: 120,
    inspection: validCert("cert-sling-weak"),
  });
  service.registerHardware({
    hardwareId: "hw-shackle-short",
    kind: "SHACKLE",
    label: "Bow shackle, due back for inspection",
    swlKg: 400,
    inspection: shortCert("cert-shackle-short"),
  });

  service.registerPoint({
    pointId: POINT_A,
    structureId: BEAM,
    label: "Beam pick 1",
    hardwarePath: ["hw-hoist-a", "hw-sling-a", "hw-shackle-a"],
  });
  service.registerPoint({
    pointId: POINT_B,
    structureId: BEAM,
    label: "Beam pick 2",
    hardwarePath: ["hw-hoist-b", "hw-sling-weak"],
  });
  service.registerPoint({
    pointId: POINT_C,
    structureId: BEAM,
    label: "Beam pick 3",
    hardwarePath: [],
  });
  service.registerPoint({
    pointId: POINT_LAPSED,
    structureId: BEAM,
    label: "Beam pick 4",
    hardwarePath: ["hw-shackle-short"],
  });
  service.registerPoint({
    pointId: OTHER_POINT,
    structureId: OTHER_BEAM,
    label: "Studio pick",
    hardwarePath: [],
  });

  for (const index of [1, 2, 3, 4]) {
    service.registerPoint({
      pointId: `truss-${index}`,
      structureId: TRUSS,
      label: `Truss pick ${index}`,
      hardwarePath: [],
    });
  }

  service.registerRigger({ riggerId: RIGGER, name: "Sam Okafor", validUntil: day(30) });
  service.registerRigger({ riggerId: "rigger-lapsed", name: "Jo Bell", validUntil: day(-1) });

  service.openPlan(PLAN, "event-winter-ball", VENUE);
  return service;
}

describe("RiggingLoadBudgetService (#4703)", () => {
  let service: RiggingLoadBudgetService;

  beforeEach(() => {
    service = build();
  });

  describe("registration", () => {
    test("rejects a duplicate structure", () => {
      expect(() =>
        service.registerStructure({
          structureId: BEAM,
          venueId: VENUE,
          label: "Again",
          totalSwlKg: 500,
          perPointSwlKg: 250,
          inspection: null,
        }),
      ).toThrow(/already registered/i);
    });

    test("rejects a point rated above the beam it sits on", () => {
      expect(() =>
        service.registerStructure({
          structureId: "struct-bad",
          venueId: VENUE,
          label: "Transcribed wrong",
          totalSwlKg: 300,
          perPointSwlKg: 400,
          inspection: null,
        }),
      ).toThrow(/above the whole beam/i);
    });

    test("rejects a structure that carries nothing", () => {
      expect(() =>
        service.registerStructure({
          structureId: "struct-zero",
          venueId: VENUE,
          label: "Zero",
          totalSwlKg: 0,
          perPointSwlKg: 0,
          inspection: null,
        }),
      ).toThrow(/must carry something/i);
    });

    test("rejects duplicate hardware and zero-rated hardware", () => {
      expect(() =>
        service.registerHardware({
          hardwareId: "hw-sling-a",
          kind: "SLING",
          label: "Again",
          swlKg: 300,
          inspection: null,
        }),
      ).toThrow(/already registered/i);

      expect(() =>
        service.registerHardware({
          hardwareId: "hw-zero",
          kind: "SLING",
          label: "Zero",
          swlKg: 0,
          inspection: null,
        }),
      ).toThrow(/must carry something/i);
    });

    test("rejects a point on an unknown structure", () => {
      expect(() =>
        service.registerPoint({
          pointId: "point-x",
          structureId: "struct-none",
          label: "Nowhere",
          hardwarePath: [],
        }),
      ).toThrow(/Unknown structure/i);
    });

    test("rejects a point whose path names unknown hardware", () => {
      expect(() =>
        service.registerPoint({
          pointId: "point-x",
          structureId: BEAM,
          label: "Ghost sling",
          hardwarePath: ["hw-none"],
        }),
      ).toThrow(/Unknown hardware/i);
    });

    test("rejects a duplicate point and a duplicate plan", () => {
      expect(() =>
        service.registerPoint({
          pointId: POINT_A,
          structureId: BEAM,
          label: "Again",
          hardwarePath: [],
        }),
      ).toThrow(/already registered/i);

      expect(() => service.openPlan(PLAN, "event-other", VENUE)).toThrow(/already open/i);
    });

    test("rejects a dynamic factor that would rate a moving load under its weight", () => {
      expect(() => new RiggingLoadBudgetService(0.9)).toThrow(/below 1/i);
    });

    test("an unknown plan or point throws", () => {
      expect(() => service.assess("plan-none", GET_IN)).toThrow(/Unknown plan/i);
      expect(() => service.effectiveCapacity("point-none", GET_IN)).toThrow(/Unknown point/i);
    });
  });

  describe("bridle tension", () => {
    test("a single pick carries the whole load", () => {
      expect(service.legTension(100, "STATIC", 1, 0)).toEqual({
        legTensionKg: 100,
        verticalPerLegKg: 100,
      });
    });

    test("two legs at 120 degrees each carry the entire load, not half of it", () => {
      // The case the module exists for. Halving would have said 50.
      expect(service.legTension(100, "STATIC", 2, 120)).toEqual({
        legTensionKg: 100,
        verticalPerLegKg: 50,
      });
    });

    test("tension climbs with the angle", () => {
      expect(service.legTension(100, "STATIC", 2, 60).legTensionKg).toBe(57.7);
      expect(service.legTension(100, "STATIC", 2, 90).legTensionKg).toBe(70.7);
      expect(service.legTension(100, "STATIC", 2, 120).legTensionKg).toBe(100);
      expect(service.legTension(100, "STATIC", 2, 150).legTensionKg).toBe(193.2);
    });

    test("a wide bridle puts more than the whole load through each leg", () => {
      expect(service.legTension(100, "STATIC", 2, 150).legTensionKg).toBeGreaterThan(100);
    });

    test("the vertical component is always the plain share whatever the angle", () => {
      for (const angle of [10, 60, 120, 170]) {
        expect(service.legTension(100, "STATIC", 2, angle).verticalPerLegKg).toBe(50);
      }
    });

    test("a hoisted load is rated above its resting weight", () => {
      expect(service.legTension(100, "HOISTED", 1, 0).legTensionKg).toBe(
        100 * DEFAULT_DYNAMIC_FACTOR,
      );
      expect(service.legTension(100, "HOISTED", 2, 120)).toEqual({
        legTensionKg: 140,
        verticalPerLegKg: 70,
      });
    });

    test("the dynamic factor is configurable", () => {
      const strict = new RiggingLoadBudgetService(2);
      expect(strict.legTension(100, "HOISTED", 1, 0).legTensionKg).toBe(200);
      expect(strict.legTension(100, "STATIC", 1, 0).legTensionKg).toBe(100);
    });
  });

  describe("adding loads", () => {
    test("a straight pick is accepted", () => {
      expect(service.addLoad(PLAN, load()).outcome).toBe("ADDED");
      expect(service.getPlan(PLAN).loads).toHaveLength(1);
    });

    test("an unknown point is refused", () => {
      expect(
        service.addLoad(
          PLAN,
          load({ bridle: { legPointIds: ["point-none"], includedAngleDegrees: 0 } }),
        ).outcome,
      ).toBe("REFUSED_UNKNOWN_POINT");
      expect(service.getPlan(PLAN).loads).toHaveLength(0);
    });

    test("a point in another venue is refused", () => {
      expect(
        service.addLoad(
          PLAN,
          load({ bridle: { legPointIds: [OTHER_POINT], includedAngleDegrees: 0 } }),
        ).outcome,
      ).toBe("REFUSED_UNKNOWN_POINT");
    });

    test("bridles of nought or three legs are refused rather than approximated", () => {
      expect(
        service.addLoad(PLAN, load({ bridle: { legPointIds: [], includedAngleDegrees: 0 } }))
          .outcome,
      ).toBe("REFUSED_UNSUPPORTED_BRIDLE");

      expect(
        service.addLoad(
          PLAN,
          load({
            bridle: { legPointIds: [POINT_A, POINT_B, POINT_C], includedAngleDegrees: 60 },
          }),
        ).outcome,
      ).toBe("REFUSED_UNSUPPORTED_BRIDLE");
    });

    test("both legs on one point is refused", () => {
      expect(
        service.addLoad(
          PLAN,
          load({ bridle: { legPointIds: [POINT_A, POINT_A], includedAngleDegrees: 60 } }),
        ).outcome,
      ).toBe("REFUSED_DUPLICATE_LEG");
    });

    test("an angle at or past 180 degrees is refused as geometry, not as weight", () => {
      for (const angle of [180, 200, 0, -30]) {
        expect(
          service.addLoad(
            PLAN,
            load({ bridle: { legPointIds: [POINT_A, POINT_C], includedAngleDegrees: angle } }),
          ).outcome,
        ).toBe("REFUSED_BRIDLE_ANGLE");
      }
      expect(service.getPlan(PLAN).loads).toHaveLength(0);
    });

    test("a weightless load is refused", () => {
      expect(service.addLoad(PLAN, load({ weightKg: 0 })).outcome).toBe("REFUSED_WEIGHTLESS");
      expect(service.addLoad(PLAN, load({ weightKg: -5 })).outcome).toBe("REFUSED_WEIGHTLESS");
    });
  });

  describe("the two limits fail independently", () => {
    test("a point fails while the beam total passes", () => {
      service.addLoad(
        PLAN,
        load({
          weightKg: 250,
          bridle: { legPointIds: ["truss-1"], includedAngleDegrees: 0 },
        }),
      );

      const assessment = service.assess(PLAN, GET_IN);
      expect(assessment.safe).toBe(false);
      expect(assessment.points[0].overloaded).toBe(true);
      expect(assessment.structures[0]).toMatchObject({
        structureId: TRUSS,
        appliedKg: 250,
        totalSwlKg: 300,
        overloaded: false,
      });
      expect(assessment.breaches.map((breach) => breach.kind)).toEqual(["POINT_OVERLOAD"]);
    });

    test("the beam total fails while every point passes", () => {
      for (const index of [1, 2, 3, 4]) {
        service.addLoad(
          PLAN,
          load({
            loadId: `load-${index}`,
            weightKg: 100,
            bridle: { legPointIds: [`truss-${index}`], includedAngleDegrees: 0 },
          }),
        );
      }

      const assessment = service.assess(PLAN, GET_IN);
      expect(assessment.points.every((point) => !point.overloaded)).toBe(true);
      expect(assessment.structures[0]).toMatchObject({ appliedKg: 400, overloaded: true });
      expect(assessment.breaches.map((breach) => breach.kind)).toEqual(["STRUCTURE_OVERLOAD"]);
    });
  });

  describe("a bridle overloads points the halving would have cleared", () => {
    test("400 kg across two legs at 120 degrees puts 400 kg through each", () => {
      service.addLoad(
        PLAN,
        load({
          weightKg: 400,
          bridle: { legPointIds: [POINT_A, POINT_C], includedAngleDegrees: 120 },
        }),
      );

      const assessment = service.assess(PLAN, GET_IN);
      // Halving would have said 200 kg a leg against a 250 kg point: safe.
      expect(assessment.points.map((point) => point.appliedKg)).toEqual([400, 400]);
      expect(assessment.points.every((point) => point.overloaded)).toBe(true);
      // And the beam total is untouched by the angle: it still sees 400 kg.
      expect(assessment.structures[0]).toMatchObject({ appliedKg: 400, overloaded: false });
      expect(assessment.breaches).toHaveLength(2);
      expect(assessment.safe).toBe(false);
    });

    test("the same load on a tight bridle is fine", () => {
      service.addLoad(
        PLAN,
        load({
          weightKg: 400,
          bridle: { legPointIds: [POINT_A, POINT_C], includedAngleDegrees: 30 },
        }),
      );

      const assessment = service.assess(PLAN, GET_IN);
      expect(assessment.points.map((point) => point.appliedKg)).toEqual([207.1, 207.1]);
      expect(assessment.safe).toBe(true);
    });

    test("legs on different structures split the vertical between them", () => {
      service.addLoad(
        PLAN,
        load({
          weightKg: 200,
          bridle: { legPointIds: [POINT_A, "truss-1"], includedAngleDegrees: 60 },
        }),
      );

      const assessment = service.assess(PLAN, GET_IN);
      const byStructure = Object.fromEntries(
        assessment.structures.map((entry) => [entry.structureId, entry.appliedKg]),
      );
      expect(byStructure[BEAM]).toBe(100);
      expect(byStructure[TRUSS]).toBe(100);
      expect(assessment.safe).toBe(true);
    });
  });

  describe("the dynamic factor decides marginal loads", () => {
    test("180 kg is safe hanging and over the limit on a hoist", () => {
      service.addLoad(PLAN, load({ weightKg: 180 }));
      expect(service.assess(PLAN, GET_IN).safe).toBe(true);

      service.reweightLoad(PLAN, "load-1", 180);
      service.removeLoad(PLAN, "load-1");
      service.addLoad(PLAN, load({ weightKg: 180, attachment: "HOISTED" }));

      const assessment = service.assess(PLAN, GET_IN);
      expect(assessment.points[0].appliedKg).toBe(252);
      expect(assessment.points[0].overloaded).toBe(true);
    });
  });

  describe("the weakest element governs", () => {
    test("a sling below the beam's per-point rating sets the capacity", () => {
      const capacity = service.effectiveCapacity(POINT_B, GET_IN);
      expect(capacity).toEqual({
        capacityKg: 120,
        governingElementId: "hw-sling-weak",
        governingKind: "SLING",
      });
    });

    test("with nothing weaker in the path the beam governs", () => {
      expect(service.effectiveCapacity(POINT_A, GET_IN)).toEqual({
        capacityKg: 250,
        governingElementId: BEAM,
        governingKind: "STRUCTURE",
      });
      expect(service.effectiveCapacity(POINT_C, GET_IN).governingKind).toBe("STRUCTURE");
    });

    test("the assessment names the element to change", () => {
      service.addLoad(
        PLAN,
        load({ weightKg: 150, bridle: { legPointIds: [POINT_B], includedAngleDegrees: 0 } }),
      );

      const point = service.assess(PLAN, GET_IN).points[0];
      expect(point.overloaded).toBe(true);
      expect(point.governingElementId).toBe("hw-sling-weak");
      expect(service.assess(PLAN, GET_IN).breaches[0].detail).toMatch(/hw-sling-weak/);
    });
  });

  describe("certification governs capacity", () => {
    test("an element out of inspection rates the point at zero", () => {
      expect(service.effectiveCapacity(POINT_LAPSED, day(1)).capacityKg).toBe(250);
      expect(service.effectiveCapacity(POINT_LAPSED, day(20))).toEqual({
        capacityKg: 0,
        governingElementId: "hw-shackle-short",
        governingKind: "SHACKLE",
      });
    });

    test("the same plan is safe before the certificate lapses and not after", () => {
      service.addLoad(
        PLAN,
        load({ weightKg: 100, bridle: { legPointIds: [POINT_LAPSED], includedAngleDegrees: 0 } }),
      );

      expect(service.assess(PLAN, day(1)).safe).toBe(true);

      const after = service.assess(PLAN, day(20));
      expect(after.safe).toBe(false);
      expect(after.breaches[0].kind).toBe("UNCERTIFIED_ELEMENT");
      expect(after.breaches[0].detail).toMatch(/not in inspection/i);
    });

    test("hardware that was never certificated is not rated at all", () => {
      service.registerHardware({
        hardwareId: "hw-uncertified",
        kind: "SHACKLE",
        label: "Found in the store",
        swlKg: 1000,
        inspection: null,
      });
      service.registerPoint({
        pointId: "point-uncertified",
        structureId: BEAM,
        label: "Beam pick 5",
        hardwarePath: ["hw-uncertified"],
      });

      expect(service.effectiveCapacity("point-uncertified", GET_IN).capacityKg).toBe(0);
    });

    test("an uncertified beam takes its own total to zero", () => {
      const bare = new RiggingLoadBudgetService();
      bare.registerStructure({
        structureId: "struct-bare",
        venueId: VENUE,
        label: "Never inspected",
        totalSwlKg: 500,
        perPointSwlKg: 250,
        inspection: null,
      });
      bare.registerPoint({
        pointId: "point-bare",
        structureId: "struct-bare",
        label: "Pick",
        hardwarePath: [],
      });
      bare.openPlan("plan-bare", "event-bare", VENUE);
      bare.addLoad(
        "plan-bare",
        load({ bridle: { legPointIds: ["point-bare"], includedAngleDegrees: 0 } }),
      );

      const assessment = bare.assess("plan-bare", GET_IN);
      expect(assessment.structures[0].totalSwlKg).toBe(0);
      expect(assessment.breaches.map((breach) => breach.kind)).toEqual([
        "UNCERTIFIED_ELEMENT",
        "UNCERTIFIED_ELEMENT",
      ]);
    });
  });

  describe("every breach is reported", () => {
    test("three problems produce three breaches, not the first one", () => {
      service.addLoad(
        PLAN,
        load({
          loadId: "load-heavy",
          weightKg: 300,
          bridle: { legPointIds: ["truss-1"], includedAngleDegrees: 0 },
        }),
      );
      service.addLoad(
        PLAN,
        load({
          loadId: "load-second",
          weightKg: 250,
          bridle: { legPointIds: ["truss-2"], includedAngleDegrees: 0 },
        }),
      );

      const assessment = service.assess(PLAN, GET_IN);
      const kinds = assessment.breaches.map((breach) => breach.kind);
      expect(kinds).toContain("STRUCTURE_OVERLOAD");
      expect(kinds.filter((kind) => kind === "POINT_OVERLOAD")).toHaveLength(2);
      expect(assessment.breaches).toHaveLength(3);
    });

    test("a breach carries the figures the argument will be about", () => {
      service.addLoad(
        PLAN,
        load({ weightKg: 300, bridle: { legPointIds: ["truss-1"], includedAngleDegrees: 0 } }),
      );

      const breach = service
        .assess(PLAN, GET_IN)
        .breaches.find((entry) => entry.kind === "POINT_OVERLOAD")!;
      expect(breach.appliedKg).toBe(300);
      expect(breach.capacityKg).toBe(200);
    });

    test("an empty plan is trivially safe and carries nothing", () => {
      const assessment = service.assess(PLAN, GET_IN);
      expect(assessment.safe).toBe(true);
      expect(assessment.points).toHaveLength(0);
      expect(assessment.structures).toHaveLength(0);
    });
  });

  describe("sign-off", () => {
    beforeEach(() => {
      service.addLoad(PLAN, load({ weightKg: 200 }));
    });

    test("a safe plan is signed off", () => {
      expect(service.signOff(PLAN, RIGGER, GET_IN).outcome).toBe("SIGNED_OFF");
      expect(service.getPlan(PLAN).status).toBe("SIGNED_OFF");
      expect(service.signatureIsCurrent(PLAN)).toBe(true);
    });

    test("an empty plan cannot be signed off", () => {
      service.openPlan("plan-empty", "event-empty", VENUE);
      expect(service.signOff("plan-empty", RIGGER, GET_IN).outcome).toBe("REFUSED_NO_LOADS");
    });

    test("an overloaded plan cannot be signed off", () => {
      service.addLoad(
        PLAN,
        load({
          loadId: "load-2",
          weightKg: 200,
          bridle: { legPointIds: [POINT_A], includedAngleDegrees: 0 },
        }),
      );
      expect(service.signOff(PLAN, RIGGER, GET_IN).outcome).toBe("REFUSED_OVERLOADED");
      expect(service.getPlan(PLAN).status).toBe("DRAFT");
    });

    test("an unknown or lapsed rigger cannot sign", () => {
      expect(service.signOff(PLAN, "rigger-none", GET_IN).outcome).toBe(
        "REFUSED_RIGGER_NOT_COMPETENT",
      );
      expect(service.signOff(PLAN, "rigger-lapsed", GET_IN).outcome).toBe(
        "REFUSED_RIGGER_NOT_COMPETENT",
      );
    });

    test("competency is judged at the moment of signing", () => {
      expect(service.signOff(PLAN, RIGGER, day(40)).outcome).toBe("REFUSED_RIGGER_NOT_COMPETENT");
      expect(service.signOff(PLAN, RIGGER, day(10)).outcome).toBe("SIGNED_OFF");
    });

    test("signing twice is refused", () => {
      service.signOff(PLAN, RIGGER, GET_IN);
      expect(service.signOff(PLAN, RIGGER, GET_IN).outcome).toBe("REFUSED_ALREADY_SIGNED_OFF");
    });

    test("a signed plan will not take another load", () => {
      service.signOff(PLAN, RIGGER, GET_IN);
      expect(service.addLoad(PLAN, load({ loadId: "load-2" })).outcome).toBe(
        "REFUSED_PLAN_NOT_DRAFT",
      );
    });

    test("removing a load voids the signature", () => {
      service.signOff(PLAN, RIGGER, GET_IN);
      expect(service.removeLoad(PLAN, "load-1")).toEqual({ removed: true, voided: true });

      const plan = service.getPlan(PLAN);
      expect(plan.status).toBe("VOIDED");
      expect(plan.signOff).toBeNull();
      expect(plan.voidReason).toMatch(/removed after sign-off/i);
      expect(service.signatureIsCurrent(PLAN)).toBe(false);
    });

    test("re-weighting a load voids the signature", () => {
      service.signOff(PLAN, RIGGER, GET_IN);
      expect(service.reweightLoad(PLAN, "load-1", 150)).toEqual({ updated: true, voided: true });
      expect(service.getPlan(PLAN).status).toBe("VOIDED");
    });

    test("editing a draft voids nothing", () => {
      expect(service.reweightLoad(PLAN, "load-1", 150)).toEqual({ updated: true, voided: false });
      expect(service.removeLoad(PLAN, "load-1")).toEqual({ removed: true, voided: false });
      expect(service.getPlan(PLAN).status).toBe("DRAFT");
    });

    test("removing or re-weighting something absent changes nothing", () => {
      expect(service.removeLoad(PLAN, "load-none")).toEqual({ removed: false, voided: false });
      expect(service.reweightLoad(PLAN, "load-none", 10)).toEqual({
        updated: false,
        voided: false,
      });
      expect(service.reweightLoad(PLAN, "load-1", 0)).toEqual({ updated: false, voided: false });
    });

    test("a voided plan can be signed again once it is put right", () => {
      service.signOff(PLAN, RIGGER, GET_IN);
      service.reweightLoad(PLAN, "load-1", 240);
      expect(service.getPlan(PLAN).status).toBe("VOIDED");
      expect(service.signOff(PLAN, RIGGER, day(1)).outcome).toBe("SIGNED_OFF");
      expect(service.signatureIsCurrent(PLAN)).toBe(true);
    });

    test("a draft has no current signature", () => {
      expect(service.signatureIsCurrent(PLAN)).toBe(false);
    });
  });

  describe("venue summary", () => {
    test("unsafe plans come first, then the worst of the safe ones", () => {
      service.addLoad(PLAN, load({ weightKg: 100 }));

      service.openPlan("plan-b", "event-b", VENUE);
      service.addLoad(
        "plan-b",
        load({ weightKg: 400, bridle: { legPointIds: [POINT_A], includedAngleDegrees: 0 } }),
      );

      service.openPlan("plan-c", "event-c", OTHER_VENUE);

      const summary = service.venueSummary(VENUE, GET_IN);
      expect(summary.map((entry) => entry.planId)).toEqual(["plan-b", PLAN]);
      expect(summary[0].safe).toBe(false);
    });

    test("a venue with no plans summarises to nothing", () => {
      expect(service.venueSummary("venue-none", GET_IN)).toEqual([]);
    });
  });

  describe("the plan is returned by copy", () => {
    test("mutating the returned loads does not reach the service", () => {
      service.addLoad(PLAN, load({ weightKg: 100 }));
      const plan = service.getPlan(PLAN);
      plan.loads[0].weightKg = 9_000;

      expect(service.getPlan(PLAN).loads[0].weightKg).toBe(100);
      expect(service.assess(PLAN, GET_IN).safe).toBe(true);
    });
  });
});
