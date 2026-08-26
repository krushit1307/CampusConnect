/**
 * Module: Stage Rigging Load Budget
 * File: src/services/riggingLoadBudgetService.ts
 * Scope: Checks a rigging plan as a whole structure before anybody climbs a
 *        ladder, and lets certification govern capacity rather than annotate
 *        it (#4703).
 *
 * A roof beam has two limits and the one people quote is the one that rarely
 * fails. A beam rated for 500 kg total will hold 500 kg spread over eight
 * points and fail at 300 kg concentrated on one. The per-point limit is what
 * actually breaks, and it is the one nobody writes on the booking form.
 *
 * The number that goes into the calculation is usually wrong before the
 * calculation starts. Hang 100 kg from two legs and people assume 50 kg each.
 * That is only true if the legs hang straight down. Spread them to an included
 * angle of 120° and each leg carries the full 100 kg — the whole load, in both
 * legs, from a bridle that looks conservative because there are two of them.
 *
 * The consequence is an asymmetry that this module is built around: the beam's
 * *total* sees the vertical component, which is just the weight, while each
 * *point* sees the leg tension, which is not. Rating both against the same
 * figure gets one of them wrong, and which one depends on the angle.
 *
 * Certification is not a warning here. An element whose inspection has expired
 * has an effective SWL of zero, because a warning printed next to a green total
 * is a warning that gets scrolled past.
 */

export type HardwareKind = "HOIST" | "SLING" | "SHACKLE";

export type LoadAttachment = "STATIC" | "HOISTED";

export type PlanStatus = "DRAFT" | "SIGNED_OFF" | "VOIDED";

export type GoverningKind = "STRUCTURE" | HardwareKind;

export type LoadAdditionOutcome =
  | "ADDED"
  | "REFUSED_UNKNOWN_POINT"
  | "REFUSED_UNSUPPORTED_BRIDLE"
  | "REFUSED_DUPLICATE_LEG"
  | "REFUSED_BRIDLE_ANGLE"
  | "REFUSED_WEIGHTLESS"
  | "REFUSED_PLAN_NOT_DRAFT";

export type SignOffOutcome =
  | "SIGNED_OFF"
  | "REFUSED_NO_LOADS"
  | "REFUSED_OVERLOADED"
  | "REFUSED_RIGGER_NOT_COMPETENT"
  | "REFUSED_ALREADY_SIGNED_OFF";

export type BreachKind = "POINT_OVERLOAD" | "STRUCTURE_OVERLOAD" | "UNCERTIFIED_ELEMENT";

export interface Inspection {
  certificateId: string;
  inspectedAt: Date;
  /** Certificates lapse. Past this instant the element is not rated. */
  validUntil: Date;
}

export interface RiggingHardware {
  hardwareId: string;
  kind: HardwareKind;
  label: string;
  swlKg: number;
  /** Null means the element has never been certificated, not that it is new. */
  inspection: Inspection | null;
}

export interface RiggingStructure {
  structureId: string;
  venueId: string;
  label: string;
  /** What the whole beam carries. */
  totalSwlKg: number;
  /** What any single point on it carries. The limit that actually fails. */
  perPointSwlKg: number;
  inspection: Inspection | null;
}

export interface RiggingPoint {
  pointId: string;
  structureId: string;
  label: string;
  /** Elements in the load path, beam-end first. The weakest one governs. */
  hardwarePath: string[];
}

export interface BridleSpec {
  /** One point is a straight pick. Two is a bridle. */
  legPointIds: string[];
  /** Included angle between the legs in degrees. Ignored for a single leg. */
  includedAngleDegrees: number;
}

export interface RiggedLoad {
  loadId: string;
  label: string;
  weightKg: number;
  attachment: LoadAttachment;
  bridle: BridleSpec;
}

export interface RiggerCompetency {
  riggerId: string;
  name: string;
  validUntil: Date;
}

export interface PointLoading {
  pointId: string;
  structureId: string;
  /** Sum of leg tensions landing here, dynamic factor already applied. */
  appliedKg: number;
  effectiveSwlKg: number;
  /** Which element sets the capacity. "Reduce the load" and "swap the sling"
   *  are different jobs and the plan should say which one it is. */
  governingElementId: string;
  governingKind: GoverningKind;
  overloaded: boolean;
}

export interface StructureLoading {
  structureId: string;
  /** Vertical component only. A bridle raises tension, not weight. */
  appliedKg: number;
  totalSwlKg: number;
  overloaded: boolean;
}

export interface Breach {
  kind: BreachKind;
  subjectId: string;
  detail: string;
  appliedKg: number;
  capacityKg: number;
}

export interface PlanAssessment {
  planId: string;
  assessedAt: Date;
  safe: boolean;
  points: PointLoading[];
  structures: StructureLoading[];
  /** Every breach found, not the first. */
  breaches: Breach[];
}

export interface SignOff {
  riggerId: string;
  signedAt: Date;
  /** The arrangement the signature refers to. */
  loadFingerprint: string;
}

export interface RiggingPlan {
  planId: string;
  eventId: string;
  venueId: string;
  status: PlanStatus;
  loads: RiggedLoad[];
  signOff: SignOff | null;
  voidReason: string | null;
}

export interface LegTension {
  /** Tension along one leg. Above the share once the angle opens up. */
  legTensionKg: number;
  /** Vertical component carried by one leg. Always the plain share. */
  verticalPerLegKg: number;
}

/**
 * What a moving load applies over its resting weight while it accelerates.
 * The rating has to cover the worst instant, not the state you see it in.
 */
export const DEFAULT_DYNAMIC_FACTOR = 1.4;

const DEGREES_TO_RADIANS = Math.PI / 180;

/** Loads are compared at one decimal place so float noise never decides a rig. */
function roundKg(value: number): number {
  return Math.round(value * 10) / 10;
}

export class RiggingLoadBudgetService {
  private readonly structures: Map<string, RiggingStructure>;
  private readonly hardware: Map<string, RiggingHardware>;
  private readonly points: Map<string, RiggingPoint>;
  private readonly plans: Map<string, RiggingPlan>;
  private readonly riggers: Map<string, RiggerCompetency>;
  private readonly dynamicFactor: number;

  constructor(dynamicFactor: number = DEFAULT_DYNAMIC_FACTOR) {
    if (dynamicFactor < 1) {
      throw new Error("A dynamic factor below 1 would rate a moving load under its own weight.");
    }
    this.structures = new Map();
    this.hardware = new Map();
    this.points = new Map();
    this.plans = new Map();
    this.riggers = new Map();
    this.dynamicFactor = dynamicFactor;
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  public registerStructure(structure: RiggingStructure): void {
    if (this.structures.has(structure.structureId)) {
      throw new Error(`Structure ${structure.structureId} is already registered.`);
    }
    if (structure.perPointSwlKg > structure.totalSwlKg) {
      // A point that outranks the beam is a transcription error, and it is the
      // kind that reads as generous rather than as wrong.
      throw new Error(
        `Structure ${structure.structureId} rates a single point above the whole beam.`,
      );
    }
    if (structure.totalSwlKg <= 0 || structure.perPointSwlKg <= 0) {
      throw new Error(`Structure ${structure.structureId} must carry something.`);
    }
    this.structures.set(structure.structureId, { ...structure });
  }

  public registerHardware(item: RiggingHardware): void {
    if (this.hardware.has(item.hardwareId)) {
      throw new Error(`Hardware ${item.hardwareId} is already registered.`);
    }
    if (item.swlKg <= 0) {
      throw new Error(`Hardware ${item.hardwareId} must carry something.`);
    }
    this.hardware.set(item.hardwareId, { ...item });
  }

  public registerPoint(point: RiggingPoint): void {
    if (this.points.has(point.pointId)) {
      throw new Error(`Point ${point.pointId} is already registered.`);
    }
    if (!this.structures.has(point.structureId)) {
      throw new Error(`Unknown structure ${point.structureId}.`);
    }
    for (const hardwareId of point.hardwarePath) {
      if (!this.hardware.has(hardwareId)) {
        throw new Error(`Unknown hardware ${hardwareId} in the path of ${point.pointId}.`);
      }
    }
    this.points.set(point.pointId, { ...point, hardwarePath: [...point.hardwarePath] });
  }

  public registerRigger(rigger: RiggerCompetency): void {
    this.riggers.set(rigger.riggerId, { ...rigger });
  }

  public openPlan(planId: string, eventId: string, venueId: string): RiggingPlan {
    if (this.plans.has(planId)) {
      throw new Error(`Plan ${planId} is already open.`);
    }
    const plan: RiggingPlan = {
      planId,
      eventId,
      venueId,
      status: "DRAFT",
      loads: [],
      signOff: null,
      voidReason: null,
    };
    this.plans.set(planId, plan);
    return { ...plan, loads: [] };
  }

  // ---------------------------------------------------------------------------
  // Loads
  // ---------------------------------------------------------------------------

  /**
   * Puts one load on the plan.
   *
   * Bridles of more than two legs are refused rather than approximated. The
   * even-share assumption that makes a three-leg calculation tractable is the
   * same assumption this module exists to disprove, so producing a number for
   * one would be worse than declining to.
   */
  public addLoad(planId: string, load: RiggedLoad): { outcome: LoadAdditionOutcome } {
    const plan = this.requirePlan(planId);

    if (plan.status !== "DRAFT") return { outcome: "REFUSED_PLAN_NOT_DRAFT" };
    if (load.weightKg <= 0) return { outcome: "REFUSED_WEIGHTLESS" };

    const legs = load.bridle.legPointIds;
    if (legs.length < 1 || legs.length > 2) return { outcome: "REFUSED_UNSUPPORTED_BRIDLE" };
    if (legs.length === 2 && legs[0] === legs[1]) return { outcome: "REFUSED_DUPLICATE_LEG" };

    for (const pointId of legs) {
      const point = this.points.get(pointId);
      if (!point) return { outcome: "REFUSED_UNKNOWN_POINT" };
      if (this.structures.get(point.structureId)!.venueId !== plan.venueId) {
        return { outcome: "REFUSED_UNKNOWN_POINT" };
      }
    }

    if (legs.length === 2) {
      const angle = load.bridle.includedAngleDegrees;
      // At 180° the legs are horizontal and the tension is unbounded. That is
      // not a heavy rig, it is an impossible geometry, and returning a very
      // large number invites somebody to argue about the margin.
      if (!Number.isFinite(angle) || angle <= 0 || angle >= 180) {
        return { outcome: "REFUSED_BRIDLE_ANGLE" };
      }
    }

    plan.loads.push({ ...load, bridle: { ...load.bridle, legPointIds: [...legs] } });
    return { outcome: "ADDED" };
  }

  /**
   * Takes a load off the plan.
   *
   * On a signed-off plan this voids the signature. The signature refers to a
   * specific arrangement, and an arrangement that has changed is one nobody
   * has approved.
   */
  public removeLoad(planId: string, loadId: string): { removed: boolean; voided: boolean } {
    const plan = this.requirePlan(planId);
    const index = plan.loads.findIndex((load) => load.loadId === loadId);
    if (index === -1) return { removed: false, voided: false };

    plan.loads.splice(index, 1);
    const voided = this.voidIfSigned(plan, `Load ${loadId} removed after sign-off`);
    return { removed: true, voided };
  }

  public reweightLoad(
    planId: string,
    loadId: string,
    weightKg: number,
  ): { updated: boolean; voided: boolean } {
    const plan = this.requirePlan(planId);
    const load = plan.loads.find((candidate) => candidate.loadId === loadId);
    if (!load || weightKg <= 0) return { updated: false, voided: false };

    load.weightKg = weightKg;
    const voided = this.voidIfSigned(plan, `Load ${loadId} re-weighted after sign-off`);
    return { updated: true, voided };
  }

  // ---------------------------------------------------------------------------
  // Tension
  // ---------------------------------------------------------------------------

  /**
   * Tension in one leg, and the vertical component that same leg carries.
   *
   * These diverge as the angle opens, and keeping them separate is the whole
   * point. The beam's total sees the vertical sum, which is the weight. Each
   * point sees the tension, which at 120° is the entire load in each of two
   * legs.
   */
  public legTension(
    weightKg: number,
    attachment: LoadAttachment,
    legCount: number,
    includedAngleDegrees: number,
  ): LegTension {
    const rated = attachment === "HOISTED" ? weightKg * this.dynamicFactor : weightKg;

    if (legCount === 1) {
      return { legTensionKg: roundKg(rated), verticalPerLegKg: roundKg(rated) };
    }

    const halfAngle = (includedAngleDegrees / 2) * DEGREES_TO_RADIANS;
    const legTensionKg = rated / (2 * Math.cos(halfAngle));

    return {
      legTensionKg: roundKg(legTensionKg),
      verticalPerLegKg: roundKg(rated / legCount),
    };
  }

  // ---------------------------------------------------------------------------
  // Capacity
  // ---------------------------------------------------------------------------

  /**
   * What a point will actually carry, and which element decides.
   *
   * The minimum across the whole path, where an element out of inspection
   * contributes zero. It is not rated if it is not certified.
   */
  public effectiveCapacity(
    pointId: string,
    asOf: Date,
  ): { capacityKg: number; governingElementId: string; governingKind: GoverningKind } {
    const point = this.requirePoint(pointId);
    const structure = this.structures.get(point.structureId)!;

    let capacityKg = this.certifiedSwl(structure.perPointSwlKg, structure.inspection, asOf);
    let governingElementId = structure.structureId;
    let governingKind: GoverningKind = "STRUCTURE";

    for (const hardwareId of point.hardwarePath) {
      const item = this.hardware.get(hardwareId)!;
      const swl = this.certifiedSwl(item.swlKg, item.inspection, asOf);
      if (swl < capacityKg) {
        capacityKg = swl;
        governingElementId = item.hardwareId;
        governingKind = item.kind;
      }
    }

    return { capacityKg: roundKg(capacityKg), governingElementId, governingKind };
  }

  // ---------------------------------------------------------------------------
  // Assessment
  // ---------------------------------------------------------------------------

  /**
   * Checks the plan as one structure.
   *
   * Both limits are evaluated independently and both are reported. A plan that
   * passes on total and fails on a single point is the normal failure, and a
   * single combined verdict hides exactly the case that hurts somebody.
   */
  public assess(planId: string, assessedAt: Date): PlanAssessment {
    const plan = this.requirePlan(planId);

    const appliedByPoint = new Map<string, number>();
    const verticalByStructure = new Map<string, number>();

    for (const load of plan.loads) {
      const legs = load.bridle.legPointIds;
      const tension = this.legTension(
        load.weightKg,
        load.attachment,
        legs.length,
        load.bridle.includedAngleDegrees,
      );

      for (const pointId of legs) {
        appliedByPoint.set(pointId, (appliedByPoint.get(pointId) ?? 0) + tension.legTensionKg);
        const structureId = this.points.get(pointId)!.structureId;
        verticalByStructure.set(
          structureId,
          (verticalByStructure.get(structureId) ?? 0) + tension.verticalPerLegKg,
        );
      }
    }

    const breaches: Breach[] = [];

    const points: PointLoading[] = [...appliedByPoint.entries()]
      .map(([pointId, applied]) => {
        const capacity = this.effectiveCapacity(pointId, assessedAt);
        const appliedKg = roundKg(applied);
        const overloaded = appliedKg > capacity.capacityKg;

        if (overloaded) {
          breaches.push({
            kind: capacity.capacityKg === 0 ? "UNCERTIFIED_ELEMENT" : "POINT_OVERLOAD",
            subjectId: pointId,
            detail:
              capacity.capacityKg === 0
                ? `${capacity.governingElementId} is not in inspection, so ${pointId} is not rated`
                : `${pointId} is governed by ${capacity.governingElementId} (${capacity.governingKind})`,
            appliedKg,
            capacityKg: capacity.capacityKg,
          });
        }

        return {
          pointId,
          structureId: this.points.get(pointId)!.structureId,
          appliedKg,
          effectiveSwlKg: capacity.capacityKg,
          governingElementId: capacity.governingElementId,
          governingKind: capacity.governingKind,
          overloaded,
        };
      })
      .sort((a, b) => a.pointId.localeCompare(b.pointId));

    const structures: StructureLoading[] = [...verticalByStructure.entries()]
      .map(([structureId, vertical]) => {
        const structure = this.structures.get(structureId)!;
        const totalSwlKg = this.certifiedSwl(
          structure.totalSwlKg,
          structure.inspection,
          assessedAt,
        );
        const appliedKg = roundKg(vertical);
        const overloaded = appliedKg > totalSwlKg;

        if (overloaded) {
          breaches.push({
            kind: totalSwlKg === 0 ? "UNCERTIFIED_ELEMENT" : "STRUCTURE_OVERLOAD",
            subjectId: structureId,
            detail:
              totalSwlKg === 0
                ? `${structureId} is not in inspection, so the beam is not rated`
                : `${structureId} carries ${appliedKg} kg against ${totalSwlKg} kg`,
            appliedKg,
            capacityKg: totalSwlKg,
          });
        }

        return { structureId, appliedKg, totalSwlKg, overloaded };
      })
      .sort((a, b) => a.structureId.localeCompare(b.structureId));

    return {
      planId,
      assessedAt,
      safe: breaches.length === 0,
      points,
      structures,
      breaches: breaches.sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.subjectId.localeCompare(b.subjectId),
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Sign-off
  // ---------------------------------------------------------------------------

  /**
   * Freezes the plan against a named rigger.
   *
   * The competency is checked at the time of signing and the assessment is run
   * at the same instant, so a certificate that lapses between drafting and the
   * get-in is the case this catches rather than the case it misses.
   */
  public signOff(planId: string, riggerId: string, signedAt: Date): { outcome: SignOffOutcome } {
    const plan = this.requirePlan(planId);

    if (plan.status === "SIGNED_OFF") return { outcome: "REFUSED_ALREADY_SIGNED_OFF" };
    if (plan.loads.length === 0) return { outcome: "REFUSED_NO_LOADS" };

    const rigger = this.riggers.get(riggerId);
    if (!rigger || rigger.validUntil.getTime() < signedAt.getTime()) {
      return { outcome: "REFUSED_RIGGER_NOT_COMPETENT" };
    }

    if (!this.assess(planId, signedAt).safe) return { outcome: "REFUSED_OVERLOADED" };

    plan.status = "SIGNED_OFF";
    plan.voidReason = null;
    plan.signOff = { riggerId, signedAt, loadFingerprint: this.fingerprint(plan) };
    return { outcome: "SIGNED_OFF" };
  }

  /**
   * Whether the signature still describes what is on the plan.
   *
   * Kept separate from `status` so that a plan altered by any route — not only
   * the mutators on this class — is caught at the point somebody asks.
   */
  public signatureIsCurrent(planId: string): boolean {
    const plan = this.requirePlan(planId);
    if (plan.status !== "SIGNED_OFF" || !plan.signOff) return false;
    return plan.signOff.loadFingerprint === this.fingerprint(plan);
  }

  public getPlan(planId: string): RiggingPlan {
    const plan = this.requirePlan(planId);
    return { ...plan, loads: plan.loads.map((load) => ({ ...load })) };
  }

  /** Every plan at a venue, unsafe first, so the get-in list starts where it should. */
  public venueSummary(venueId: string, assessedAt: Date): PlanAssessment[] {
    return [...this.plans.values()]
      .filter((plan) => plan.venueId === venueId)
      .map((plan) => this.assess(plan.planId, assessedAt))
      .sort(
        (a, b) =>
          Number(a.safe) - Number(b.safe) ||
          b.breaches.length - a.breaches.length ||
          a.planId.localeCompare(b.planId),
      );
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private certifiedSwl(swlKg: number, inspection: Inspection | null, asOf: Date): number {
    if (!inspection) return 0;
    return inspection.validUntil.getTime() >= asOf.getTime() ? swlKg : 0;
  }

  private voidIfSigned(plan: RiggingPlan, reason: string): boolean {
    if (plan.status !== "SIGNED_OFF") return false;
    plan.status = "VOIDED";
    plan.voidReason = reason;
    plan.signOff = null;
    return true;
  }

  private fingerprint(plan: RiggingPlan): string {
    return plan.loads
      .map(
        (load) =>
          `${load.loadId}:${load.weightKg}:${load.attachment}:${load.bridle.legPointIds.join("+")}:${load.bridle.includedAngleDegrees}`,
      )
      .sort()
      .join("|");
  }

  private requirePlan(planId: string): RiggingPlan {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Unknown plan ${planId}.`);
    return plan;
  }

  private requirePoint(pointId: string): RiggingPoint {
    const point = this.points.get(pointId);
    if (!point) throw new Error(`Unknown point ${pointId}.`);
    return point;
  }
}
