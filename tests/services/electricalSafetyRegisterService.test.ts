/**
 * Test suite: Electrical Safety Register (#5259)
 * File: tests/services/electricalSafetyRegisterService.test.ts
 *
 * The cases worth writing down are the ones a single `last_tested_at` column
 * and a "needs attention" flag both miss: two identical leads on different
 * intervals because one goes outdoors, the item whose environment changed and
 * whose due date must move backwards rather than forwards, the member marking
 * their own reported fault as fixed, the sound item that is still unsafe
 * because of what it is plugged into, and the amplifier that belongs to a
 * member and has therefore never been seen at all.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  ElectricalSafetyRegisterService,
  addMonths,
  type EquipmentItem,
  type Inspection,
} from "../../src/services/electricalSafetyRegisterService";

const INSPECTED_ON = new Date("2029-01-15T00:00:00.000Z");

function item(
  overrides: Partial<EquipmentItem> & Pick<EquipmentItem, "itemId" | "description">,
): EquipmentItem {
  return {
    equipmentClass: "CLASS_I",
    useEnvironment: "INDOOR_PORTABLE",
    ownership: "OWNED",
    ownerReference: null,
    retiredOn: null,
    ...overrides,
  };
}

function inspection(
  overrides: Partial<Inspection> & Pick<Inspection, "inspectionId" | "itemId">,
): Inspection {
  return {
    type: "COMBINED_INSPECTION_AND_TEST",
    performedOn: INSPECTED_ON,
    outcome: "PASS",
    testedBy: "u-tester",
    clearsFaultId: null,
    ...overrides,
  };
}

function build(): ElectricalSafetyRegisterService {
  const service = new ElectricalSafetyRegisterService();

  service.registerItem(
    item({
      itemId: "lead-outdoor",
      description: "25m 240V extension lead",
      useEnvironment: "OUTDOOR",
    }),
  );
  service.registerItem(
    item({
      itemId: "lead-office",
      description: "4-way office extension",
      useEnvironment: "OFFICE_STATIONARY",
    }),
  );
  service.registerItem(
    item({
      itemId: "projector",
      description: "Lecture projector",
      equipmentClass: "CLASS_II",
      useEnvironment: "INDOOR_PORTABLE",
    }),
  );
  service.registerItem(
    item({
      itemId: "sensor",
      description: "12V stage sensor",
      equipmentClass: "CLASS_III",
      useEnvironment: "INDOOR_PORTABLE",
    }),
  );
  service.registerItem(item({ itemId: "urn", description: "Catering water urn" }));

  for (const itemId of ["lead-outdoor", "lead-office", "projector", "sensor", "urn"]) {
    service.recordInspection(inspection({ inspectionId: `insp-${itemId}`, itemId }));
  }

  service.registerSupply({
    supplyId: "sup-protected",
    description: "Marquee distribution board",
    rcdProtected: true,
    lastProtectionTestOn: new Date("2029-01-01T00:00:00.000Z"),
  });
  service.registerSupply({
    supplyId: "sup-unprotected",
    description: "Courtyard wall socket",
    rcdProtected: false,
    lastProtectionTestOn: null,
  });
  service.registerSupply({
    supplyId: "sup-untested",
    description: "Sports hall temporary board",
    rcdProtected: true,
    lastProtectionTestOn: null,
  });
  service.registerSupply({
    supplyId: "sup-stale",
    description: "Field generator outlet",
    rcdProtected: true,
    lastProtectionTestOn: new Date("2027-01-01T00:00:00.000Z"),
  });

  return service;
}

describe("addMonths", () => {
  test("adding a month to 31 January lands on the last day of February, not in March", () => {
    expect(addMonths(new Date("2029-01-31T00:00:00.000Z"), 1).toISOString()).toBe(
      "2029-02-28T00:00:00.000Z",
    );
  });

  test("the same addition in a leap year lands on the 29th", () => {
    expect(addMonths(new Date("2028-01-31T00:00:00.000Z"), 1).toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });

  test("a month with room keeps the day of month", () => {
    expect(addMonths(new Date("2029-01-15T00:00:00.000Z"), 3).toISOString()).toBe(
      "2029-04-15T00:00:00.000Z",
    );
  });

  test("adding months rolls the year over", () => {
    expect(addMonths(new Date("2029-11-15T00:00:00.000Z"), 3).toISOString()).toBe(
      "2030-02-15T00:00:00.000Z",
    );
  });
});

describe("the interval comes from the class and the environment together", () => {
  let service: ElectricalSafetyRegisterService;

  beforeEach(() => {
    service = build();
  });

  test("two identical leads carry different intervals because one goes outdoors", () => {
    expect(service.intervalFor("lead-outdoor")).toEqual({ visualMonths: 3, combinedMonths: 12 });
    expect(service.intervalFor("lead-office")).toEqual({ visualMonths: 24, combinedMonths: 48 });
  });

  test("double-insulated equipment needs no electrical test, only a visual one", () => {
    expect(service.intervalFor("projector").combinedMonths).toBeNull();
  });

  test("safety extra-low voltage equipment is on the longest visual interval", () => {
    expect(service.intervalFor("sensor")).toEqual({ visualMonths: 24, combinedMonths: null });
  });

  test("the due dates follow from the interval and the last inspection", () => {
    const due = service.nextDue("lead-outdoor");
    expect(due.visualDueOn?.toISOString()).toBe("2029-04-15T00:00:00.000Z");
    expect(due.combinedDueOn?.toISOString()).toBe("2030-01-15T00:00:00.000Z");
  });

  test("a class needing no test has no combined due date at all", () => {
    expect(service.nextDue("projector").combinedDueOn).toBeNull();
  });
});

describe("changing where an item is used", () => {
  let service: ElectricalSafetyRegisterService;

  beforeEach(() => {
    service = build();
  });

  test("the new due date is measured from the last inspection, not from today", () => {
    const due = service.changeUseEnvironment("lead-office", "OUTDOOR");
    // Three months from the January inspection, not three months from now.
    expect(due.visualDueOn?.toISOString()).toBe("2029-04-15T00:00:00.000Z");
  });

  test("an item that was compliant can become overdue the moment its use changes", () => {
    const asOf = new Date("2029-06-01T00:00:00.000Z");
    expect(service.issuability("lead-office", asOf)).toBe("ISSUABLE");

    service.changeUseEnvironment("lead-office", "OUTDOOR");
    expect(service.issuability("lead-office", asOf)).toBe("INSPECTION_LAPSED");
  });

  test("moving an item indoors lengthens the interval from the same inspection", () => {
    const due = service.changeUseEnvironment("lead-outdoor", "OFFICE_STATIONARY");
    expect(due.visualDueOn?.toISOString()).toBe("2031-01-15T00:00:00.000Z");
  });
});

describe("issuability is derived rather than stored", () => {
  let service: ElectricalSafetyRegisterService;

  beforeEach(() => {
    service = build();
  });

  test("an item inside both intervals is issuable", () => {
    expect(service.issuability("lead-outdoor", new Date("2029-03-01T00:00:00.000Z"))).toBe(
      "ISSUABLE",
    );
  });

  test("a passed item whose interval has lapsed cannot be issued", () => {
    expect(service.issuability("lead-outdoor", new Date("2029-05-01T00:00:00.000Z"))).toBe(
      "INSPECTION_LAPSED",
    );
  });

  test("the combined interval lapses independently of the visual one", () => {
    service.recordInspection(
      inspection({
        inspectionId: "insp-visual",
        itemId: "lead-outdoor",
        type: "VISUAL",
        performedOn: new Date("2030-01-01T00:00:00.000Z"),
      }),
    );

    const due = service.nextDue("lead-outdoor");
    expect(due.visualDueOn?.toISOString()).toBe("2030-04-01T00:00:00.000Z");
    expect(due.combinedDueOn?.toISOString()).toBe("2030-01-15T00:00:00.000Z");
    expect(service.issuability("lead-outdoor", new Date("2030-02-01T00:00:00.000Z"))).toBe(
      "INSPECTION_LAPSED",
    );
  });

  test("a combined test satisfies the visual clock too", () => {
    // Only a combined inspection is on record, and the visual clock still runs
    // from it rather than reporting the item as never visually inspected.
    expect(service.nextDue("urn").visualDueOn?.toISOString()).toBe("2030-01-15T00:00:00.000Z");
  });

  test("an item with no inspection at all is never inspected, not merely overdue", () => {
    service.registerItem(item({ itemId: "new-heater", description: "Patio heater" }));
    expect(service.issuability("new-heater", new Date("2029-03-01T00:00:00.000Z"))).toBe(
      "NEVER_INSPECTED",
    );
  });

  test("an earthed item with only a visual inspection has still never been tested", () => {
    service.registerItem(item({ itemId: "kettle", description: "Green room kettle" }));
    service.recordInspection(
      inspection({ inspectionId: "insp-kettle", itemId: "kettle", type: "VISUAL" }),
    );

    expect(service.issuability("kettle", new Date("2029-03-01T00:00:00.000Z"))).toBe(
      "NEVER_INSPECTED",
    );
  });

  test("a most-recent failure quarantines the item even with no fault raised", () => {
    service.recordInspection(
      inspection({
        inspectionId: "insp-fail",
        itemId: "projector",
        performedOn: new Date("2029-02-01T00:00:00.000Z"),
        outcome: "FAIL",
      }),
    );

    expect(service.issuability("projector", new Date("2029-03-01T00:00:00.000Z"))).toBe(
      "QUARANTINED",
    );
  });

  test("a retired item is retired rather than merely overdue", () => {
    service.registerItem(
      item({
        itemId: "old-amp",
        description: "Retired amplifier",
        retiredOn: new Date("2029-02-01T00:00:00.000Z"),
      }),
    );
    expect(service.issuability("old-amp", new Date("2029-03-01T00:00:00.000Z"))).toBe("RETIRED");
  });
});

describe("a fault closes on somebody else's signature", () => {
  let service: ElectricalSafetyRegisterService;

  beforeEach(() => {
    service = build();
    service.reportFault({
      faultId: "flt-1",
      itemId: "lead-outdoor",
      description: "Outer sheath split near the plug",
      reportedBy: "u-member",
      reportedOn: new Date("2029-02-01T00:00:00.000Z"),
      clearedByInspectionId: null,
    });
  });

  test("an open fault quarantines the item however recently it passed", () => {
    expect(service.issuability("lead-outdoor", new Date("2029-02-10T00:00:00.000Z"))).toBe(
      "QUARANTINED",
    );
  });

  test("the reporter cannot sign off their own report", () => {
    const closure = service.closeFault(
      "flt-1",
      inspection({
        inspectionId: "insp-self",
        itemId: "lead-outdoor",
        performedOn: new Date("2029-02-05T00:00:00.000Z"),
        testedBy: "u-member",
      }),
    );

    expect(closure.closed).toBe(false);
    expect(closure.reason).toMatch(/cannot be the one who signs it off/);
    expect(service.openFaults("lead-outdoor")).toHaveLength(1);
  });

  test("a failed inspection does not close the fault it was investigating", () => {
    const closure = service.closeFault(
      "flt-1",
      inspection({
        inspectionId: "insp-refail",
        itemId: "lead-outdoor",
        performedOn: new Date("2029-02-05T00:00:00.000Z"),
        outcome: "FAIL",
      }),
    );

    expect(closure.closed).toBe(false);
    expect(service.openFaults("lead-outdoor")).toHaveLength(1);
  });

  test("an independent pass closes it and returns the item to service", () => {
    const closure = service.closeFault(
      "flt-1",
      inspection({
        inspectionId: "insp-fixed",
        itemId: "lead-outdoor",
        performedOn: new Date("2029-02-05T00:00:00.000Z"),
        testedBy: "u-technician",
      }),
    );

    expect(closure.closed).toBe(true);
    expect(service.openFaults("lead-outdoor")).toHaveLength(0);
    expect(service.issuability("lead-outdoor", new Date("2029-02-10T00:00:00.000Z"))).toBe(
      "ISSUABLE",
    );
  });

  test("closing a fault that does not exist is an error", () => {
    expect(() =>
      service.closeFault("flt-nope", inspection({ inspectionId: "i", itemId: "lead-outdoor" })),
    ).toThrow(/Unknown fault/);
  });
});

describe("the supply, not the item", () => {
  let service: ElectricalSafetyRegisterService;

  beforeEach(() => {
    service = build();
  });

  test("an outdoor booking on an unprotected supply is blocked, naming the supply", () => {
    const assessment = service.assessBooking({
      bookingId: "bkg-1",
      itemIds: ["lead-outdoor"],
      supplyId: "sup-unprotected",
      environment: "OUTDOOR",
      startsOn: new Date("2029-03-01T00:00:00.000Z"),
    });

    expect(assessment.permitted).toBe(false);
    expect(assessment.blockers).toHaveLength(1);
    expect(assessment.blockers[0].kind).toBe("SUPPLY_NOT_PROTECTED");
    expect(assessment.blockers[0].subject).toBe("sup-unprotected");
  });

  test("the same supply is fine for an indoor booking", () => {
    const assessment = service.assessBooking({
      bookingId: "bkg-2",
      itemIds: ["projector"],
      supplyId: "sup-unprotected",
      environment: "INDOOR_PORTABLE",
      startsOn: new Date("2029-03-01T00:00:00.000Z"),
    });

    expect(assessment.permitted).toBe(true);
  });

  test("protection that has never been proved blocks rather than passing", () => {
    const assessment = service.assessBooking({
      bookingId: "bkg-3",
      itemIds: ["lead-outdoor"],
      supplyId: "sup-untested",
      environment: "OUTDOOR",
      startsOn: new Date("2029-03-01T00:00:00.000Z"),
    });

    expect(assessment.blockers[0].kind).toBe("SUPPLY_PROTECTION_UNTESTED");
  });

  test("protection proved too long ago blocks too", () => {
    const assessment = service.assessBooking({
      bookingId: "bkg-4",
      itemIds: ["lead-outdoor"],
      supplyId: "sup-stale",
      environment: "OUTDOOR",
      startsOn: new Date("2029-03-01T00:00:00.000Z"),
    });

    expect(assessment.blockers[0].kind).toBe("SUPPLY_PROTECTION_UNTESTED");
    expect(assessment.blockers[0].detail).toContain("2027-01-01");
  });

  test("a recently proved protected supply lets a sound item through", () => {
    const assessment = service.assessBooking({
      bookingId: "bkg-5",
      itemIds: ["lead-outdoor"],
      supplyId: "sup-protected",
      environment: "OUTDOOR",
      startsOn: new Date("2029-03-01T00:00:00.000Z"),
    });

    expect(assessment.permitted).toBe(true);
  });

  test("an unknown supply is an error rather than an unprotected assumption", () => {
    expect(() =>
      service.supplyBlockers("sup-nope", "OUTDOOR", new Date("2029-03-01T00:00:00.000Z")),
    ).toThrow(/Unknown supply/);
  });
});

describe("equipment the register has never seen", () => {
  let service: ElectricalSafetyRegisterService;

  beforeEach(() => {
    service = build();
  });

  test("an item not in the register blocks the booking", () => {
    const assessment = service.assessBooking({
      bookingId: "bkg-6",
      itemIds: ["amp-unknown"],
      supplyId: "sup-protected",
      environment: "INDOOR_PORTABLE",
      startsOn: new Date("2029-03-01T00:00:00.000Z"),
    });

    expect(assessment.blockers[0].kind).toBe("ITEM_NOT_IN_REGISTER");
    expect(assessment.blockers[0].remedy).toContain("hired-in");
  });

  test("a member's own amplifier is assessed on the same terms once recorded", () => {
    service.registerTransientItem({
      itemId: "amp-member",
      description: "Member's bass amplifier",
      equipmentClass: "CLASS_I",
      useEnvironment: "INDOOR_PORTABLE",
      ownership: "MEMBER_OWNED",
      ownerReference: "u-member",
    });

    const assessment = service.assessBooking({
      bookingId: "bkg-7",
      itemIds: ["amp-member"],
      supplyId: "sup-protected",
      environment: "INDOOR_PORTABLE",
      startsOn: new Date("2029-03-01T00:00:00.000Z"),
    });

    expect(assessment.blockers[0].kind).toBe("ITEM_NEVER_INSPECTED");
  });

  test("hired-in equipment inspected on arrival passes like anything else", () => {
    service.registerTransientItem({
      itemId: "smoke-hire",
      description: "Hired smoke machine",
      equipmentClass: "CLASS_I",
      useEnvironment: "CONSTRUCTION_OR_TEMPORARY",
      ownership: "HIRED_IN",
      ownerReference: "supplier-42",
    });
    service.recordInspection(
      inspection({
        inspectionId: "insp-smoke",
        itemId: "smoke-hire",
        performedOn: new Date("2029-02-25T00:00:00.000Z"),
      }),
    );

    const assessment = service.assessBooking({
      bookingId: "bkg-8",
      itemIds: ["smoke-hire"],
      supplyId: "sup-protected",
      environment: "CONSTRUCTION_OR_TEMPORARY",
      startsOn: new Date("2029-03-01T00:00:00.000Z"),
    });

    expect(assessment.permitted).toBe(true);
  });

  test("equipment that is not the pool's must say whose it is", () => {
    expect(() =>
      service.registerItem(
        item({
          itemId: "mystery",
          description: "Somebody's heater",
          ownership: "MEMBER_OWNED",
          ownerReference: null,
        }),
      ),
    ).toThrow(/must name whose equipment it is/);
  });

  test("owned stock belongs in the register directly rather than as a transient", () => {
    expect(() =>
      service.registerTransientItem({
        itemId: "pool-item",
        description: "Pool projector",
        equipmentClass: "CLASS_II",
        useEnvironment: "INDOOR_PORTABLE",
        ownership: "OWNED",
        ownerReference: null,
      }),
    ).toThrow(/belongs in the register directly/);
  });
});

describe("the booking is assessed as at its own date", () => {
  test("a booking three months out is not cleared against today's interval", () => {
    const service = build();

    const soon = service.assessBooking({
      bookingId: "bkg-soon",
      itemIds: ["lead-outdoor"],
      supplyId: "sup-protected",
      environment: "OUTDOOR",
      startsOn: new Date("2029-03-01T00:00:00.000Z"),
    });
    expect(soon.permitted).toBe(true);

    const later = service.assessBooking({
      bookingId: "bkg-later",
      itemIds: ["lead-outdoor"],
      supplyId: "sup-protected",
      environment: "OUTDOOR",
      startsOn: new Date("2029-06-01T00:00:00.000Z"),
    });
    expect(later.permitted).toBe(false);
    expect(later.blockers[0].kind).toBe("ITEM_INSPECTION_LAPSED");
    expect(later.blockers[0].detail).toContain("2029-04-15");
  });

  test("every problem in a booking is reported, not just the first", () => {
    const service = build();
    service.reportFault({
      faultId: "flt-2",
      itemId: "projector",
      description: "Cracked casing",
      reportedBy: "u-member",
      reportedOn: new Date("2029-02-01T00:00:00.000Z"),
      clearedByInspectionId: null,
    });

    const assessment = service.assessBooking({
      bookingId: "bkg-many",
      itemIds: ["lead-outdoor", "projector"],
      supplyId: "sup-unprotected",
      environment: "OUTDOOR",
      startsOn: new Date("2029-06-01T00:00:00.000Z"),
    });

    expect(assessment.blockers.map((blocker) => blocker.kind)).toEqual([
      "ITEM_INSPECTION_LAPSED",
      "ITEM_QUARANTINED",
      "SUPPLY_NOT_PROTECTED",
    ]);
  });
});

describe("working the list", () => {
  test("everything due by a cutoff comes back in due order", () => {
    const service = build();
    const due = service.dueBy(new Date("2029-05-01T00:00:00.000Z"));

    // Only the outdoor lead is on a short enough interval to be due by then.
    expect(due.map((entry) => entry.itemId)).toEqual(["lead-outdoor"]);
  });

  test("an item never inspected is on the list whatever the cutoff", () => {
    const service = build();
    service.registerItem(item({ itemId: "new-fan", description: "Cooling fan" }));

    expect(
      service.dueBy(new Date("2029-02-01T00:00:00.000Z")).map((entry) => entry.itemId),
    ).toContain("new-fan");
  });

  test("a retired item drops off the list", () => {
    const service = build();
    service.registerItem(
      item({
        itemId: "dead-lead",
        description: "Scrapped lead",
        useEnvironment: "OUTDOOR",
        retiredOn: new Date("2029-01-01T00:00:00.000Z"),
      }),
    );

    expect(
      service.dueBy(new Date("2030-01-01T00:00:00.000Z")).map((entry) => entry.itemId),
    ).not.toContain("dead-lead");
  });
});
