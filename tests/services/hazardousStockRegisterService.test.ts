/**
 * Test suite: Hazardous Consumable Shelf-Life and Segregation Register (#4707)
 * File: tests/services/hazardousStockRegisterService.test.ts
 *
 * The cases that carry the weight here are the ones the asset table cannot
 * express: an expiry that starts when somebody breaks a seal, a bottle whose
 * expiry is a disposal deadline rather than a use-by, and a cabinet made
 * unlawful by the arrival of something unremarkable.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  HazardousStockRegisterService,
  type HazardClassSpec,
  type StockItem,
} from "../../src/services/hazardousStockRegisterService";

const FLAMMABLE = "FLAMMABLE_LIQUID";
const OXIDISER = "OXIDISER";
const PEROXIDE = "PEROXIDE_FORMER";

const CHEM_CUPBOARD = "loc-chem-cupboard";
const OXIDISER_CABINET = "loc-oxidiser-cabinet";
const MIXED_STORE = "loc-mixed-store";
const LICENSED = "loc-licensed-store";

const CLUB = "club-chemistry";

const NOW = new Date("2027-09-01T09:00:00.000Z");
const DAY = 86_400_000;

function day(offset: number): Date {
  return new Date(NOW.getTime() + offset * DAY);
}

function flammableClass(): HazardClassSpec {
  return {
    classId: FLAMMABLE,
    label: "Flammable liquid",
    unit: "ML",
    postOpeningDays: 365,
    peroxideFormer: false,
    immovableAfterDays: null,
    disposalRoute: "SOLVENT_WASTE",
  };
}

function oxidiserClass(): HazardClassSpec {
  return {
    classId: OXIDISER,
    label: "Oxidising agent",
    unit: "G",
    postOpeningDays: null,
    peroxideFormer: false,
    immovableAfterDays: null,
    disposalRoute: "OXIDISER_WASTE",
  };
}

function peroxideClass(): HazardClassSpec {
  return {
    classId: PEROXIDE,
    label: "Peroxide-forming solvent",
    unit: "ML",
    postOpeningDays: 180,
    peroxideFormer: true,
    immovableAfterDays: 90,
    disposalRoute: "SPECIALIST_UPLIFT",
  };
}

function item(overrides: Partial<StockItem> = {}): StockItem {
  return {
    itemId: "item-acetone",
    clubId: CLUB,
    substance: "Acetone",
    classId: FLAMMABLE,
    nominalQuantity: 500,
    unit: "ML",
    manufacturedOn: day(-800),
    labelExpiry: day(400),
    openedOn: null,
    locationId: CHEM_CUPBOARD,
    ...overrides,
  };
}

function oxidiserItem(overrides: Partial<StockItem> = {}): StockItem {
  return item({
    itemId: "item-perchlorate",
    substance: "Potassium perchlorate",
    classId: OXIDISER,
    nominalQuantity: 400,
    unit: "G",
    locationId: OXIDISER_CABINET,
    ...overrides,
  });
}

/** Opened two hundred days ago against a one-hundred-and-eighty-day clock. */
function etherItem(overrides: Partial<StockItem> = {}): StockItem {
  return item({
    itemId: "item-ether",
    substance: "Diethyl ether",
    classId: PEROXIDE,
    nominalQuantity: 250,
    unit: "ML",
    openedOn: day(-200),
    locationId: CHEM_CUPBOARD,
    ...overrides,
  });
}

function build(): HazardousStockRegisterService {
  const service = new HazardousStockRegisterService();

  service.registerClass(flammableClass());
  service.registerClass(oxidiserClass());
  service.registerClass(peroxideClass());

  service.registerSegregationRule({
    classA: FLAMMABLE,
    classB: OXIDISER,
    reason: "an oxidiser beside a flammable turns a spill into a fire",
  });
  service.registerSegregationRule({
    classA: PEROXIDE,
    classB: OXIDISER,
    reason: "peroxides and oxidisers escalate one another",
  });

  service.registerLocation({
    locationId: CHEM_CUPBOARD,
    label: "Chem soc cupboard",
    licensedStore: false,
    classLimits: { [FLAMMABLE]: 2_000, [PEROXIDE]: 500 },
  });
  service.registerLocation({
    locationId: OXIDISER_CABINET,
    label: "Oxidiser cabinet",
    licensedStore: false,
    classLimits: { [OXIDISER]: 1_000 },
  });
  service.registerLocation({
    locationId: MIXED_STORE,
    label: "Mixed store",
    licensedStore: false,
    classLimits: { [FLAMMABLE]: 2_000, [OXIDISER]: 1_000 },
  });
  service.registerLocation({
    locationId: LICENSED,
    label: "Licensed store",
    licensedStore: true,
    classLimits: {},
  });

  return service;
}

describe("HazardousStockRegisterService (#4707)", () => {
  let service: HazardousStockRegisterService;

  beforeEach(() => {
    service = build();
  });

  describe("registration", () => {
    test("rejects a duplicate class and an unknown one", () => {
      expect(() => service.registerClass(flammableClass())).toThrow(/already registered/i);
      expect(() => service.assessExpiry("item-none", NOW)).toThrow(/Unknown item/i);
    });

    test("rejects a peroxide-former with no opening clock", () => {
      expect(() =>
        service.registerClass({ ...peroxideClass(), classId: "PX2", postOpeningDays: null }),
      ).toThrow(/must carry a post-opening clock/i);
    });

    test("rejects a post-opening life of nothing", () => {
      expect(() =>
        service.registerClass({ ...flammableClass(), classId: "F2", postOpeningDays: 0 }),
      ).toThrow(/life of nothing/i);
    });

    test("rejects a class segregated from itself", () => {
      expect(() =>
        service.registerSegregationRule({ classA: FLAMMABLE, classB: FLAMMABLE, reason: "no" }),
      ).toThrow(/cannot be segregated from itself/i);
    });

    test("rejects a location limiting an unknown class or limiting it negatively", () => {
      expect(() =>
        service.registerLocation({
          locationId: "loc-x",
          label: "X",
          licensedStore: false,
          classLimits: { NOPE: 100 },
        }),
      ).toThrow(/Unknown hazard class/i);

      expect(() =>
        service.registerLocation({
          locationId: "loc-y",
          label: "Y",
          licensedStore: false,
          classLimits: { [FLAMMABLE]: -1 },
        }),
      ).toThrow(/negative limit/i);
    });

    test("rejects an item whose unit disagrees with its class", () => {
      expect(() => service.registerExistingStock(item({ unit: "G" }), NOW)).toThrow(
        /measured in G but/i,
      );
    });

    test("rejects an item with no quantity or opened before it was made", () => {
      expect(() => service.registerExistingStock(item({ nominalQuantity: 0 }), NOW)).toThrow(
        /no quantity/i,
      );
      expect(() => service.registerExistingStock(item({ openedOn: day(-900) }), NOW)).toThrow(
        /opened before it was made/i,
      );
    });
  });

  describe("shelf life runs from opening", () => {
    test("a sealed container expires on the label date", () => {
      service.registerExistingStock(item(), NOW);
      const expiry = service.assessExpiry("item-acetone", NOW);

      expect(expiry.effectiveExpiry).toEqual(day(400));
      expect(expiry.openingClockApplied).toBe(false);
      expect(expiry.expired).toBe(false);
    });

    test("opening it starts a shorter clock and the label stays on the record", () => {
      service.registerExistingStock(item(), NOW);
      service.openItem("item-acetone", NOW);

      const expiry = service.assessExpiry("item-acetone", NOW);
      expect(expiry.openingClockApplied).toBe(true);
      expect(expiry.effectiveExpiry).toEqual(day(365));
      expect(expiry.labelExpiry).toEqual(day(400));
      expect(expiry.labelBoundTheClock).toBe(false);
    });

    test("opening never extends the life past what the label says", () => {
      service.registerExistingStock(item({ labelExpiry: day(100) }), NOW);
      service.openItem("item-acetone", NOW);

      const expiry = service.assessExpiry("item-acetone", NOW);
      // The clock would have run to day 365. The tin says day 100.
      expect(expiry.effectiveExpiry).toEqual(day(100));
      expect(expiry.labelBoundTheClock).toBe(true);
    });

    test("a class with no opening clock is governed by its label whatever its state", () => {
      service.registerExistingStock(oxidiserItem({ openedOn: day(-500) }), NOW);
      const expiry = service.assessExpiry("item-perchlorate", NOW);

      expect(expiry.openingClockApplied).toBe(false);
      expect(expiry.effectiveExpiry).toEqual(day(400));
    });

    test("a container cannot be opened twice", () => {
      service.registerExistingStock(item(), NOW);
      service.openItem("item-acetone", NOW);
      expect(() => service.openItem("item-acetone", day(1))).toThrow(/already open/i);
    });

    test("expiry is asked about an instant, so the same item answers differently", () => {
      service.registerExistingStock(item(), NOW);
      service.openItem("item-acetone", NOW);

      expect(service.assessExpiry("item-acetone", day(300)).expired).toBe(false);
      expect(service.assessExpiry("item-acetone", day(400)).expired).toBe(true);
      expect(service.assessExpiry("item-acetone", day(400)).daysPastExpiry).toBe(35);
    });
  });

  describe("a peroxide-former's expiry is a deadline, not a suggestion", () => {
    beforeEach(() => service.registerExistingStock(etherItem(), NOW));

    test("it is already twenty days past its deadline", () => {
      const expiry = service.assessExpiry("item-ether", NOW);

      expect(expiry.effectiveExpiry).toEqual(day(-20));
      expect(expiry.expired).toBe(true);
      expect(expiry.daysPastExpiry).toBe(20);
      expect(expiry.deadlineKind).toBe("DISPOSAL_DEADLINE");
    });

    test("an ordinary solvent past its date is only a use-by", () => {
      service.registerExistingStock(item({ labelExpiry: day(-20) }), NOW);
      expect(service.assessExpiry("item-acetone", NOW).deadlineKind).toBe("USE_BY");
    });

    test("within the window it can still be routed for disposal", () => {
      const routing = service.disposalRoute("item-ether", NOW);

      expect(routing.routed).toBe(true);
      expect(routing.route).toBe("SPECIALIST_UPLIFT");
      expect(routing.reason).toMatch(/may still be moved/i);
    });

    test("past the further threshold it must be assessed where it stands", () => {
      const expiry = service.assessExpiry("item-ether", day(100));
      expect(expiry.daysPastExpiry).toBe(120);
      expect(expiry.immovable).toBe(true);
    });

    test("refusing to produce a route is the correct output for one that cannot move", () => {
      const routing = service.disposalRoute("item-ether", day(100));

      expect(routing.routed).toBe(false);
      expect(routing.route).toBeNull();
      expect(routing.reason).toMatch(/assessed in place/i);
      expect(service.dispose("item-ether", day(100))).toEqual({
        disposed: false,
        reason: routing.reason,
      });
    });

    test("an immovable container cannot be transferred either", () => {
      expect(service.transferItem("item-ether", LICENSED, day(100)).outcome).toBe(
        "REFUSED_IMMOVABLE",
      );
      expect(service.transferItem("item-ether", LICENSED, NOW).outcome).toBe("TRANSFERRED");
    });

    test("a solvent that never becomes immovable is routed however old it is", () => {
      service.registerExistingStock(item({ labelExpiry: day(-900) }), NOW);
      const routing = service.disposalRoute("item-acetone", NOW);

      expect(routing.routed).toBe(true);
      expect(routing.route).toBe("SOLVENT_WASTE");
      expect(routing.reason).toBe("Routine disposal");
    });

    test("disposal empties the container through the log", () => {
      service.dispose("item-ether", NOW);
      expect(service.remainingQuantity("item-ether", NOW)).toBe(0);
      expect(service.contentsOf(CHEM_CUPBOARD, NOW)).toEqual([]);
    });
  });

  describe("segregation is a property of the set", () => {
    test("each item is unremarkable in its own cabinet", () => {
      service.registerExistingStock(item(), NOW);
      service.registerExistingStock(oxidiserItem(), NOW);

      expect(service.assessLocation(CHEM_CUPBOARD, NOW).compliant).toBe(true);
      expect(service.assessLocation(OXIDISER_CABINET, NOW).compliant).toBe(true);
    });

    test("a lawful arrival makes a lawful cabinet unlawful, so it is refused", () => {
      service.registerExistingStock(item({ locationId: MIXED_STORE }), NOW);
      service.registerExistingStock(oxidiserItem(), NOW);

      const result = service.transferItem("item-perchlorate", MIXED_STORE, NOW);
      expect(result.outcome).toBe("REFUSED_SEGREGATION");
      expect(result.breaches[0].detail).toMatch(/turns a spill into a fire/i);
      // And nothing moved.
      expect(service.contentsOf(MIXED_STORE, NOW).map((entry) => entry.itemId)).toEqual([
        "item-acetone",
      ]);
    });

    test("receiving into the same cabinet is refused on the same grounds", () => {
      service.registerExistingStock(item({ locationId: MIXED_STORE }), NOW);

      const result = service.receiveItem(
        oxidiserItem({ itemId: "item-new-oxidiser", locationId: MIXED_STORE }),
        NOW,
      );
      expect(result.outcome).toBe("REFUSED_SEGREGATION");
      expect(service.contentsOf(MIXED_STORE, NOW)).toHaveLength(1);
    });

    test("emptying a bad cupboard into another bad one is not a fix", () => {
      // The audit found both in one cupboard. It is already unlawful.
      service.registerExistingStock(item({ locationId: MIXED_STORE }), NOW);
      service.registerExistingStock(oxidiserItem({ locationId: MIXED_STORE }), NOW);
      service.registerExistingStock(
        item({ itemId: "item-white-spirit", substance: "White spirit", locationId: CHEM_CUPBOARD }),
        NOW,
      );

      expect(service.assessLocation(MIXED_STORE, NOW).compliant).toBe(false);

      // Moving the oxidiser would fix the mixed store and break the cupboard.
      const result = service.transferItem("item-perchlorate", CHEM_CUPBOARD, NOW);
      expect(result.outcome).toBe("REFUSED_SEGREGATION");
      expect(service.assessLocation(MIXED_STORE, NOW).compliant).toBe(false);
    });

    test("the licensed store still segregates", () => {
      service.registerExistingStock(item({ locationId: LICENSED }), NOW);
      service.registerExistingStock(oxidiserItem(), NOW);

      expect(service.transferItem("item-perchlorate", LICENSED, NOW).outcome).toBe(
        "REFUSED_SEGREGATION",
      );
    });

    test("segregation rules read the same way round either way", () => {
      service.registerExistingStock(oxidiserItem({ locationId: MIXED_STORE }), NOW);
      service.registerExistingStock(item(), NOW);

      expect(service.transferItem("item-acetone", MIXED_STORE, NOW).outcome).toBe(
        "REFUSED_SEGREGATION",
      );
    });
  });

  describe("limits are on the aggregate, not the container", () => {
    test("four containers well under the limit are fine and the fifth is not", () => {
      for (const index of [1, 2, 3, 4]) {
        const result = service.receiveItem(
          item({ itemId: `item-solvent-${index}`, nominalQuantity: 500 }),
          NOW,
        );
        expect(result.outcome).toBe("RECEIVED");
      }

      expect(service.assessLocation(CHEM_CUPBOARD, NOW).quantityByClass[FLAMMABLE]).toBe(2_000);

      const fifth = service.receiveItem(item({ itemId: "item-solvent-5" }), NOW);
      expect(fifth.outcome).toBe("REFUSED_CLASS_LIMIT");
      expect(fifth.breaches[0]).toMatchObject({ quantity: 2_500, limit: 2_000 });
      // No single bottle comes near the limit.
      expect(fifth.breaches[0].detail).toMatch(/licensed store/i);
    });

    test("the licensed store carries no aggregate limit", () => {
      for (const index of [1, 2, 3, 4, 5, 6] as const) {
        expect(
          service.receiveItem(item({ itemId: `item-store-${index}`, locationId: LICENSED }), NOW)
            .outcome,
        ).toBe("RECEIVED");
      }
      expect(service.assessLocation(LICENSED, NOW).compliant).toBe(true);
    });

    test("a cupboard is not rated for a class it has no limit for", () => {
      // An empty cupboard has nothing to segregate the oxidiser from, so the
      // only thing left to refuse on is that it is not rated to hold one.
      const result = service.receiveItem(
        oxidiserItem({ itemId: "item-ox-new", locationId: CHEM_CUPBOARD }),
        NOW,
      );
      expect(result.outcome).toBe("REFUSED_UNRATED_CLASS");
      expect(result.breaches[0]).toMatchObject({ kind: "UNRATED_CLASS", limit: 0 });

      // Put a flammable in it and segregation refuses first, on better grounds.
      service.registerExistingStock(item(), NOW);
      expect(
        service.receiveItem(oxidiserItem({ itemId: "item-ox-2", locationId: CHEM_CUPBOARD }), NOW)
          .outcome,
      ).toBe("REFUSED_SEGREGATION");
    });

    test("decanting frees the aggregate back up", () => {
      for (const index of [1, 2, 3, 4]) {
        service.receiveItem(item({ itemId: `item-solvent-${index}` }), NOW);
      }
      expect(service.receiveItem(item({ itemId: "item-solvent-5" }), NOW).outcome).toBe(
        "REFUSED_CLASS_LIMIT",
      );

      service.decant("item-solvent-1", 500, day(1));
      expect(service.receiveItem(item({ itemId: "item-solvent-5" }), day(2)).outcome).toBe(
        "RECEIVED",
      );
    });
  });

  describe("quantity is folded, not edited", () => {
    beforeEach(() => service.registerExistingStock(item(), NOW));

    test("a receipt fills the container and decants take from it", () => {
      expect(service.remainingQuantity("item-acetone", NOW)).toBe(500);

      service.decant("item-acetone", 100, day(1));
      service.decant("item-acetone", 50, day(2));
      expect(service.remainingQuantity("item-acetone", day(2))).toBe(350);
    });

    test("the fold respects the instant it is asked about", () => {
      service.decant("item-acetone", 100, day(5));
      expect(service.remainingQuantity("item-acetone", day(1))).toBe(500);
      expect(service.remainingQuantity("item-acetone", day(5))).toBe(400);
    });

    test("a decant beyond what is left is refused", () => {
      expect(() => service.decant("item-acetone", 600, day(1))).toThrow(/only 500 remains/i);
      expect(() => service.decant("item-acetone", 0, day(1))).toThrow(/takes nothing out/i);
    });

    test("an empty container is out of the cupboard and cannot be moved", () => {
      service.decant("item-acetone", 500, day(1));

      expect(service.contentsOf(CHEM_CUPBOARD, day(1))).toEqual([]);
      expect(service.transferItem("item-acetone", LICENSED, day(1)).outcome).toBe(
        "REFUSED_EXHAUSTED",
      );
    });

    test("the movement log keeps every step", () => {
      service.decant("item-acetone", 100, day(1));
      service.transferItem("item-acetone", LICENSED, day(2));

      expect(service.movementLog("item-acetone").map((entry) => entry.kind)).toEqual([
        "RECEIPT",
        "DECANT",
        "TRANSFER",
      ]);
    });
  });

  describe("every breach is reported", () => {
    test("a cabinet with three problems reports three, not the first", () => {
      service.registerExistingStock(item({ locationId: MIXED_STORE }), NOW);
      service.registerExistingStock(oxidiserItem({ locationId: MIXED_STORE }), NOW);
      service.registerExistingStock(
        item({
          itemId: "item-old-solvent",
          nominalQuantity: 1_800,
          labelExpiry: day(-30),
          locationId: MIXED_STORE,
        }),
        NOW,
      );

      const assessment = service.assessLocation(MIXED_STORE, NOW);
      const kinds = assessment.breaches.map((breach) => breach.kind);

      expect(kinds).toContain("SEGREGATION");
      expect(kinds).toContain("CLASS_LIMIT");
      expect(kinds).toContain("EXPIRED");
      expect(assessment.compliant).toBe(false);
      expect(assessment.breaches.length).toBeGreaterThanOrEqual(3);
    });

    test("an overdue peroxide-former reports the deadline and the immovability", () => {
      service.registerExistingStock(etherItem(), NOW);

      const kinds = service
        .assessLocation(CHEM_CUPBOARD, day(100))
        .breaches.map((breach) => breach.kind);
      expect(kinds).toEqual(["DISPOSAL_OVERDUE", "IMMOVABLE"]);
    });

    test("an empty cupboard is compliant", () => {
      const assessment = service.assessLocation(CHEM_CUPBOARD, NOW);
      expect(assessment.compliant).toBe(true);
      expect(assessment.breaches).toEqual([]);
      expect(assessment.quantityByClass).toEqual({});
    });

    test("the worst cupboard is listed first", () => {
      service.registerExistingStock(item({ locationId: MIXED_STORE }), NOW);
      service.registerExistingStock(oxidiserItem({ locationId: MIXED_STORE }), NOW);
      service.registerExistingStock(etherItem(), NOW);

      const bad = service.nonCompliantLocations(day(100));
      expect(bad[0].locationId).toBe(CHEM_CUPBOARD);
      expect(bad.map((entry) => entry.locationId)).toEqual([CHEM_CUPBOARD, MIXED_STORE]);
    });
  });

  describe("transfer guards", () => {
    beforeEach(() => service.registerExistingStock(item(), NOW));

    test("an unknown destination is refused", () => {
      expect(service.transferItem("item-acetone", "loc-none", NOW).outcome).toBe(
        "REFUSED_UNKNOWN_LOCATION",
      );
    });

    test("moving something to where it already is is refused", () => {
      expect(service.transferItem("item-acetone", CHEM_CUPBOARD, NOW).outcome).toBe(
        "REFUSED_SAME_LOCATION",
      );
    });

    test("a lawful transfer moves it and leaves a trail", () => {
      expect(service.transferItem("item-acetone", LICENSED, NOW).outcome).toBe("TRANSFERRED");
      expect(service.contentsOf(LICENSED, NOW).map((entry) => entry.itemId)).toEqual([
        "item-acetone",
      ]);
      expect(service.contentsOf(CHEM_CUPBOARD, NOW)).toEqual([]);
    });

    test("receiving into an unknown location or twice is refused", () => {
      expect(
        service.receiveItem(item({ itemId: "item-x", locationId: "loc-none" }), NOW).outcome,
      ).toBe("REFUSED_UNKNOWN_LOCATION");
      expect(() => service.receiveItem(item(), NOW)).toThrow(/already on the register/i);
    });
  });
});
