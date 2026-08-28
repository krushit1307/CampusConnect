/**
 * Module: Accessible Seating Allocation
 * File: src/services/accessibleSeatingAllocationService.ts
 * Scope: Allocates a wheelchair bay and its companion seat as one indivisible
 *        unit, matches requirements to seat attributes rather than to an
 *        "accessible" flag, and releases held inventory on a schedule (#4924).
 *
 * Accessible seats are a scarce resource that a seating chart does not know is
 * scarce, and the two obvious failures are opposites of each other. Put the
 * bays on general sale and they go early, usually to a group who liked the
 * legroom, and the wheelchair user booking a fortnight later finds them gone
 * from an event that is otherwise half empty. Hold them back and the event
 * sells out with six empty bays because nobody released them. The hold has to
 * expire, and it has to expire at an instant rather than when somebody
 * remembers.
 *
 * The part that actually breaks is the companion seat. The bay gets allocated
 * correctly and the seat beside it was sold hours ago to a stranger, because it
 * is an ordinary seat in the ordinary inventory. A bay without an adjacent
 * companion seat is not an accessible space; it is a wheelchair user sitting on
 * their own. So the pair is allocated atomically here: if no companion is
 * available the bay is not allocated at all, because a half-allocated pair is
 * worse than a refusal — it looks booked.
 *
 * Adjacency is declared, never inferred. F12 and F14 are neighbours when F13
 * does not exist, and are not neighbours when F13 is a gangway, a pillar or the
 * far side of an aisle. Adding one to a seat number will confidently sell a
 * companion seat across a gangway.
 *
 * And "accessible" is not one category. An ambulant disabled seat needs an
 * aisle end and no steps; an assistance dog needs floor space that does not
 * block a gangway; a BSL user needs an unobstructed sightline to wherever the
 * interpreter will actually stand. Collapsing all of it into one flag gives the
 * wheelchair bay to somebody who needed an aisle seat, and the aisle seat to
 * somebody who cannot use it.
 */

export type RequirementType =
  "WHEELCHAIR_SPACE" | "AMBULANT" | "ASSISTANCE_DOG" | "CLEAR_SIGHTLINE";

export type AllocationStatus = "CONFIRMED" | "VOIDED";

export type AllocationOutcome =
  | "ALLOCATED"
  | "REFUSED_UNKNOWN_REQUIREMENT"
  | "REFUSED_ALREADY_ALLOCATED"
  | "REFUSED_NO_MATCHING_SEAT"
  | "REFUSED_NO_COMPANION_ADJACENCY";

export type GeneralSaleOutcome =
  | "SOLD"
  | "REFUSED_UNKNOWN_SEAT"
  | "REFUSED_SEAT_TAKEN"
  | "REFUSED_HELD_FOR_ACCESS"
  | "REFUSED_ACCESS_ONLY_SEAT";

export interface VenueSeat {
  seatId: string;
  venueId: string;
  row: string;
  label: string;
  /**
   * Declared physical neighbours. Never derived from the seat number: F12 and
   * F14 are adjacent when F13 does not exist and are not adjacent when F13 is a
   * gangway.
   */
  adjacentSeatIds: string[];
  /** A bay is floor space, not a seat, and satisfies only a wheelchair space. */
  isWheelchairBay: boolean;
  isAisleEnd: boolean;
  isStepFree: boolean;
  /** Unobstructed view of the interpreter position, which is not the stage. */
  hasClearSightline: boolean;
  /** Room for an assistance dog to lie down without lying in a gangway. */
  hasFloorSpace: boolean;
}

export interface AccessRequirement {
  requirementId: string;
  eventId: string;
  patronId: string;
  type: RequirementType;
  /** Companions who must sit contiguously with the patron, not merely in the row. */
  companionCount: number;
}

/**
 * Accessible inventory withheld from general sale until `releaseAt`. The hold
 * exists for accessible requests, so it never blocks one.
 */
export interface AccessibleHold {
  holdId: string;
  eventId: string;
  seatIds: string[];
  releaseAt: Date;
}

export interface SeatAllocation {
  allocationId: string;
  requirementId: string;
  eventId: string;
  patronId: string;
  primarySeatId: string;
  companionSeatIds: string[];
  allocatedAt: Date;
  status: AllocationStatus;
  voidedReason: string | null;
}

export interface AllocationResult {
  outcome: AllocationOutcome;
  allocation: SeatAllocation | null;
  /** Seats that matched the requirement but had no contiguous companion free. */
  rejectedSeatIds: string[];
  detail: string;
}

export interface GeneralSaleResult {
  outcome: GeneralSaleOutcome;
  seatId: string;
  /** When a hold refused the sale: the instant the seat returns to general sale. */
  releasesAt: Date | null;
  detail: string;
}

export interface AmendmentResult {
  amended: boolean;
  voidedAllocationId: string | null;
  detail: string;
}

interface Occupancy {
  kind: "ACCESS" | "GENERAL";
  reference: string;
  /** Set on companion seats: the allocation whose pair they complete. */
  partOfAllocationId: string | null;
}

function occupancyKey(eventId: string, seatId: string): string {
  return `${eventId}::${seatId}`;
}

export class AccessibleSeatingAllocationService {
  private readonly seats = new Map<string, VenueSeat>();
  private readonly requirements = new Map<string, AccessRequirement>();
  private readonly holds = new Map<string, AccessibleHold>();
  private readonly allocations = new Map<string, SeatAllocation>();
  private readonly occupancy = new Map<string, Occupancy>();

  private allocationSequence = 0;

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register a seat. Adjacency is stored exactly as declared and is made
   * symmetric on both sides, because a neighbour relationship that only one
   * seat knows about is a neighbour relationship that fails half the time.
   */
  registerSeat(seat: VenueSeat): void {
    this.seats.set(seat.seatId, { ...seat, adjacentSeatIds: [...seat.adjacentSeatIds] });

    for (const neighbourId of seat.adjacentSeatIds) {
      const neighbour = this.seats.get(neighbourId);
      if (neighbour && !neighbour.adjacentSeatIds.includes(seat.seatId)) {
        neighbour.adjacentSeatIds.push(seat.seatId);
      }
    }
  }

  getSeat(seatId: string): VenueSeat | null {
    const seat = this.seats.get(seatId);
    return seat ? { ...seat, adjacentSeatIds: [...seat.adjacentSeatIds] } : null;
  }

  submitRequirement(requirement: AccessRequirement): AccessRequirement {
    if (requirement.companionCount < 0) {
      throw new Error(`Requirement ${requirement.requirementId} has a negative companion count`);
    }
    this.requirements.set(requirement.requirementId, { ...requirement });
    return { ...requirement };
  }

  /**
   * Withhold seats from general sale until an instant. Held seats stay fully
   * available to accessible requirements throughout — the hold exists for them.
   */
  defineHold(hold: AccessibleHold): void {
    for (const seatId of hold.seatIds) {
      if (!this.seats.has(seatId)) {
        throw new Error(`Hold ${hold.holdId} references unknown seat ${seatId}`);
      }
    }
    this.holds.set(hold.holdId, { ...hold, seatIds: [...hold.seatIds] });
  }

  /** Bring a hold's release forward, usually because the box office has given up waiting. */
  releaseHold(holdId: string, at: Date): boolean {
    const hold = this.holds.get(holdId);
    if (!hold) return false;
    if (hold.releaseAt.getTime() <= at.getTime()) return false;
    hold.releaseAt = at;
    return true;
  }

  getAllocation(allocationId: string): SeatAllocation | null {
    const allocation = this.allocations.get(allocationId);
    return allocation
      ? { ...allocation, companionSeatIds: [...allocation.companionSeatIds] }
      : null;
  }

  // ---------------------------------------------------------------------------
  // Seat state
  // ---------------------------------------------------------------------------

  /** Whether a seat is withheld from general sale at an instant. */
  isHeldAt(eventId: string, seatId: string, at: Date): boolean {
    for (const hold of this.holds.values()) {
      if (hold.eventId !== eventId) continue;
      if (!hold.seatIds.includes(seatId)) continue;
      if (at.getTime() < hold.releaseAt.getTime()) return true;
    }
    return false;
  }

  /** Whether a seat is already sold or allocated for an event. */
  isTaken(eventId: string, seatId: string): boolean {
    return this.occupancy.has(occupancyKey(eventId, seatId));
  }

  /**
   * Whether a seat satisfies a requirement type.
   *
   * A wheelchair bay satisfies a wheelchair space and nothing else. It is floor
   * space rather than a seat, so handing it to somebody who asked for an aisle
   * end both fails them and burns the scarcest inventory in the room.
   */
  seatSatisfies(seatId: string, type: RequirementType): boolean {
    const seat = this.seats.get(seatId);
    if (!seat) return false;

    if (type === "WHEELCHAIR_SPACE") {
      return seat.isWheelchairBay && seat.isStepFree;
    }
    if (seat.isWheelchairBay) return false;

    switch (type) {
      case "AMBULANT":
        return seat.isAisleEnd && seat.isStepFree;
      case "ASSISTANCE_DOG":
        return seat.hasFloorSpace && seat.isStepFree;
      case "CLEAR_SIGHTLINE":
        return seat.hasClearSightline;
      default:
        return false;
    }
  }

  /** Seats that could satisfy a requirement type and are not already taken. */
  availableSeatsFor(eventId: string, type: RequirementType): VenueSeat[] {
    return [...this.seats.values()]
      .filter((seat) => this.seatSatisfies(seat.seatId, type))
      .filter((seat) => !this.isTaken(eventId, seat.seatId))
      .map((seat) => ({ ...seat, adjacentSeatIds: [...seat.adjacentSeatIds] }));
  }

  /**
   * Companion seats reachable from `fromSeatId` through the declared adjacency
   * graph. Breadth-first from the primary seat, so the returned set is always
   * connected to it — "in the same row" is not the same thing as "next to".
   *
   * Returns null when fewer than `count` are available, because a partial set
   * is not something the caller can use.
   */
  findContiguousCompanions(eventId: string, fromSeatId: string, count: number): string[] | null {
    if (count === 0) return [];

    const start = this.seats.get(fromSeatId);
    if (!start) return null;

    const found: string[] = [];
    const seen = new Set<string>([fromSeatId]);
    const queue: string[] = [...start.adjacentSeatIds];

    while (queue.length > 0 && found.length < count) {
      const seatId = queue.shift() as string;
      if (seen.has(seatId)) continue;
      seen.add(seatId);

      const seat = this.seats.get(seatId);
      if (!seat) continue;
      // A companion sits in an ordinary seat. Spending a second bay on a
      // companion would take the scarce thing to solve the plentiful one.
      if (seat.isWheelchairBay) continue;
      if (this.isTaken(eventId, seatId)) continue;

      found.push(seatId);
      queue.push(...seat.adjacentSeatIds);
    }

    return found.length === count ? found : null;
  }

  // ---------------------------------------------------------------------------
  // Allocation
  // ---------------------------------------------------------------------------

  /**
   * Allocate a primary seat and its companions as one unit. Held inventory is
   * fully available here regardless of `at`, because the hold was placed for
   * exactly this request.
   */
  allocate(requirementId: string, at: Date): AllocationResult {
    const requirement = this.requirements.get(requirementId);
    if (!requirement) {
      return this.refuse("REFUSED_UNKNOWN_REQUIREMENT", `Requirement ${requirementId} is unknown`);
    }
    const existing = this.liveAllocationFor(requirementId);
    if (existing) {
      return {
        outcome: "REFUSED_ALREADY_ALLOCATED",
        allocation: { ...existing, companionSeatIds: [...existing.companionSeatIds] },
        rejectedSeatIds: [],
        detail: `Requirement ${requirementId} already holds allocation ${existing.allocationId}`,
      };
    }

    const candidates = this.availableSeatsFor(requirement.eventId, requirement.type);
    if (candidates.length === 0) {
      return this.refuse(
        "REFUSED_NO_MATCHING_SEAT",
        `No free seat satisfies a ${requirement.type.toLowerCase().replace(/_/g, " ")} requirement`,
      );
    }

    const rejected: string[] = [];
    for (const seat of candidates) {
      const companions = this.findContiguousCompanions(
        requirement.eventId,
        seat.seatId,
        requirement.companionCount,
      );

      if (!companions) {
        // The seat itself is fine. What it cannot do is seat the party together,
        // and allocating it anyway produces a booking that looks complete.
        rejected.push(seat.seatId);
        continue;
      }

      this.allocationSequence += 1;
      const allocationId = `alloc-${this.allocationSequence}`;
      const allocation: SeatAllocation = {
        allocationId,
        requirementId,
        eventId: requirement.eventId,
        patronId: requirement.patronId,
        primarySeatId: seat.seatId,
        companionSeatIds: companions,
        allocatedAt: at,
        status: "CONFIRMED",
        voidedReason: null,
      };
      this.allocations.set(allocationId, allocation);

      this.occupancy.set(occupancyKey(requirement.eventId, seat.seatId), {
        kind: "ACCESS",
        reference: allocationId,
        partOfAllocationId: null,
      });
      for (const companionId of companions) {
        this.occupancy.set(occupancyKey(requirement.eventId, companionId), {
          kind: "ACCESS",
          reference: allocationId,
          // Marked so the seat cannot be returned to general sale on its own.
          partOfAllocationId: allocationId,
        });
      }

      return {
        outcome: "ALLOCATED",
        allocation: { ...allocation, companionSeatIds: [...companions] },
        rejectedSeatIds: rejected,
        detail:
          companions.length === 0
            ? `Allocated ${seat.label} to ${requirement.patronId}`
            : `Allocated ${seat.label} with ${companions.length} companion seat(s) to ${requirement.patronId}`,
      };
    }

    return {
      outcome: "REFUSED_NO_COMPANION_ADJACENCY",
      allocation: null,
      rejectedSeatIds: rejected,
      detail:
        `Every matching seat lacks ${requirement.companionCount} contiguous companion seat(s); ` +
        `a bay without one beside it is not an accessible space`,
    };
  }

  /**
   * Change a requirement. A confirmed allocation is frozen against the
   * requirement it satisfied, and the seats that satisfied the old one rarely
   * satisfy the new one, so the allocation is voided rather than adjusted.
   */
  amendRequirement(
    requirementId: string,
    changes: Partial<Pick<AccessRequirement, "type" | "companionCount">>,
  ): AmendmentResult {
    const requirement = this.requirements.get(requirementId);
    if (!requirement) {
      return { amended: false, voidedAllocationId: null, detail: `Unknown requirement` };
    }
    if (changes.companionCount !== undefined && changes.companionCount < 0) {
      throw new Error(`Requirement ${requirementId} cannot have a negative companion count`);
    }

    if (changes.type !== undefined) requirement.type = changes.type;
    if (changes.companionCount !== undefined) requirement.companionCount = changes.companionCount;

    const live = this.liveAllocationFor(requirementId);
    if (!live) {
      return {
        amended: true,
        voidedAllocationId: null,
        detail: `Requirement ${requirementId} amended`,
      };
    }

    this.voidAllocation(live.allocationId, "Requirement amended after confirmation");

    return {
      amended: true,
      voidedAllocationId: live.allocationId,
      detail: `Allocation ${live.allocationId} voided; the requirement must be re-allocated`,
    };
  }

  /** Void an allocation and return every seat it held — bay and companions together. */
  voidAllocation(allocationId: string, reason: string): boolean {
    const allocation = this.allocations.get(allocationId);
    if (!allocation || allocation.status === "VOIDED") return false;

    this.occupancy.delete(occupancyKey(allocation.eventId, allocation.primarySeatId));
    for (const companionId of allocation.companionSeatIds) {
      this.occupancy.delete(occupancyKey(allocation.eventId, companionId));
    }

    allocation.status = "VOIDED";
    allocation.voidedReason = reason;
    return true;
  }

  // ---------------------------------------------------------------------------
  // General sale
  // ---------------------------------------------------------------------------

  /**
   * Sell a seat on general sale. Held accessible inventory is refused until its
   * release instant, and a wheelchair bay is never on general sale at all — it
   * is the one piece of inventory that cannot be replaced by another seat.
   */
  sellGeneral(eventId: string, seatId: string, buyerId: string, at: Date): GeneralSaleResult {
    const seat = this.seats.get(seatId);
    if (!seat) {
      return {
        outcome: "REFUSED_UNKNOWN_SEAT",
        seatId,
        releasesAt: null,
        detail: `Seat ${seatId} does not exist`,
      };
    }

    if (this.isTaken(eventId, seatId)) {
      const occupant = this.occupancy.get(occupancyKey(eventId, seatId)) as Occupancy;
      return {
        outcome: "REFUSED_SEAT_TAKEN",
        seatId,
        releasesAt: null,
        detail: occupant.partOfAllocationId
          ? `${seat.label} completes the pair on allocation ${occupant.partOfAllocationId} and ` +
            `cannot be sold on its own`
          : `${seat.label} is already taken`,
      };
    }

    if (seat.isWheelchairBay) {
      return {
        outcome: "REFUSED_ACCESS_ONLY_SEAT",
        seatId,
        releasesAt: null,
        detail: `${seat.label} is a wheelchair space and is never on general sale`,
      };
    }

    if (this.isHeldAt(eventId, seatId, at)) {
      return {
        outcome: "REFUSED_HELD_FOR_ACCESS",
        seatId,
        releasesAt: this.releaseInstantFor(eventId, seatId),
        detail: `${seat.label} is held for accessible bookings until its release`,
      };
    }

    this.occupancy.set(occupancyKey(eventId, seatId), {
      kind: "GENERAL",
      reference: buyerId,
      partOfAllocationId: null,
    });

    return {
      outcome: "SOLD",
      seatId,
      releasesAt: null,
      detail: `${seat.label} sold to ${buyerId}`,
    };
  }

  /** Give up a general-sale seat. Access allocations are released by voiding them. */
  refundGeneral(eventId: string, seatId: string): boolean {
    const occupant = this.occupancy.get(occupancyKey(eventId, seatId));
    if (!occupant || occupant.kind !== "GENERAL") return false;
    this.occupancy.delete(occupancyKey(eventId, seatId));
    return true;
  }

  // ---------------------------------------------------------------------------

  private releaseInstantFor(eventId: string, seatId: string): Date | null {
    let latest: Date | null = null;
    for (const hold of this.holds.values()) {
      if (hold.eventId !== eventId) continue;
      if (!hold.seatIds.includes(seatId)) continue;
      if (!latest || hold.releaseAt.getTime() > latest.getTime()) {
        latest = hold.releaseAt;
      }
    }
    return latest;
  }

  private liveAllocationFor(requirementId: string): SeatAllocation | null {
    for (const allocation of this.allocations.values()) {
      if (allocation.requirementId !== requirementId) continue;
      if (allocation.status !== "CONFIRMED") continue;
      return allocation;
    }
    return null;
  }

  private refuse(outcome: AllocationOutcome, detail: string): AllocationResult {
    return { outcome, allocation: null, rejectedSeatIds: [], detail };
  }
}
