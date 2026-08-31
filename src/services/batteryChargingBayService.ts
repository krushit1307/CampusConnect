/**
 * Module: Battery Charging Bay Register
 * File: src/services/batteryChargingBayService.ts
 * Scope: Reserves watt-hours rather than sockets, refuses on projected finish
 *        time rather than start time, and treats quarantine as a state that
 *        removes a pack from chargeable inventory (#4926).
 *
 * A lithium fire is not a fire that gets put out; it is a fire that gets
 * contained until it stops. It runs hot enough to reignite after being
 * extinguished, it carries its own oxidiser so smothering does nothing, and it
 * propagates to the cell next to it. Everything about the problem is therefore
 * decided before the fire, by where the packs were and what was beside them.
 *
 * A charging bay has an energy limit, not a socket limit. Six sockets is not
 * the constraint; the constraint is the total watt-hours on the bench. People
 * plan against sockets because sockets are visible, so a bay rated for a modest
 * total ends up holding a robotics team's entire competition load because
 * somebody found an extension lead.
 *
 * "Unattended" is a property of the time, not the room. The same bench is
 * supervised at 3pm and empty at 3am, and the decision has to be made from the
 * *projected finish*, which nobody computes because it depends on the pack, its
 * state of charge and the charger. A charge that is fine to start after lunch
 * is a different proposition when it is still running at four in the morning
 * with the building locked.
 *
 * Chemistry is not one category. A lithium-iron pack is materially more
 * tolerant than a LiPo of the same nominal capacity, and a LiPo left sitting at
 * full charge degrades in a way that a LiPo at storage charge does not.
 * Treating them alike gets the tolerant case wrong in the annoying direction
 * and the intolerant case wrong in the direction that matters.
 *
 * And a damaged cell is always the one somebody wants topped up before the next
 * run. Swelling is the specific pre-failure sign that means the pack must never
 * see a charger again, so quarantine here removes it from chargeable inventory
 * outright rather than attaching a warning to a booking that still succeeds.
 */

export type Chemistry = "LIPO" | "LI_ION" | "LIFEPO4";

export type PackCondition = "SERVICEABLE" | "QUARANTINED";

export type IncidentKind = "SWELLING" | "IMPACT_DAMAGE" | "OVER_DISCHARGE" | "FAILED_POST_CHECK";

export type SessionStatus = "BOOKED" | "COMPLETED" | "VOIDED";

export type BookingOutcome =
  | "BOOKED"
  | "REFUSED_UNKNOWN_PACK"
  | "REFUSED_UNKNOWN_BAY"
  | "REFUSED_PACK_QUARANTINED"
  | "REFUSED_PACK_ALREADY_CHARGING"
  | "REFUSED_INVALID_CHARGE_STATE"
  | "REFUSED_VENTILATION"
  | "REFUSED_CO_LOCATION"
  | "REFUSED_ENERGY_CAPACITY"
  | "REFUSED_UNATTENDED_FINISH"
  | "REFUSED_UNATTENDED_FULL_CHARGE";

export type StorageOutcome =
  | "STORED"
  | "REFUSED_UNKNOWN_PACK"
  | "REFUSED_UNKNOWN_BAY"
  | "REFUSED_NOT_QUARANTINED"
  | "REFUSED_BAY_NOT_SEGREGATED";

export type ReleaseOutcome =
  | "RELEASED"
  | "REFUSED_UNKNOWN_PACK"
  | "REFUSED_NOT_QUARANTINED"
  | "REFUSED_REVIEWER_NOT_COMPETENT"
  | "REFUSED_UNRECOVERABLE";

export interface BatteryPack {
  packId: string;
  ownerId: string;
  label: string;
  chemistry: Chemistry;
  /** Nominal capacity. The hazard is what is stored in it, not what it is rated at. */
  capacityWh: number;
  cellCount: number;
  condition: PackCondition;
  quarantineReason: IncidentKind | null;
  quarantinedAt: Date | null;
}

export interface ChargingBay {
  bayId: string;
  label: string;
  /** Effective watt-hours the bench may hold at once. Not a socket count. */
  energyCapacityWh: number;
  /** Higher is better ventilated. Chemistries demand a minimum. */
  ventilationClass: number;
  /** Minutes past midnight UTC. Outside this the bench is empty of people. */
  supervisedFromMinute: number;
  supervisedToMinute: number;
  /** Whether a charge may still be running when nobody is there. */
  overnightCapable: boolean;
  /** Whether the bay is the segregated store quarantined packs go to. */
  segregated: boolean;
  /** Declared hazards sharing the space: a solvent store, a fire exit route. */
  adjacentHazards: string[];
}

export interface ChargingSession {
  sessionId: string;
  packId: string;
  bayId: string;
  chargerWatts: number;
  startStateOfCharge: number;
  targetStateOfCharge: number;
  startAt: Date;
  projectedFinishAt: Date;
  /** Watt-hours reserved against the bay for the session window. */
  reservedWh: number;
  status: SessionStatus;
  voidedReason: string | null;
}

export interface BookingResult {
  outcome: BookingOutcome;
  session: ChargingSession | null;
  /** Set on a capacity refusal: how far over the bay's rating this would go. */
  overageWh: number | null;
  /** Set on a supervision refusal: when the charge would still be running. */
  projectedFinishAt: Date | null;
  detail: string;
}

export interface StorageResult {
  outcome: StorageOutcome;
  detail: string;
}

export interface ReleaseResult {
  outcome: ReleaseOutcome;
  detail: string;
}

export interface AmendmentResult {
  amended: boolean;
  voidedSessionId: string | null;
  detail: string;
}

export interface PackIncident {
  incidentId: string;
  packId: string;
  kind: IncidentKind;
  reportedBy: string;
  reportedAt: Date;
  notes: string;
}

/**
 * How much of a bay's rating a chemistry consumes per stored watt-hour. A LiPo
 * and a lithium-iron pack of the same capacity are not the same amount of
 * bench, and averaging them gets the intolerant one wrong.
 */
export const HAZARD_FACTOR: Record<Chemistry, number> = {
  LIPO: 1.5,
  LI_ION: 1.2,
  LIFEPO4: 0.8,
};

/** Minimum ventilation class each chemistry needs from the bay it sits in. */
export const REQUIRED_VENTILATION_CLASS: Record<Chemistry, number> = {
  LIPO: 2,
  LI_ION: 2,
  LIFEPO4: 1,
};

/**
 * A LiPo above this state of charge is being stored full rather than at storage
 * charge, which is the state it degrades in. Acceptable while somebody is
 * watching it; not acceptable overnight.
 */
export const LIPO_STORAGE_STATE_OF_CHARGE = 0.5;

/** Chargers do not put every watt they draw into the cell. */
export const CHARGE_EFFICIENCY = 0.9;

/** Incidents a pack does not come back from, whoever reviews it. */
export const UNRECOVERABLE_INCIDENTS: IncidentKind[] = ["SWELLING"];

const MINUTES_PER_DAY = 1_440;

function minuteOfDay(at: Date): number {
  return at.getUTCHours() * 60 + at.getUTCMinutes();
}

function windowsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

function roundWh(value: number): number {
  return Math.round(value * 100) / 100;
}

export class BatteryChargingBayService {
  private readonly packs = new Map<string, BatteryPack>();
  private readonly bays = new Map<string, ChargingBay>();
  private readonly sessions = new Map<string, ChargingSession>();
  private readonly incidents = new Map<string, PackIncident>();
  private readonly quarantineStore = new Map<string, string>();
  private readonly competentReviewers = new Set<string>();
  /** Hazards that must not share a bay with a charging pack. */
  private readonly prohibitedHazards = new Set<string>();

  private sessionSequence = 0;
  private incidentSequence = 0;

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerPack(pack: Omit<BatteryPack, "condition" | "quarantineReason" | "quarantinedAt">): void {
    if (pack.capacityWh <= 0) {
      throw new Error(`Pack ${pack.packId} has a non-positive capacity`);
    }
    if (pack.cellCount <= 0) {
      throw new Error(`Pack ${pack.packId} has a non-positive cell count`);
    }
    this.packs.set(pack.packId, {
      ...pack,
      condition: "SERVICEABLE",
      quarantineReason: null,
      quarantinedAt: null,
    });
  }

  registerBay(bay: ChargingBay): void {
    if (bay.energyCapacityWh <= 0) {
      throw new Error(`Bay ${bay.bayId} has a non-positive energy capacity`);
    }
    if (
      bay.supervisedFromMinute < 0 ||
      bay.supervisedToMinute > MINUTES_PER_DAY ||
      bay.supervisedToMinute <= bay.supervisedFromMinute
    ) {
      throw new Error(`Bay ${bay.bayId} has an invalid supervised window`);
    }
    this.bays.set(bay.bayId, { ...bay, adjacentHazards: [...bay.adjacentHazards] });
  }

  registerCompetentReviewer(reviewerId: string): void {
    this.competentReviewers.add(reviewerId);
  }

  /** Declare a hazard that no charging bay may sit alongside. */
  prohibitHazard(hazard: string): void {
    this.prohibitedHazards.add(hazard);
  }

  getPack(packId: string): BatteryPack | null {
    const pack = this.packs.get(packId);
    return pack ? { ...pack } : null;
  }

  getSession(sessionId: string): ChargingSession | null {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  // ---------------------------------------------------------------------------
  // Energy arithmetic
  // ---------------------------------------------------------------------------

  /**
   * Effective watt-hours a pack consumes on a bench at a given state of charge,
   * after its chemistry's hazard factor.
   */
  effectiveLoadWh(packId: string, stateOfCharge: number): number {
    const pack = this.packs.get(packId);
    if (!pack) return 0;
    return roundWh(pack.capacityWh * stateOfCharge * HAZARD_FACTOR[pack.chemistry]);
  }

  /**
   * When a charge will actually finish. This, not the start time, is what the
   * supervision rule is evaluated against.
   */
  projectFinish(
    packId: string,
    chargerWatts: number,
    startStateOfCharge: number,
    targetStateOfCharge: number,
    startAt: Date,
  ): Date | null {
    const pack = this.packs.get(packId);
    if (!pack || chargerWatts <= 0) return null;
    if (targetStateOfCharge <= startStateOfCharge) return null;

    const energyIntoCellWh = pack.capacityWh * (targetStateOfCharge - startStateOfCharge);
    const energyDrawnWh = energyIntoCellWh / CHARGE_EFFICIENCY;
    const hours = energyDrawnWh / chargerWatts;
    return new Date(startAt.getTime() + Math.ceil(hours * 3_600_000));
  }

  /** Effective watt-hours already reserved on a bay across a window. */
  reservedWhDuring(bayId: string, from: Date, to: Date): number {
    let total = 0;
    for (const session of this.sessions.values()) {
      if (session.bayId !== bayId) continue;
      if (session.status !== "BOOKED") continue;
      if (!windowsOverlap(from, to, session.startAt, session.projectedFinishAt)) continue;
      total += session.reservedWh;
    }
    return roundWh(total);
  }

  /** Whether the bench has somebody on it at an instant. */
  isSupervisedAt(bayId: string, at: Date): boolean {
    const bay = this.bays.get(bayId);
    if (!bay) return false;
    const minute = minuteOfDay(at);
    return minute >= bay.supervisedFromMinute && minute < bay.supervisedToMinute;
  }

  // ---------------------------------------------------------------------------
  // Booking a charge
  // ---------------------------------------------------------------------------

  /**
   * Reserve energy on a bay for a charge. Every refusal below is computed from
   * the pack, the charger and the window, which is why amending any of the
   * three voids the booking rather than adjusting it.
   */
  bookCharge(input: {
    packId: string;
    bayId: string;
    chargerWatts: number;
    startStateOfCharge: number;
    targetStateOfCharge: number;
    startAt: Date;
  }): BookingResult {
    const pack = this.packs.get(input.packId);
    if (!pack) {
      return this.refuse("REFUSED_UNKNOWN_PACK", `Pack ${input.packId} is not registered`);
    }

    const bay = this.bays.get(input.bayId);
    if (!bay) {
      return this.refuse("REFUSED_UNKNOWN_BAY", `Bay ${input.bayId} is not registered`);
    }

    // A quarantined pack is not chargeable inventory. Not chargeable with a
    // warning attached — a warning printed next to a valid booking is a warning
    // that gets scrolled past.
    if (pack.condition === "QUARANTINED") {
      return this.refuse(
        "REFUSED_PACK_QUARANTINED",
        `${pack.label} is quarantined for ${pack.quarantineReason} and must not go on a charger`,
      );
    }

    if (this.activeSessionFor(input.packId)) {
      return this.refuse(
        "REFUSED_PACK_ALREADY_CHARGING",
        `${pack.label} already has a charging session booked`,
      );
    }

    if (
      input.startStateOfCharge < 0 ||
      input.targetStateOfCharge > 1 ||
      input.targetStateOfCharge <= input.startStateOfCharge ||
      input.chargerWatts <= 0
    ) {
      return this.refuse(
        "REFUSED_INVALID_CHARGE_STATE",
        `A charge from ${input.startStateOfCharge} to ${input.targetStateOfCharge} at ` +
          `${input.chargerWatts} W is not a charge`,
      );
    }

    if (bay.ventilationClass < REQUIRED_VENTILATION_CLASS[pack.chemistry]) {
      return this.refuse(
        "REFUSED_VENTILATION",
        `${bay.label} is ventilation class ${bay.ventilationClass}; ${pack.chemistry} needs ` +
          `class ${REQUIRED_VENTILATION_CLASS[pack.chemistry]}`,
      );
    }

    const hazard = bay.adjacentHazards.find((item) => this.prohibitedHazards.has(item));
    if (hazard) {
      return this.refuse(
        "REFUSED_CO_LOCATION",
        `${bay.label} shares its space with ${hazard}, which must not sit alongside charging cells`,
      );
    }

    const finishAt = this.projectFinish(
      input.packId,
      input.chargerWatts,
      input.startStateOfCharge,
      input.targetStateOfCharge,
      input.startAt,
    ) as Date;

    // The decision is made from the finish, not the start. A charge that is fine
    // to begin after lunch is a different proposition at four in the morning.
    if (!bay.overnightCapable && !this.isSupervisedAt(input.bayId, finishAt)) {
      return {
        outcome: "REFUSED_UNATTENDED_FINISH",
        session: null,
        overageWh: null,
        projectedFinishAt: finishAt,
        detail:
          `The charge would still be running at ${finishAt.toISOString()}, outside the ` +
          `supervised hours of ${bay.label}`,
      };
    }

    if (
      pack.chemistry === "LIPO" &&
      input.targetStateOfCharge > LIPO_STORAGE_STATE_OF_CHARGE &&
      !this.isSupervisedAt(input.bayId, finishAt)
    ) {
      return {
        outcome: "REFUSED_UNATTENDED_FULL_CHARGE",
        session: null,
        overageWh: null,
        projectedFinishAt: finishAt,
        detail:
          `A LiPo held above storage charge must not be left unattended; this one reaches ` +
          `${Math.round(input.targetStateOfCharge * 100)}% at ${finishAt.toISOString()}`,
      };
    }

    // Reserve the energy that will be on the bench at the peak, which is the
    // target state of charge rather than the amount added to get there.
    const reservedWh = this.effectiveLoadWh(input.packId, input.targetStateOfCharge);
    const alreadyReserved = this.reservedWhDuring(input.bayId, input.startAt, finishAt);

    if (alreadyReserved + reservedWh > bay.energyCapacityWh) {
      const overage = roundWh(alreadyReserved + reservedWh - bay.energyCapacityWh);
      return {
        outcome: "REFUSED_ENERGY_CAPACITY",
        session: null,
        overageWh: overage,
        projectedFinishAt: finishAt,
        detail:
          `${bay.label} is rated for ${bay.energyCapacityWh} Wh and already holds ` +
          `${alreadyReserved} Wh; this pack adds ${reservedWh} Wh, ${overage} Wh over`,
      };
    }

    this.sessionSequence += 1;
    const session: ChargingSession = {
      sessionId: `session-${this.sessionSequence}`,
      packId: input.packId,
      bayId: input.bayId,
      chargerWatts: input.chargerWatts,
      startStateOfCharge: input.startStateOfCharge,
      targetStateOfCharge: input.targetStateOfCharge,
      startAt: input.startAt,
      projectedFinishAt: finishAt,
      reservedWh,
      status: "BOOKED",
      voidedReason: null,
    };
    this.sessions.set(session.sessionId, session);

    return {
      outcome: "BOOKED",
      session: { ...session },
      overageWh: null,
      projectedFinishAt: finishAt,
      detail: `${pack.label} booked onto ${bay.label} for ${reservedWh} Wh until ${finishAt.toISOString()}`,
    };
  }

  /**
   * Change a booked session. Every refusal was computed from the pack, the
   * charger rate and the window, so changing any of them voids the booking and
   * requires re-booking rather than silently keeping a decision that was made
   * about something else.
   */
  amendSession(
    sessionId: string,
    changes: Partial<
      Pick<ChargingSession, "chargerWatts" | "targetStateOfCharge" | "startAt" | "bayId">
    >,
  ): AmendmentResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { amended: false, voidedSessionId: null, detail: `Session ${sessionId} not found` };
    }
    if (session.status !== "BOOKED") {
      return {
        amended: false,
        voidedSessionId: null,
        detail: `Session ${sessionId} is ${session.status.toLowerCase()}`,
      };
    }
    if (Object.keys(changes).length === 0) {
      return { amended: false, voidedSessionId: null, detail: `Nothing to change` };
    }

    session.status = "VOIDED";
    session.voidedReason = "Session amended after booking";

    return {
      amended: true,
      voidedSessionId: sessionId,
      detail: `Session ${sessionId} voided; the charge must be re-booked and re-assessed`,
    };
  }

  completeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "BOOKED") return false;
    session.status = "COMPLETED";
    return true;
  }

  cancelSession(sessionId: string, reason: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "BOOKED") return false;
    session.status = "VOIDED";
    session.voidedReason = reason;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Quarantine
  // ---------------------------------------------------------------------------

  /**
   * Record damage to a pack. This quarantines it immediately and cancels any
   * booked charge, because the pack somebody wants topped up before the next
   * run is exactly the pack that must not go on a charger.
   */
  recordIncident(input: {
    packId: string;
    kind: IncidentKind;
    reportedBy: string;
    reportedAt: Date;
    notes?: string;
  }): PackIncident | null {
    const pack = this.packs.get(input.packId);
    if (!pack) return null;

    this.incidentSequence += 1;
    const incident: PackIncident = {
      incidentId: `incident-${this.incidentSequence}`,
      packId: input.packId,
      kind: input.kind,
      reportedBy: input.reportedBy,
      reportedAt: input.reportedAt,
      notes: input.notes ?? "",
    };
    this.incidents.set(incident.incidentId, incident);

    pack.condition = "QUARANTINED";
    pack.quarantineReason = input.kind;
    pack.quarantinedAt = input.reportedAt;

    const active = this.activeSessionFor(input.packId);
    if (active) {
      active.status = "VOIDED";
      active.voidedReason = `Pack quarantined for ${input.kind}`;
    }

    return { ...incident };
  }

  incidentsFor(packId: string): PackIncident[] {
    return [...this.incidents.values()]
      .filter((incident) => incident.packId === packId)
      .map((incident) => ({ ...incident }));
  }

  /**
   * Send a quarantined pack to the segregated store. A quarantined pack never
   * goes on a shared bench, however much capacity that bench has spare: the
   * point of segregation is that a failure does not reach the pack beside it.
   */
  assignQuarantineStorage(packId: string, bayId: string): StorageResult {
    const pack = this.packs.get(packId);
    if (!pack) {
      return { outcome: "REFUSED_UNKNOWN_PACK", detail: `Pack ${packId} is not registered` };
    }
    const bay = this.bays.get(bayId);
    if (!bay) {
      return { outcome: "REFUSED_UNKNOWN_BAY", detail: `Bay ${bayId} is not registered` };
    }
    if (pack.condition !== "QUARANTINED") {
      return {
        outcome: "REFUSED_NOT_QUARANTINED",
        detail: `${pack.label} is serviceable and does not belong in segregated storage`,
      };
    }
    if (!bay.segregated) {
      return {
        outcome: "REFUSED_BAY_NOT_SEGREGATED",
        detail: `${bay.label} is a shared bench; a quarantined pack must go to segregated storage`,
      };
    }

    this.quarantineStore.set(packId, bayId);
    return { outcome: "STORED", detail: `${pack.label} moved to ${bay.label}` };
  }

  quarantineLocation(packId: string): string | null {
    return this.quarantineStore.get(packId) ?? null;
  }

  /**
   * Return a pack to service. Only a named competent reviewer may do it, and a
   * swollen pack never comes back — the swelling is the failure, not a symptom
   * of one that might be repaired.
   */
  releaseFromQuarantine(packId: string, reviewerId: string): ReleaseResult {
    const pack = this.packs.get(packId);
    if (!pack) {
      return { outcome: "REFUSED_UNKNOWN_PACK", detail: `Pack ${packId} is not registered` };
    }
    if (pack.condition !== "QUARANTINED") {
      return { outcome: "REFUSED_NOT_QUARANTINED", detail: `${pack.label} is not quarantined` };
    }
    if (!this.competentReviewers.has(reviewerId)) {
      return {
        outcome: "REFUSED_REVIEWER_NOT_COMPETENT",
        detail: `${reviewerId} is not a named competent reviewer`,
      };
    }
    if (pack.quarantineReason && UNRECOVERABLE_INCIDENTS.includes(pack.quarantineReason)) {
      return {
        outcome: "REFUSED_UNRECOVERABLE",
        detail: `${pack.label} was quarantined for ${pack.quarantineReason} and cannot be returned to service`,
      };
    }

    pack.condition = "SERVICEABLE";
    pack.quarantineReason = null;
    pack.quarantinedAt = null;
    this.quarantineStore.delete(packId);

    return { outcome: "RELEASED", detail: `${pack.label} returned to service by ${reviewerId}` };
  }

  // ---------------------------------------------------------------------------

  private activeSessionFor(packId: string): ChargingSession | null {
    for (const session of this.sessions.values()) {
      if (session.packId !== packId) continue;
      if (session.status !== "BOOKED") continue;
      return session;
    }
    return null;
  }

  private refuse(outcome: BookingOutcome, detail: string): BookingResult {
    return { outcome, session: null, overageWh: null, projectedFinishAt: null, detail };
  }
}
