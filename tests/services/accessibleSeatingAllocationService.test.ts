/**
 * Test suite: Accessible Seating Allocation (#4924)
 * File: tests/services/accessibleSeatingAllocationService.test.ts
 *
 * The seat map below is built around the three things that go wrong in a real
 * house: a gangway that makes two consecutively numbered seats non-adjacent, a
 * wheelchair bay whose only neighbour has already been sold, and a bay with no
 * neighbour at all. Each of them passes a check that asks "is the bay free?"
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  AccessibleSeatingAllocationService,
  type VenueSeat,
} from "../../src/services/accessibleSeatingAllocationService";

const VENUE = "venue-lecture-theatre";
const EVENT = "event-graduation-ceremony";
const OTHER_EVENT = "event-open-day";

const BAY_1 = "seat-bay-1";
const COMP_1 = "seat-companion-1";
const COMP_2 = "seat-companion-2";
const BAY_2 = "seat-bay-2";
const STRANDED = "seat-stranded";
const BAY_LONE = "seat-bay-lone";

const F10 = "seat-f10";
const F11 = "seat-f11";
const F12 = "seat-f12";
const F14 = "seat-f14";
const F15 = "seat-f15";

const SIGHT_1 = "seat-sightline-1";
const SIGHT_2 = "seat-sightline-2";
const DOG_1 = "seat-floorspace-1";
const DOG_2 = "seat-floorspace-2";

const REQ = "req-patron-wheelchair";
const PATRON = "user-patron-riley";

const DOORS = new Date("2027-06-30T13:00:00.000Z");
const HOUR = 3_600_000;

function hour(offset: number): Date {
  return new Date(DOORS.getTime() + offset * HOUR);
}

function seat(overrides: Partial<VenueSeat> & { seatId: string; label: string }): VenueSeat {
  return {
    venueId: VENUE,
    row: "F",
    adjacentSeatIds: [],
    isWheelchairBay: false,
    isAisleEnd: false,
    isStepFree: true,
    hasClearSightline: false,
    hasFloorSpace: false,
    ...overrides,
  };
}

function build(): AccessibleSeatingAllocationService {
  const service = new AccessibleSeatingAllocationService();

  // A bay with one neighbour, which itself has a neighbour: room for a party of
  // three if nobody has been in first.
  service.registerSeat(
    seat({
      seatId: BAY_1,
      label: "Bay 1",
      isWheelchairBay: true,
      // A bay can happen to have a clear view of the interpreter. It still only
      // satisfies a wheelchair space.
      hasClearSightline: true,
      adjacentSeatIds: [COMP_1],
    }),
  );
  service.registerSeat(
    seat({ seatId: COMP_1, label: "Companion 1", adjacentSeatIds: [BAY_1, COMP_2] }),
  );
  service.registerSeat(seat({ seatId: COMP_2, label: "Companion 2", adjacentSeatIds: [COMP_1] }));

  // A bay whose single neighbour is a dead end.
  service.registerSeat(
    seat({ seatId: BAY_2, label: "Bay 2", isWheelchairBay: true, adjacentSeatIds: [STRANDED] }),
  );
  service.registerSeat(seat({ seatId: STRANDED, label: "Stranded", adjacentSeatIds: [BAY_2] }));

  // A bay with nothing beside it. Free, matching, and unusable by anybody
  // arriving with another person.
  service.registerSeat(seat({ seatId: BAY_LONE, label: "Bay 3", isWheelchairBay: true }));

  // Row F, split by a gangway between 12 and 14. There is no seat 13.
  service.registerSeat(
    seat({ seatId: F10, label: "F10", isAisleEnd: true, adjacentSeatIds: [F11] }),
  );
  service.registerSeat(seat({ seatId: F11, label: "F11", adjacentSeatIds: [F10, F12] }));
  service.registerSeat(seat({ seatId: F12, label: "F12", adjacentSeatIds: [F11] }));
  service.registerSeat(seat({ seatId: F14, label: "F14", adjacentSeatIds: [F15] }));
  service.registerSeat(
    // An aisle end reached by three steps, which is no use to an ambulant patron.
    seat({
      seatId: F15,
      label: "F15",
      isAisleEnd: true,
      isStepFree: false,
      adjacentSeatIds: [F14],
    }),
  );

  service.registerSeat(
    seat({
      seatId: SIGHT_1,
      label: "Sightline 1",
      hasClearSightline: true,
      adjacentSeatIds: [SIGHT_2],
    }),
  );
  service.registerSeat(seat({ seatId: SIGHT_2, label: "Sightline 2", adjacentSeatIds: [SIGHT_1] }));

  service.registerSeat(
    seat({ seatId: DOG_1, label: "Floor space 1", hasFloorSpace: true, adjacentSeatIds: [DOG_2] }),
  );
  service.registerSeat(seat({ seatId: DOG_2, label: "Floor space 2", adjacentSeatIds: [DOG_1] }));

  service.submitRequirement({
    requirementId: REQ,
    eventId: EVENT,
    patronId: PATRON,
    type: "WHEELCHAIR_SPACE",
    companionCount: 1,
  });

  return service;
}

describe("AccessibleSeatingAllocationService — matching a requirement to a seat", () => {
  let service: AccessibleSeatingAllocationService;

  beforeEach(() => {
    service = build();
  });

  test("a wheelchair bay satisfies a wheelchair space", () => {
    expect(service.seatSatisfies(BAY_1, "WHEELCHAIR_SPACE")).toBe(true);
  });

  test("a wheelchair bay never satisfies an ambulant requirement", () => {
    expect(service.seatSatisfies(BAY_1, "AMBULANT")).toBe(false);
  });

  test("a wheelchair bay with a clear view still only satisfies a wheelchair space", () => {
    expect(service.getSeat(BAY_1)?.hasClearSightline).toBe(true);
    expect(service.seatSatisfies(BAY_1, "CLEAR_SIGHTLINE")).toBe(false);
  });

  test("an ordinary seat never satisfies a wheelchair space", () => {
    expect(service.seatSatisfies(COMP_1, "WHEELCHAIR_SPACE")).toBe(false);
  });

  test("a step-free aisle end satisfies an ambulant requirement", () => {
    expect(service.seatSatisfies(F10, "AMBULANT")).toBe(true);
  });

  test("an aisle end reached by steps does not satisfy an ambulant requirement", () => {
    expect(service.getSeat(F15)?.isAisleEnd).toBe(true);
    expect(service.seatSatisfies(F15, "AMBULANT")).toBe(false);
  });

  test("a seat in the middle of a row does not satisfy an ambulant requirement", () => {
    expect(service.seatSatisfies(F11, "AMBULANT")).toBe(false);
  });

  test("floor space satisfies an assistance dog requirement", () => {
    expect(service.seatSatisfies(DOG_1, "ASSISTANCE_DOG")).toBe(true);
    expect(service.seatSatisfies(DOG_2, "ASSISTANCE_DOG")).toBe(false);
  });

  test("an unobstructed sightline satisfies a sightline requirement", () => {
    expect(service.seatSatisfies(SIGHT_1, "CLEAR_SIGHTLINE")).toBe(true);
    expect(service.seatSatisfies(SIGHT_2, "CLEAR_SIGHTLINE")).toBe(false);
  });

  test("a seat that does not exist satisfies nothing", () => {
    expect(service.seatSatisfies("seat-imaginary", "WHEELCHAIR_SPACE")).toBe(false);
  });

  test("availableSeatsFor lists only matching, untaken seats", () => {
    expect(service.availableSeatsFor(EVENT, "WHEELCHAIR_SPACE").map((s) => s.seatId)).toEqual([
      BAY_1,
      BAY_2,
      BAY_LONE,
    ]);
    expect(service.availableSeatsFor(EVENT, "AMBULANT").map((s) => s.seatId)).toEqual([F10]);
  });

  test("availableSeatsFor drops a seat once it is taken", () => {
    service.allocate(REQ, DOORS);

    expect(service.availableSeatsFor(EVENT, "WHEELCHAIR_SPACE").map((s) => s.seatId)).toEqual([
      BAY_2,
      BAY_LONE,
    ]);
  });

  test("occupancy is per event, so another event still has the bay", () => {
    service.allocate(REQ, DOORS);

    expect(service.isTaken(EVENT, BAY_1)).toBe(true);
    expect(service.isTaken(OTHER_EVENT, BAY_1)).toBe(false);
  });
});

describe("AccessibleSeatingAllocationService — the bay and its companion are one unit", () => {
  let service: AccessibleSeatingAllocationService;

  beforeEach(() => {
    service = build();
  });

  test("allocates a bay together with an adjacent companion seat", () => {
    const result = service.allocate(REQ, DOORS);

    expect(result.outcome).toBe("ALLOCATED");
    expect(result.allocation?.primarySeatId).toBe(BAY_1);
    expect(result.allocation?.companionSeatIds).toEqual([COMP_1]);
  });

  test("the companion is a declared neighbour of the bay", () => {
    const result = service.allocate(REQ, DOORS);
    const companion = result.allocation?.companionSeatIds[0] as string;

    expect(service.getSeat(BAY_1)?.adjacentSeatIds).toContain(companion);
  });

  test("takes both seats out of inventory together", () => {
    service.allocate(REQ, DOORS);

    expect(service.isTaken(EVENT, BAY_1)).toBe(true);
    expect(service.isTaken(EVENT, COMP_1)).toBe(true);
  });

  test("refuses the bay outright when no companion is free", () => {
    // Every neighbour of every bay sold before the accessible booking arrives.
    service.sellGeneral(EVENT, COMP_1, "user-buyer", DOORS);
    service.sellGeneral(EVENT, STRANDED, "user-buyer", DOORS);

    const result = service.allocate(REQ, DOORS);

    expect(result.outcome).toBe("REFUSED_NO_COMPANION_ADJACENCY");
    expect(result.allocation).toBeNull();
  });

  test("a refused allocation leaves every bay free rather than half-booked", () => {
    service.sellGeneral(EVENT, COMP_1, "user-buyer", DOORS);
    service.sellGeneral(EVENT, STRANDED, "user-buyer", DOORS);
    service.allocate(REQ, DOORS);

    expect(service.isTaken(EVENT, BAY_1)).toBe(false);
    expect(service.isTaken(EVENT, BAY_2)).toBe(false);
    expect(service.isTaken(EVENT, BAY_LONE)).toBe(false);
  });

  test("reports which bays were rejected and why the refusal happened", () => {
    service.sellGeneral(EVENT, COMP_1, "user-buyer", DOORS);
    service.sellGeneral(EVENT, STRANDED, "user-buyer", DOORS);

    const result = service.allocate(REQ, DOORS);

    expect(result.rejectedSeatIds).toEqual([BAY_1, BAY_2, BAY_LONE]);
    expect(result.detail).toContain("not an accessible space");
  });

  test("a companion sold first pushes the allocation to another bay", () => {
    service.sellGeneral(EVENT, COMP_1, "user-buyer", DOORS);

    const result = service.allocate(REQ, DOORS);

    expect(result.outcome).toBe("ALLOCATED");
    expect(result.allocation?.primarySeatId).toBe(BAY_2);
    expect(result.allocation?.companionSeatIds).toEqual([STRANDED]);
    expect(result.rejectedSeatIds).toEqual([BAY_1]);
  });

  test("a party needing no companion takes the bay on its own", () => {
    service.submitRequirement({
      requirementId: "req-solo",
      eventId: EVENT,
      patronId: "user-solo",
      type: "WHEELCHAIR_SPACE",
      companionCount: 0,
    });

    const result = service.allocate("req-solo", DOORS);

    expect(result.outcome).toBe("ALLOCATED");
    expect(result.allocation?.primarySeatId).toBe(BAY_1);
    expect(result.allocation?.companionSeatIds).toEqual([]);
  });

  test("two companions must be contiguous with the bay through the adjacency graph", () => {
    service.submitRequirement({
      requirementId: "req-party-of-three",
      eventId: EVENT,
      patronId: PATRON,
      type: "WHEELCHAIR_SPACE",
      companionCount: 2,
    });

    const result = service.allocate("req-party-of-three", DOORS);

    expect(result.allocation?.primarySeatId).toBe(BAY_1);
    expect(result.allocation?.companionSeatIds).toEqual([COMP_1, COMP_2]);
  });

  test("refuses when only one contiguous companion is free but two are needed", () => {
    service.sellGeneral(EVENT, COMP_2, "user-buyer", DOORS);
    service.submitRequirement({
      requirementId: "req-party-of-three",
      eventId: EVENT,
      patronId: PATRON,
      type: "WHEELCHAIR_SPACE",
      companionCount: 2,
    });

    const result = service.allocate("req-party-of-three", DOORS);

    expect(result.outcome).toBe("REFUSED_NO_COMPANION_ADJACENCY");
    expect(result.rejectedSeatIds).toEqual([BAY_1, BAY_2, BAY_LONE]);
  });

  test("allocates an ambulant requirement with its companion", () => {
    service.submitRequirement({
      requirementId: "req-ambulant",
      eventId: EVENT,
      patronId: "user-ambulant",
      type: "AMBULANT",
      companionCount: 1,
    });

    const result = service.allocate("req-ambulant", DOORS);

    expect(result.allocation?.primarySeatId).toBe(F10);
    expect(result.allocation?.companionSeatIds).toEqual([F11]);
  });

  test("refuses when nothing in the house matches the requirement type", () => {
    service.sellGeneral(EVENT, DOG_1, "user-buyer", DOORS);
    service.submitRequirement({
      requirementId: "req-dog",
      eventId: EVENT,
      patronId: "user-dog",
      type: "ASSISTANCE_DOG",
      companionCount: 0,
    });

    expect(service.allocate("req-dog", DOORS).outcome).toBe("REFUSED_NO_MATCHING_SEAT");
  });

  test("refuses a requirement that does not exist", () => {
    expect(service.allocate("req-imaginary", DOORS).outcome).toBe("REFUSED_UNKNOWN_REQUIREMENT");
  });

  test("refuses a second allocation for a requirement that already holds one", () => {
    const first = service.allocate(REQ, DOORS);

    const second = service.allocate(REQ, DOORS);

    expect(second.outcome).toBe("REFUSED_ALREADY_ALLOCATED");
    expect(second.allocation?.allocationId).toBe(first.allocation?.allocationId);
  });
});

describe("AccessibleSeatingAllocationService — adjacency is declared, not inferred", () => {
  let service: AccessibleSeatingAllocationService;

  beforeEach(() => {
    service = build();
  });

  test("a companion block stops at a gangway even inside one row", () => {
    // F12, F11 and F10 sit one side of the gangway; F14 and F15 the other. Both
    // sides are free, and there is no seat 13 to make them neighbours.
    expect(service.findContiguousCompanions(EVENT, F12, 2)).toEqual([F11, F10]);
    expect(service.findContiguousCompanions(EVENT, F12, 3)).toBeNull();
    expect(service.isTaken(EVENT, F14)).toBe(false);
  });

  test("asking for no companions succeeds without touching the graph", () => {
    expect(service.findContiguousCompanions(EVENT, "seat-imaginary", 0)).toEqual([]);
  });

  test("returns null for a seat that does not exist", () => {
    expect(service.findContiguousCompanions(EVENT, "seat-imaginary", 1)).toBeNull();
  });

  test("a taken seat breaks contiguity rather than being skipped over", () => {
    service.sellGeneral(EVENT, COMP_1, "user-buyer", DOORS);

    // COMP_2 is free and adjacent to COMP_1, but the only route to it from the
    // bay runs through a seat somebody else is sitting in.
    expect(service.isTaken(EVENT, COMP_2)).toBe(false);
    expect(service.findContiguousCompanions(EVENT, BAY_1, 1)).toBeNull();
  });

  test("a second wheelchair bay is never spent as a companion seat", () => {
    service.registerSeat(
      seat({
        seatId: "seat-bay-4",
        label: "Bay 4",
        isWheelchairBay: true,
        adjacentSeatIds: [BAY_2],
      }),
    );
    service.sellGeneral(EVENT, STRANDED, "user-buyer", DOORS);

    expect(service.findContiguousCompanions(EVENT, BAY_2, 1)).toBeNull();
  });

  test("declaring adjacency on one side registers it on both", () => {
    service.registerSeat(seat({ seatId: "seat-f9", label: "F9", adjacentSeatIds: [F10] }));

    expect(service.getSeat(F10)?.adjacentSeatIds).toContain("seat-f9");
    expect(service.getSeat("seat-f9")?.adjacentSeatIds).toContain(F10);
  });

  test("re-declaring an existing adjacency does not duplicate it", () => {
    service.registerSeat(seat({ seatId: COMP_2, label: "Companion 2", adjacentSeatIds: [COMP_1] }));

    const neighbours = service.getSeat(COMP_1)?.adjacentSeatIds ?? [];

    expect(neighbours.filter((id) => id === COMP_2)).toHaveLength(1);
  });

  test("getSeat hands back a copy rather than the live seat", () => {
    service.getSeat(BAY_1)?.adjacentSeatIds.push("seat-nonsense");

    expect(service.getSeat(BAY_1)?.adjacentSeatIds).toEqual([COMP_1]);
  });
});

describe("AccessibleSeatingAllocationService — holds and their release", () => {
  let service: AccessibleSeatingAllocationService;

  beforeEach(() => {
    service = build();
    service.defineHold({
      holdId: "hold-graduation-access",
      eventId: EVENT,
      seatIds: [BAY_1, COMP_1, COMP_2],
      releaseAt: hour(5),
    });
  });

  test("a held seat is refused on general sale before its release", () => {
    const result = service.sellGeneral(EVENT, COMP_2, "user-buyer", hour(0));

    expect(result.outcome).toBe("REFUSED_HELD_FOR_ACCESS");
  });

  test("the refusal reports when the seat returns to general sale", () => {
    const result = service.sellGeneral(EVENT, COMP_2, "user-buyer", hour(0));

    expect(result.releasesAt).toEqual(hour(5));
  });

  test("the same seat sells once the hold has released", () => {
    expect(service.sellGeneral(EVENT, COMP_2, "user-buyer", hour(5)).outcome).toBe("SOLD");
  });

  test("the release instant itself is no longer held", () => {
    expect(service.isHeldAt(EVENT, COMP_2, hour(4))).toBe(true);
    expect(service.isHeldAt(EVENT, COMP_2, hour(5))).toBe(false);
  });

  test("a hold never blocks the accessible booking it exists for", () => {
    const result = service.allocate(REQ, hour(0));

    expect(result.outcome).toBe("ALLOCATED");
    expect(result.allocation?.primarySeatId).toBe(BAY_1);
    expect(result.allocation?.companionSeatIds).toEqual([COMP_1]);
  });

  test("a hold on another event does not withhold this one's seats", () => {
    expect(service.isHeldAt(OTHER_EVENT, COMP_2, hour(0))).toBe(false);
  });

  test("bringing the release forward opens the seats early", () => {
    expect(service.releaseHold("hold-graduation-access", hour(1))).toBe(true);
    expect(service.sellGeneral(EVENT, COMP_2, "user-buyer", hour(2)).outcome).toBe("SOLD");
  });

  test("a release cannot be pushed back later than it already is", () => {
    expect(service.releaseHold("hold-graduation-access", hour(9))).toBe(false);
    expect(service.isHeldAt(EVENT, COMP_2, hour(4))).toBe(true);
  });

  test("releasing a hold that does not exist reports no change", () => {
    expect(service.releaseHold("hold-imaginary", hour(1))).toBe(false);
  });

  test("releasing a hold does not disturb an allocation already made against it", () => {
    const allocated = service.allocate(REQ, hour(0));
    service.releaseHold("hold-graduation-access", hour(1));

    expect(service.sellGeneral(EVENT, COMP_1, "user-buyer", hour(2)).outcome).toBe(
      "REFUSED_SEAT_TAKEN",
    );
    expect(service.getAllocation(allocated.allocation?.allocationId as string)?.status).toBe(
      "CONFIRMED",
    );
  });

  test("a hold cannot be defined over a seat that does not exist", () => {
    expect(() =>
      service.defineHold({
        holdId: "hold-broken",
        eventId: EVENT,
        seatIds: ["seat-imaginary"],
        releaseAt: hour(5),
      }),
    ).toThrow(/unknown seat/);
  });

  test("the latest release across overlapping holds governs", () => {
    service.defineHold({
      holdId: "hold-second",
      eventId: EVENT,
      seatIds: [COMP_2],
      releaseAt: hour(8),
    });

    expect(service.isHeldAt(EVENT, COMP_2, hour(6))).toBe(true);
    expect(service.sellGeneral(EVENT, COMP_2, "user-buyer", hour(6)).releasesAt).toEqual(hour(8));
  });
});

describe("AccessibleSeatingAllocationService — general sale", () => {
  let service: AccessibleSeatingAllocationService;

  beforeEach(() => {
    service = build();
  });

  test("sells an ordinary free seat", () => {
    const result = service.sellGeneral(EVENT, F11, "user-buyer", DOORS);

    expect(result.outcome).toBe("SOLD");
    expect(service.isTaken(EVENT, F11)).toBe(true);
  });

  test("refuses a seat that is already sold", () => {
    service.sellGeneral(EVENT, F11, "user-buyer", DOORS);

    expect(service.sellGeneral(EVENT, F11, "user-other-buyer", DOORS).outcome).toBe(
      "REFUSED_SEAT_TAKEN",
    );
  });

  test("a wheelchair bay is never on general sale, held or not", () => {
    const result = service.sellGeneral(EVENT, BAY_LONE, "user-buyer", DOORS);

    expect(result.outcome).toBe("REFUSED_ACCESS_ONLY_SEAT");
  });

  test("a companion seat cannot be sold out from under the pair it completes", () => {
    const allocated = service.allocate(REQ, DOORS);

    const result = service.sellGeneral(EVENT, COMP_1, "user-buyer", DOORS);

    expect(result.outcome).toBe("REFUSED_SEAT_TAKEN");
    expect(result.detail).toContain(allocated.allocation?.allocationId as string);
    expect(result.detail).toContain("cannot be sold on its own");
  });

  test("refuses a seat that does not exist", () => {
    expect(service.sellGeneral(EVENT, "seat-imaginary", "user-buyer", DOORS).outcome).toBe(
      "REFUSED_UNKNOWN_SEAT",
    );
  });

  test("a refunded general seat returns to sale", () => {
    service.sellGeneral(EVENT, F11, "user-buyer", DOORS);

    expect(service.refundGeneral(EVENT, F11)).toBe(true);
    expect(service.sellGeneral(EVENT, F11, "user-other-buyer", DOORS).outcome).toBe("SOLD");
  });

  test("an access-allocated seat cannot be refunded as a general sale", () => {
    service.allocate(REQ, DOORS);

    expect(service.refundGeneral(EVENT, COMP_1)).toBe(false);
    expect(service.isTaken(EVENT, COMP_1)).toBe(true);
  });

  test("refunding a seat nobody holds reports no change", () => {
    expect(service.refundGeneral(EVENT, F11)).toBe(false);
  });
});

describe("AccessibleSeatingAllocationService — amendment and voiding", () => {
  let service: AccessibleSeatingAllocationService;

  beforeEach(() => {
    service = build();
  });

  test("changing the party size voids the allocation", () => {
    const allocated = service.allocate(REQ, DOORS);

    const amendment = service.amendRequirement(REQ, { companionCount: 2 });

    expect(amendment.voidedAllocationId).toBe(allocated.allocation?.allocationId);
    expect(service.getAllocation(amendment.voidedAllocationId as string)?.status).toBe("VOIDED");
  });

  test("changing the requirement type voids the allocation", () => {
    service.allocate(REQ, DOORS);

    const amendment = service.amendRequirement(REQ, { type: "AMBULANT" });

    expect(amendment.voidedAllocationId).not.toBeNull();
  });

  test("voiding returns the bay and the companion together", () => {
    service.allocate(REQ, DOORS);
    service.amendRequirement(REQ, { companionCount: 2 });

    expect(service.isTaken(EVENT, BAY_1)).toBe(false);
    expect(service.isTaken(EVENT, COMP_1)).toBe(false);
  });

  test("an amended requirement can be allocated again against the new party size", () => {
    service.allocate(REQ, DOORS);
    service.amendRequirement(REQ, { companionCount: 2 });

    const result = service.allocate(REQ, DOORS);

    expect(result.outcome).toBe("ALLOCATED");
    expect(result.allocation?.companionSeatIds).toEqual([COMP_1, COMP_2]);
  });

  test("an amended requirement is matched against its new type", () => {
    service.allocate(REQ, DOORS);
    service.amendRequirement(REQ, { type: "AMBULANT", companionCount: 1 });

    expect(service.allocate(REQ, DOORS).allocation?.primarySeatId).toBe(F10);
  });

  test("amending a requirement that holds no allocation voids nothing", () => {
    const amendment = service.amendRequirement(REQ, { companionCount: 2 });

    expect(amendment.amended).toBe(true);
    expect(amendment.voidedAllocationId).toBeNull();
  });

  test("amending a requirement that does not exist reports no change", () => {
    expect(service.amendRequirement("req-imaginary", { companionCount: 1 }).amended).toBe(false);
  });

  test("voiding an allocation directly frees its seats", () => {
    const allocated = service.allocate(REQ, DOORS);

    expect(
      service.voidAllocation(allocated.allocation?.allocationId as string, "Patron withdrew"),
    ).toBe(true);
    expect(service.isTaken(EVENT, BAY_1)).toBe(false);
  });

  test("voiding the same allocation twice reports no second change", () => {
    const allocated = service.allocate(REQ, DOORS);
    const allocationId = allocated.allocation?.allocationId as string;
    service.voidAllocation(allocationId, "Patron withdrew");

    expect(service.voidAllocation(allocationId, "Patron withdrew again")).toBe(false);
  });

  test("voiding an allocation that does not exist reports no change", () => {
    expect(service.voidAllocation("alloc-imaginary", "Nothing to void")).toBe(false);
  });

  test("a voided allocation records why", () => {
    const allocated = service.allocate(REQ, DOORS);
    service.voidAllocation(allocated.allocation?.allocationId as string, "Patron withdrew");

    expect(service.getAllocation(allocated.allocation?.allocationId as string)?.voidedReason).toBe(
      "Patron withdrew",
    );
  });

  test("rejects a negative party size on submission", () => {
    expect(() =>
      service.submitRequirement({
        requirementId: "req-negative",
        eventId: EVENT,
        patronId: PATRON,
        type: "WHEELCHAIR_SPACE",
        companionCount: -1,
      }),
    ).toThrow(/negative companion count/);
  });

  test("rejects a negative party size on amendment", () => {
    expect(() => service.amendRequirement(REQ, { companionCount: -1 })).toThrow(
      /negative companion count/,
    );
  });

  test("getAllocation returns null for an allocation that was never made", () => {
    expect(service.getAllocation("alloc-imaginary")).toBeNull();
  });
});
