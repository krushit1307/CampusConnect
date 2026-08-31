/**
 * Module: Hazardous Consumable Shelf-Life and Segregation Register
 * File: src/services/hazardousStockRegisterService.ts
 * Scope: Derives expiry from the item's state, evaluates segregation over
 *        locations rather than items, and reports every breach it finds
 *        (#4707).
 *
 * Club cupboards contain things the asset table thinks are stationery. It
 * cannot express either of the two properties that actually govern them.
 *
 * Shelf life runs from opening, not from manufacture. An unopened tin of
 * solvent is good for years; the same tin opened in October is scrap by
 * spring. A field copied off the label describes the sealed container and stops
 * describing anything the moment somebody breaks the seal.
 *
 * The sharp version is the peroxide-former. Ethers react with air over time to
 * produce peroxides that concentrate as the solvent evaporates. They do not
 * become less effective with age — they become more dangerous, and past a
 * certain point the correct action is not to move the container. Every other
 * item in the cupboard has an expiry that is a use-by suggestion; this one has
 * an expiry that is a disposal deadline.
 *
 * Segregation is a property of a set, not of an item. Adding one item can make
 * a cabinet that was lawful yesterday unlawful today without the incoming item
 * being unlawful in itself, so the check runs over the resulting contents of
 * the location.
 *
 * Quantities are derived by folding an append-only movement log. A part-used
 * container's remaining volume is a consequence of what was taken out of it,
 * not a number somebody edits.
 */

export type QuantityUnit = "ML" | "G";

export type MovementKind = "RECEIPT" | "DECANT" | "TRANSFER" | "DISPOSAL";

export type DeadlineKind = "USE_BY" | "DISPOSAL_DEADLINE";

export type BreachKind =
  "SEGREGATION" | "CLASS_LIMIT" | "UNRATED_CLASS" | "EXPIRED" | "DISPOSAL_OVERDUE" | "IMMOVABLE";

export type TransferOutcome =
  | "TRANSFERRED"
  | "REFUSED_SEGREGATION"
  | "REFUSED_CLASS_LIMIT"
  | "REFUSED_UNRATED_CLASS"
  | "REFUSED_IMMOVABLE"
  | "REFUSED_EXHAUSTED"
  | "REFUSED_SAME_LOCATION"
  | "REFUSED_UNKNOWN_LOCATION";

export type ReceiptOutcome = TransferOutcome | "RECEIVED";

export interface HazardClassSpec {
  classId: string;
  label: string;
  unit: QuantityUnit;
  /** Days of life once opened. Null where opening starts no clock. */
  postOpeningDays: number | null;
  /**
   * Gets more dangerous with age rather than merely less effective. Its expiry
   * is a disposal deadline, not a use-by.
   */
  peroxideFormer: boolean;
  /**
   * Days past expiry beyond which the container must be assessed where it
   * stands. Null where age never makes it immovable.
   */
  immovableAfterDays: number | null;
  disposalRoute: string;
}

export interface SegregationRule {
  classA: string;
  classB: string;
  reason: string;
}

export interface StorageLocation {
  locationId: string;
  label: string;
  /** A licensed store carries no aggregate limit. */
  licensedStore: boolean;
  /** Aggregate limit per hazard class. A class not listed is not rated for. */
  classLimits: Record<string, number>;
}

export interface StockItem {
  itemId: string;
  clubId: string;
  substance: string;
  classId: string;
  /** Container capacity. What arrives on receipt. */
  nominalQuantity: number;
  unit: QuantityUnit;
  manufacturedOn: Date;
  /** What the label says. An upper bound whatever the opening clock says. */
  labelExpiry: Date;
  openedOn: Date | null;
  locationId: string;
}

export interface StockMovement {
  sequence: number;
  itemId: string;
  kind: MovementKind;
  /** Negative for a decant or a disposal. */
  quantityDelta: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  occurredAt: Date;
  note: string;
}

export interface ExpiryAssessment {
  itemId: string;
  assessedAt: Date;
  labelExpiry: Date;
  /** What is enforced. The label date stays on the record beside it. */
  effectiveExpiry: Date;
  openingClockApplied: boolean;
  /** True where the opening clock ran past the label and the label bound it. */
  labelBoundTheClock: boolean;
  expired: boolean;
  daysPastExpiry: number;
  deadlineKind: DeadlineKind;
  immovable: boolean;
}

export interface Breach {
  kind: BreachKind;
  locationId: string;
  itemIds: string[];
  detail: string;
  /** Present on a quantity breach. */
  quantity: number | null;
  limit: number | null;
}

export interface LocationAssessment {
  locationId: string;
  assessedAt: Date;
  compliant: boolean;
  /** Every breach found, not the first. */
  breaches: Breach[];
  quantityByClass: Record<string, number>;
}

export interface DisposalRouting {
  itemId: string;
  routed: boolean;
  route: string | null;
  reason: string;
}

const DAY = 86_400_000;

function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * DAY);
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

export class HazardousStockRegisterService {
  private readonly classes: Map<string, HazardClassSpec>;
  private readonly segregation: Map<string, SegregationRule>;
  private readonly locations: Map<string, StorageLocation>;
  private readonly items: Map<string, StockItem>;
  private readonly movements: StockMovement[];
  private sequence: number;

  constructor() {
    this.classes = new Map();
    this.segregation = new Map();
    this.locations = new Map();
    this.items = new Map();
    this.movements = [];
    this.sequence = 0;
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  public registerClass(spec: HazardClassSpec): void {
    if (this.classes.has(spec.classId)) {
      throw new Error(`Hazard class ${spec.classId} is already registered.`);
    }
    if (spec.peroxideFormer && spec.postOpeningDays === null) {
      // A peroxide-former with no opening clock would be governed by its label
      // alone, which is the reading that leaves a bottle in a cupboard for six
      // years.
      throw new Error(`Peroxide-former ${spec.classId} must carry a post-opening clock.`);
    }
    if (spec.postOpeningDays !== null && spec.postOpeningDays <= 0) {
      throw new Error(`Hazard class ${spec.classId} has a post-opening life of nothing.`);
    }
    this.classes.set(spec.classId, { ...spec });
  }

  /**
   * Records that two classes may not share a location.
   *
   * Stored symmetrically. A matrix that has to be consulted in the right order
   * is a matrix that will be consulted in the wrong one.
   */
  public registerSegregationRule(rule: SegregationRule): void {
    this.requireClass(rule.classA);
    this.requireClass(rule.classB);
    if (rule.classA === rule.classB) {
      throw new Error(`A class cannot be segregated from itself (${rule.classA}).`);
    }
    this.segregation.set(pairKey(rule.classA, rule.classB), { ...rule });
  }

  public registerLocation(location: StorageLocation): void {
    if (this.locations.has(location.locationId)) {
      throw new Error(`Location ${location.locationId} is already registered.`);
    }
    for (const [classId, limit] of Object.entries(location.classLimits)) {
      this.requireClass(classId);
      if (limit < 0) throw new Error(`Location ${location.locationId} has a negative limit.`);
    }
    this.locations.set(location.locationId, {
      ...location,
      classLimits: { ...location.classLimits },
    });
  }

  /**
   * Records stock already sitting in a cupboard.
   *
   * Deliberately unguarded. This is the initial audit, and refusing to record
   * an unlawful arrangement would mean the register could not describe the
   * thing the audit exists to find. `assessLocation` says what is wrong with
   * it; `receiveItem` and `transferItem` are the guarded operations.
   */
  public registerExistingStock(item: StockItem, at: Date): void {
    this.placeItem(item, at, "Recorded in the initial audit");
  }

  // ---------------------------------------------------------------------------
  // Expiry
  // ---------------------------------------------------------------------------

  /**
   * When the item actually expires, from its state rather than from its label.
   *
   * Where the substance defines a post-opening life and the container is open,
   * the clock starts at the open date. The label stays an upper bound: opening
   * a container never extends it past what the manufacturer put on the tin.
   */
  public assessExpiry(itemId: string, assessedAt: Date): ExpiryAssessment {
    const item = this.requireItem(itemId);
    const spec = this.requireClass(item.classId);

    let effectiveExpiry = item.labelExpiry;
    let openingClockApplied = false;
    let labelBoundTheClock = false;

    if (spec.postOpeningDays !== null && item.openedOn !== null) {
      openingClockApplied = true;
      const openingExpiry = addDays(item.openedOn, spec.postOpeningDays);
      if (openingExpiry.getTime() < item.labelExpiry.getTime()) {
        effectiveExpiry = openingExpiry;
      } else {
        labelBoundTheClock = true;
      }
    }

    const expired = assessedAt.getTime() > effectiveExpiry.getTime();
    const daysPastExpiry = expired ? daysBetween(effectiveExpiry, assessedAt) : 0;

    return {
      itemId,
      assessedAt,
      labelExpiry: item.labelExpiry,
      effectiveExpiry,
      openingClockApplied,
      labelBoundTheClock,
      expired,
      daysPastExpiry,
      // Every other item in the cupboard has a use-by. This one has a deadline.
      deadlineKind: spec.peroxideFormer ? "DISPOSAL_DEADLINE" : "USE_BY",
      immovable:
        expired && spec.immovableAfterDays !== null && daysPastExpiry > spec.immovableAfterDays,
    };
  }

  public openItem(itemId: string, openedOn: Date): void {
    const item = this.requireItem(itemId);
    if (item.openedOn !== null) {
      throw new Error(`Item ${itemId} is already open.`);
    }
    this.items.set(itemId, { ...item, openedOn });
  }

  // ---------------------------------------------------------------------------
  // Quantity
  // ---------------------------------------------------------------------------

  /**
   * What is left in the container, folded from the movement log.
   *
   * There is no editable remaining-quantity column. A part-used container's
   * volume is a consequence of what was taken out of it.
   */
  public remainingQuantity(itemId: string, asOf: Date): number {
    this.requireItem(itemId);
    return this.movements
      .filter((movement) => movement.itemId === itemId)
      .filter((movement) => movement.occurredAt.getTime() <= asOf.getTime())
      .reduce((sum, movement) => sum + movement.quantityDelta, 0);
  }

  public decant(itemId: string, quantity: number, at: Date, note = "Decanted for use"): void {
    if (quantity <= 0) throw new Error(`A decant of ${quantity} takes nothing out.`);
    const remaining = this.remainingQuantity(itemId, at);
    if (quantity > remaining) {
      throw new Error(`Cannot take ${quantity} from ${itemId}; only ${remaining} remains.`);
    }

    const item = this.requireItem(itemId);
    this.append(itemId, "DECANT", -quantity, item.locationId, item.locationId, at, note);
  }

  public movementLog(itemId: string): readonly StockMovement[] {
    return this.movements.filter((movement) => movement.itemId === itemId);
  }

  public contentsOf(locationId: string, asOf: Date): StockItem[] {
    this.requireLocation(locationId);
    return [...this.items.values()]
      .filter((item) => item.locationId === locationId)
      .filter((item) => this.remainingQuantity(item.itemId, asOf) > 0)
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
  }

  // ---------------------------------------------------------------------------
  // Segregation and limits
  // ---------------------------------------------------------------------------

  /**
   * Everything wrong with a location, not the first thing wrong with it.
   *
   * A cabinet with three problems that reports one gets three separate visits,
   * and the second and third get reported as new problems by somebody who
   * thought they had fixed it.
   */
  public assessLocation(locationId: string, assessedAt: Date): LocationAssessment {
    const location = this.requireLocation(locationId);
    const contents = this.contentsOf(locationId, assessedAt);
    const breaches: Breach[] = [];

    const quantityByClass: Record<string, number> = {};
    for (const item of contents) {
      quantityByClass[item.classId] =
        (quantityByClass[item.classId] ?? 0) + this.remainingQuantity(item.itemId, assessedAt);
    }

    // Segregation, over the resulting set rather than over any one item.
    const presentClasses = [...new Set(contents.map((item) => item.classId))].sort();
    for (let i = 0; i < presentClasses.length; i += 1) {
      for (let j = i + 1; j < presentClasses.length; j += 1) {
        const rule = this.segregation.get(pairKey(presentClasses[i], presentClasses[j]));
        if (!rule) continue;

        breaches.push({
          kind: "SEGREGATION",
          locationId,
          itemIds: contents
            .filter(
              (item) => item.classId === presentClasses[i] || item.classId === presentClasses[j],
            )
            .map((item) => item.itemId),
          detail: `${presentClasses[i]} and ${presentClasses[j]} may not share a location: ${rule.reason}`,
          quantity: null,
          limit: null,
        });
      }
    }

    // Aggregate limits, on the total of a class rather than on any container.
    if (!location.licensedStore) {
      for (const [classId, quantity] of Object.entries(quantityByClass).sort()) {
        const limit = location.classLimits[classId];
        const itemIds = contents
          .filter((item) => item.classId === classId)
          .map((item) => item.itemId);

        if (limit === undefined) {
          breaches.push({
            kind: "UNRATED_CLASS",
            locationId,
            itemIds,
            detail: `${locationId} is not rated to hold ${classId}`,
            quantity,
            limit: 0,
          });
        } else if (quantity > limit) {
          breaches.push({
            kind: "CLASS_LIMIT",
            locationId,
            itemIds,
            detail: `${quantity} of ${classId} against a limit of ${limit}; this belongs in a licensed store`,
            quantity,
            limit,
          });
        }
      }
    }

    for (const item of contents) {
      const expiry = this.assessExpiry(item.itemId, assessedAt);
      if (!expiry.expired) continue;

      breaches.push({
        kind: expiry.deadlineKind === "DISPOSAL_DEADLINE" ? "DISPOSAL_OVERDUE" : "EXPIRED",
        locationId,
        itemIds: [item.itemId],
        detail:
          expiry.deadlineKind === "DISPOSAL_DEADLINE"
            ? `${item.itemId} passed its disposal deadline ${expiry.daysPastExpiry} days ago`
            : `${item.itemId} expired ${expiry.daysPastExpiry} days ago`,
        quantity: null,
        limit: null,
      });

      if (expiry.immovable) {
        breaches.push({
          kind: "IMMOVABLE",
          locationId,
          itemIds: [item.itemId],
          detail: `${item.itemId} must be assessed where it stands and not moved`,
          quantity: null,
          limit: null,
        });
      }
    }

    breaches.sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.itemIds.join().localeCompare(b.itemIds.join()),
    );

    return {
      locationId,
      assessedAt,
      compliant: breaches.length === 0,
      breaches,
      quantityByClass,
    };
  }

  // ---------------------------------------------------------------------------
  // Movement
  // ---------------------------------------------------------------------------

  /**
   * Brings new stock into a location, checked against what will then be there.
   */
  public receiveItem(item: StockItem, at: Date): { outcome: ReceiptOutcome; breaches: Breach[] } {
    this.requireClass(item.classId);
    if (!this.locations.has(item.locationId)) {
      return { outcome: "REFUSED_UNKNOWN_LOCATION", breaches: [] };
    }
    if (this.items.has(item.itemId)) {
      throw new Error(`Item ${item.itemId} is already on the register.`);
    }

    const check = this.wouldBreach(item.locationId, item.classId, item.nominalQuantity, at, null);
    if (check.outcome !== "TRANSFERRED")
      return { outcome: check.outcome, breaches: check.breaches };

    this.placeItem(item, at, "Received");
    return { outcome: "RECEIVED", breaches: [] };
  }

  /**
   * Moves an item between locations, checked against the resulting contents of
   * the destination.
   *
   * A transfer that would make the destination unlawful is refused even where
   * the item is unremarkable on its own — and a transfer that would make the
   * *source* lawful does not excuse it. Emptying one bad cupboard into another
   * is not a fix.
   */
  public transferItem(
    itemId: string,
    toLocationId: string,
    at: Date,
    note = "Transferred",
  ): { outcome: TransferOutcome; breaches: Breach[] } {
    const item = this.requireItem(itemId);

    if (!this.locations.has(toLocationId)) {
      return { outcome: "REFUSED_UNKNOWN_LOCATION", breaches: [] };
    }
    if (item.locationId === toLocationId) {
      return { outcome: "REFUSED_SAME_LOCATION", breaches: [] };
    }

    const remaining = this.remainingQuantity(itemId, at);
    if (remaining <= 0) return { outcome: "REFUSED_EXHAUSTED", breaches: [] };

    // The container that must be assessed where it stands is refused first.
    // Nothing about the destination makes moving it acceptable.
    if (this.assessExpiry(itemId, at).immovable) {
      return { outcome: "REFUSED_IMMOVABLE", breaches: [] };
    }

    const check = this.wouldBreach(toLocationId, item.classId, remaining, at, itemId);
    if (check.outcome !== "TRANSFERRED") return check;

    const from = item.locationId;
    this.items.set(itemId, { ...item, locationId: toLocationId });
    this.append(itemId, "TRANSFER", 0, from, toLocationId, at, note);

    return { outcome: "TRANSFERRED", breaches: [] };
  }

  // ---------------------------------------------------------------------------
  // Disposal
  // ---------------------------------------------------------------------------

  /**
   * The route an item leaves by.
   *
   * Refuses to produce one for a container that has to be assessed where it
   * stands. Returning a route anyway would be the most dangerous thing this
   * module could do: it reads as an instruction to pick the bottle up.
   */
  public disposalRoute(itemId: string, at: Date): DisposalRouting {
    const item = this.requireItem(itemId);
    const spec = this.requireClass(item.classId);
    const expiry = this.assessExpiry(itemId, at);

    if (expiry.immovable) {
      return {
        itemId,
        routed: false,
        route: null,
        reason: `${item.substance} is ${expiry.daysPastExpiry} days past its disposal deadline and must be assessed in place`,
      };
    }

    return {
      itemId,
      routed: true,
      route: spec.disposalRoute,
      reason:
        expiry.deadlineKind === "DISPOSAL_DEADLINE"
          ? "Peroxide-former within the window in which it may still be moved"
          : "Routine disposal",
    };
  }

  public dispose(
    itemId: string,
    at: Date,
    note = "Disposed",
  ): { disposed: boolean; reason: string } {
    const routing = this.disposalRoute(itemId, at);
    if (!routing.routed) return { disposed: false, reason: routing.reason };

    const item = this.requireItem(itemId);
    const remaining = this.remainingQuantity(itemId, at);
    this.append(itemId, "DISPOSAL", -remaining, item.locationId, null, at, note);

    return { disposed: true, reason: `Routed to ${routing.route}` };
  }

  /** Every location with something wrong with it, worst first. */
  public nonCompliantLocations(assessedAt: Date): LocationAssessment[] {
    return [...this.locations.keys()]
      .map((locationId) => this.assessLocation(locationId, assessedAt))
      .filter((assessment) => !assessment.compliant)
      .sort(
        (a, b) => b.breaches.length - a.breaches.length || a.locationId.localeCompare(b.locationId),
      );
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * What a location would look like with a given quantity of a class added.
   *
   * The incoming item is excluded from the existing contents where it is
   * already there, so a transfer is measured against where it is going rather
   * than against both places at once.
   */
  private wouldBreach(
    locationId: string,
    classId: string,
    quantity: number,
    at: Date,
    excludeItemId: string | null,
  ): { outcome: TransferOutcome; breaches: Breach[] } {
    const location = this.requireLocation(locationId);
    const contents = this.contentsOf(locationId, at).filter(
      (item) => item.itemId !== excludeItemId,
    );

    for (const existing of contents) {
      const rule = this.segregation.get(pairKey(existing.classId, classId));
      if (!rule) continue;

      return {
        outcome: "REFUSED_SEGREGATION",
        breaches: [
          {
            kind: "SEGREGATION",
            locationId,
            itemIds: [existing.itemId],
            detail: `${classId} may not join ${existing.classId} in ${locationId}: ${rule.reason}`,
            quantity: null,
            limit: null,
          },
        ],
      };
    }

    if (location.licensedStore) return { outcome: "TRANSFERRED", breaches: [] };

    const limit = location.classLimits[classId];
    if (limit === undefined) {
      return {
        outcome: "REFUSED_UNRATED_CLASS",
        breaches: [
          {
            kind: "UNRATED_CLASS",
            locationId,
            itemIds: [],
            detail: `${locationId} is not rated to hold ${classId}`,
            quantity,
            limit: 0,
          },
        ],
      };
    }

    const existingQuantity = contents
      .filter((item) => item.classId === classId)
      .reduce((sum, item) => sum + this.remainingQuantity(item.itemId, at), 0);

    if (existingQuantity + quantity > limit) {
      return {
        outcome: "REFUSED_CLASS_LIMIT",
        breaches: [
          {
            kind: "CLASS_LIMIT",
            locationId,
            itemIds: contents.filter((i) => i.classId === classId).map((i) => i.itemId),
            detail: `${existingQuantity + quantity} of ${classId} would exceed the ${limit} ${locationId} is rated for; this belongs in a licensed store`,
            quantity: existingQuantity + quantity,
            limit,
          },
        ],
      };
    }

    return { outcome: "TRANSFERRED", breaches: [] };
  }

  private placeItem(item: StockItem, at: Date, note: string): void {
    const spec = this.requireClass(item.classId);
    this.requireLocation(item.locationId);

    if (item.unit !== spec.unit) {
      // A limit expressed in millilitres cannot be compared against grams, and
      // the comparison would silently succeed.
      throw new Error(
        `Item ${item.itemId} is measured in ${item.unit} but ${item.classId} is measured in ${spec.unit}.`,
      );
    }
    if (item.nominalQuantity <= 0) {
      throw new Error(`Item ${item.itemId} has no quantity.`);
    }
    if (item.openedOn && item.openedOn.getTime() < item.manufacturedOn.getTime()) {
      throw new Error(`Item ${item.itemId} was opened before it was made.`);
    }

    this.items.set(item.itemId, { ...item });
    this.append(item.itemId, "RECEIPT", item.nominalQuantity, null, item.locationId, at, note);
  }

  private append(
    itemId: string,
    kind: MovementKind,
    quantityDelta: number,
    fromLocationId: string | null,
    toLocationId: string | null,
    occurredAt: Date,
    note: string,
  ): void {
    this.sequence += 1;
    this.movements.push({
      sequence: this.sequence,
      itemId,
      kind,
      quantityDelta,
      fromLocationId,
      toLocationId,
      occurredAt,
      note,
    });
  }

  private requireClass(classId: string): HazardClassSpec {
    const spec = this.classes.get(classId);
    if (!spec) throw new Error(`Unknown hazard class ${classId}.`);
    return spec;
  }

  private requireLocation(locationId: string): StorageLocation {
    const location = this.locations.get(locationId);
    if (!location) throw new Error(`Unknown location ${locationId}.`);
    return location;
  }

  private requireItem(itemId: string): StockItem {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`Unknown item ${itemId}.`);
    return item;
  }
}
