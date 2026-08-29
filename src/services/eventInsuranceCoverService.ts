/**
 * Module: Event Insurance Cover Adequacy
 * File: src/services/eventInsuranceCoverService.ts
 * Scope: Classifies the activities in an event, evaluates each against the
 *        policy in force on the event's date — schedule, exclusions,
 *        endorsements, per-claim limit and remaining aggregate — layers venue
 *        and third-party minimums over the top, accepts contractor cover where
 *        it genuinely discharges the risk, and reports the shortfall and the
 *        remedy for every gap (#5159).
 *
 * Cover is per-activity, not per-event. A policy covers a schedule of
 * classified activities; an event is a bundle of them — a bar, a band, an
 * inflatable, and somebody abseiling off the sports hall for charity. The event
 * is covered only if every activity in it is, and the activity that is not is
 * never the one anyone worried about. A single "is this event insured?" flag
 * answers the question about the bar and stays silent about the abseil.
 *
 * An excluded activity, an unlisted one and an endorsed one are three different
 * facts. Exclusions exist to defeat exactly the argument that the activity was
 * obviously covered. An unlisted activity is not refused cover — it has not
 * been asked about, and can usually be added by endorsement for a premium
 * somebody is willing to pay if they are told in time. Collapsing all three
 * into "not covered" tells a committee to cancel an event they could have
 * insured for forty pounds.
 *
 * Limits are per-claim and in the aggregate, and the aggregate is shared across
 * the policy year. An event needing five million in March can be uncoverable
 * because of a claim in November, and a check that looks only at the per-claim
 * limit will never see it. The aggregate is therefore eroded by claims incurred
 * inside the policy period before the event, and cover is the lesser of what
 * the policy promises per claim and what is left.
 *
 * Venue and third-party requirements bind independently of the insurer. A
 * hire agreement, a local authority licence and a supplier contract each impose
 * their own minimum, sometimes above what the union carries. Cover that
 * satisfies the insurer and fails the venue is not cover, so the required
 * figure is the highest binding requirement rather than the policy's own.
 *
 * Every predicate is evaluated as at the *event's* date. A policy in force
 * today expires on 31 August, and an event on 3 September booked in April is
 * uninsured for a reason that was invisible when the booking was made.
 *
 * All money is integer pence. Limits of indemnity are compared, summed and
 * subtracted, and doing that in floating-point pounds produces a shortfall of
 * 0.000000001 on an event that is fully covered.
 */

export type HazardBand = 1 | 2 | 3 | 4 | 5;

export type ActivityCoverStatus =
  | "COVERED"
  | "COVERED_BY_ENDORSEMENT"
  | "COVERED_BY_CONTRACTOR"
  | "ENDORSABLE"
  | "LIMIT_SHORTFALL"
  | "AGGREGATE_SHORTFALL"
  | "EXCLUDED"
  | "UNINSURED";

export type RemedyKind =
  | "NONE"
  | "PURCHASE_ENDORSEMENT"
  | "INCREASE_LIMIT"
  | "OBTAIN_CONTRACTOR_CERTIFICATE"
  | "RENEW_CONTRACTOR_CERTIFICATE"
  | "PLACE_STANDALONE_COVER"
  | "NONE_AVAILABLE";

export interface ActivityClass {
  classId: string;
  name: string;
  /** 1 is benign, 5 is the abseil. Bands above the policy's ceiling cannot be endorsed on. */
  hazardBand: HazardBand;
}

export interface InsurancePolicy {
  policyId: string;
  insurer: string;
  /** Half-open: in force from coverFrom up to but not including coverTo. */
  coverFrom: Date;
  coverTo: Date;
  perClaimLimitPence: number;
  aggregateLimitPence: number;
  /** The highest hazard band the insurer will consider adding by endorsement. */
  maxEndorsableBand: HazardBand;
}

export interface PolicyScheduleItem {
  policyId: string;
  classId: string;
  /** An inner limit for this class. Null means the policy's per-claim limit applies. */
  innerLimitPence: number | null;
}

export interface PolicyExclusion {
  policyId: string;
  classId: string;
  wording: string;
}

export interface PolicyEndorsement {
  endorsementId: string;
  policyId: string;
  classId: string;
  effectiveFrom: Date;
  effectiveTo: Date;
  limitPence: number;
  premiumPence: number;
}

export interface InsuranceClaim {
  claimId: string;
  policyId: string;
  incurredAt: Date;
  amountIncurredPence: number;
}

export interface ContractorCertificate {
  certificateId: string;
  contractorId: string;
  classIds: string[];
  limitPence: number;
  validFrom: Date;
  validTo: Date;
  /** A certificate that does not name the union transfers nothing back. */
  namesUnionAsInterested: boolean;
}

export interface CoverRequirement {
  requirementId: string;
  source: string;
  /** Null applies the requirement to every activity at the event. */
  classId: string | null;
  /** Null applies it at every venue. */
  venueId: string | null;
  minimumCoverPence: number;
  /**
   * When the requirement was imposed and when it stopped applying, half-open.
   * Null at either end means it has always applied, or applies indefinitely. A
   * hire agreement withdrawn last summer must not raise the figure for an event
   * next week, and one starting in September must not raise it for one in June.
   */
  imposedFrom?: Date | null;
  imposedTo?: Date | null;
}

export interface EventActivity {
  activityId: string;
  classId: string;
  /** Set where the activity is delivered by an external supplier. */
  contractorId?: string;
  /** A figure the organiser has been told to carry, over and above any other requirement. */
  statedRequirementPence?: number;
}

export interface InsurableEvent {
  eventId: string;
  name: string;
  eventDate: Date;
  venueId: string;
  activities: EventActivity[];
}

export interface CoverRemedy {
  kind: RemedyKind;
  detail: string;
  /** What closing the gap costs, where that is knowable. */
  costPence: number | null;
}

export interface ActivityDetermination {
  activityId: string;
  classId: string;
  className: string;
  status: ActivityCoverStatus;
  adequate: boolean;
  requiredCoverPence: number;
  availableCoverPence: number;
  shortfallPence: number;
  /** Which requirement set the bar, so an argument about the figure has an answer. */
  bindingRequirement: string;
  remedy: CoverRemedy;
  severity: number;
  reason: string;
}

export interface EventCoverAssessment {
  eventId: string;
  eventDate: Date;
  adequate: boolean;
  policyId: string | null;
  aggregateRemainingPence: number;
  determinations: ActivityDetermination[];
  /** Total cost of the remedies that carry a price. */
  remediationCostPence: number;
  blockingActivityIds: string[];
}

export interface RiskRegisterEntry {
  eventId: string;
  eventName: string;
  eventDate: Date;
  worstStatus: ActivityCoverStatus;
  gapCount: number;
  totalShortfallPence: number;
  severity: number;
}

/**
 * How bad each outcome is. Ranking exists so a committee reads "the abseil is
 * uninsurable" before "the band is four hundred pounds short", which is the
 * order in which those two facts need acting on.
 */
const SEVERITY: Record<ActivityCoverStatus, number> = {
  UNINSURED: 100,
  EXCLUDED: 90,
  AGGREGATE_SHORTFALL: 70,
  LIMIT_SHORTFALL: 60,
  ENDORSABLE: 40,
  COVERED_BY_CONTRACTOR: 10,
  COVERED_BY_ENDORSEMENT: 5,
  COVERED: 0,
};

const ADEQUATE_STATUSES: ReadonlySet<ActivityCoverStatus> = new Set<ActivityCoverStatus>([
  "COVERED",
  "COVERED_BY_ENDORSEMENT",
  "COVERED_BY_CONTRACTOR",
]);

/** Half-open containment: valid from `from` up to but not including `to`. */
function inForce(at: Date, from: Date, to: Date): boolean {
  const t = at.getTime();
  return t >= from.getTime() && t < to.getTime();
}

export class EventInsuranceCoverService {
  private readonly classes = new Map<string, ActivityClass>();
  private readonly policies = new Map<string, InsurancePolicy>();
  private readonly schedule: PolicyScheduleItem[] = [];
  private readonly exclusions: PolicyExclusion[] = [];
  private readonly endorsements: PolicyEndorsement[] = [];
  private readonly claims: InsuranceClaim[] = [];
  private readonly certificates: ContractorCertificate[] = [];
  private readonly requirements: CoverRequirement[] = [];

  registerActivityClass(activityClass: ActivityClass): void {
    this.classes.set(activityClass.classId, activityClass);
  }

  registerPolicy(policy: InsurancePolicy): void {
    if (policy.coverTo.getTime() <= policy.coverFrom.getTime()) {
      throw new Error(`Policy ${policy.policyId} has a period of cover that ends before it starts`);
    }
    this.policies.set(policy.policyId, policy);
  }

  scheduleActivity(item: PolicyScheduleItem): void {
    this.schedule.push(item);
  }

  excludeActivity(exclusion: PolicyExclusion): void {
    this.exclusions.push(exclusion);
  }

  addEndorsement(endorsement: PolicyEndorsement): void {
    this.endorsements.push(endorsement);
  }

  recordClaim(claim: InsuranceClaim): void {
    this.claims.push(claim);
  }

  registerContractorCertificate(certificate: ContractorCertificate): void {
    this.certificates.push(certificate);
  }

  addCoverRequirement(requirement: CoverRequirement): void {
    this.requirements.push(requirement);
  }

  /**
   * The policy covering a given date. Policies are not assumed to be contiguous
   * — the gap between an expiry and a late renewal is a real gap, and an event
   * inside it is uninsured rather than an error.
   */
  policyInForceOn(date: Date): InsurancePolicy | null {
    for (const policy of this.policies.values()) {
      if (inForce(date, policy.coverFrom, policy.coverTo)) return policy;
    }
    return null;
  }

  /**
   * The aggregate limit less everything already incurred inside the policy
   * period up to the date in question. Claims after the event do not erode the
   * cover that was available on the day, and claims from a previous policy year
   * do not erode this one.
   */
  aggregateRemainingOn(policy: InsurancePolicy, date: Date): number {
    let eroded = 0;
    for (const claim of this.claims) {
      if (claim.policyId !== policy.policyId) continue;
      if (!inForce(claim.incurredAt, policy.coverFrom, policy.coverTo)) continue;
      if (claim.incurredAt.getTime() > date.getTime()) continue;
      eroded += claim.amountIncurredPence;
    }
    return Math.max(0, policy.aggregateLimitPence - eroded);
  }

  /**
   * The highest binding minimum for an activity: the organiser's stated figure,
   * the venue's hire condition and any third-party requirement, whichever is
   * greatest. The source is returned with it because the first question asked of
   * a required-cover figure is always where it came from.
   */
  requiredCoverFor(
    activity: EventActivity,
    venueId: string,
    at: Date,
  ): { amountPence: number; source: string } {
    let amountPence = activity.statedRequirementPence ?? 0;
    let source = activity.statedRequirementPence
      ? "organiser's stated requirement"
      : "no stated minimum";

    for (const requirement of this.requirements) {
      const classApplies = requirement.classId === null || requirement.classId === activity.classId;
      const venueApplies = requirement.venueId === null || requirement.venueId === venueId;
      // Every other predicate here is evaluated as at the event date, and a
      // requirement's own validity window is no exception.
      const inForceThen =
        (!requirement.imposedFrom || at.getTime() >= requirement.imposedFrom.getTime()) &&
        (!requirement.imposedTo || at.getTime() < requirement.imposedTo.getTime());
      if (!classApplies || !venueApplies || !inForceThen) continue;
      if (requirement.minimumCoverPence > amountPence) {
        amountPence = requirement.minimumCoverPence;
        source = requirement.source;
      }
    }

    return { amountPence, source };
  }

  private scheduleItemFor(policyId: string, classId: string): PolicyScheduleItem | null {
    return (
      this.schedule.find((item) => item.policyId === policyId && item.classId === classId) ?? null
    );
  }

  private exclusionFor(policyId: string, classId: string): PolicyExclusion | null {
    return (
      this.exclusions.find((item) => item.policyId === policyId && item.classId === classId) ?? null
    );
  }

  private endorsementFor(policyId: string, classId: string, date: Date): PolicyEndorsement | null {
    const applicable = this.endorsements.filter(
      (endorsement) =>
        endorsement.policyId === policyId &&
        endorsement.classId === classId &&
        inForce(date, endorsement.effectiveFrom, endorsement.effectiveTo),
    );
    if (applicable.length === 0) return null;
    // The most generous endorsement in force is the one that responds.
    return applicable.reduce((best, current) =>
      current.limitPence > best.limitPence ? current : best,
    );
  }

  /**
   * A contractor's own cover discharges the risk only where all three of the
   * things that make it worth having are true on the day: in force, at or above
   * the figure required, and naming the union. Two out of three transfers the
   * whole risk back without anybody noticing.
   */
  contractorCoverFor(
    activity: EventActivity,
    date: Date,
    requiredPence: number,
  ): {
    certificate: ContractorCertificate | null;
    status: "OK" | "EXPIRED" | "TOO_LOW" | "NOT_NAMED" | "NONE";
  } {
    if (!activity.contractorId) return { certificate: null, status: "NONE" };

    const held = this.certificates.filter(
      (certificate) =>
        certificate.contractorId === activity.contractorId &&
        certificate.classIds.includes(activity.classId),
    );
    if (held.length === 0) return { certificate: null, status: "NONE" };

    const current = held.filter((certificate) =>
      inForce(date, certificate.validFrom, certificate.validTo),
    );
    if (current.length === 0) return { certificate: held[0], status: "EXPIRED" };

    const named = current.filter((certificate) => certificate.namesUnionAsInterested);
    if (named.length === 0) return { certificate: current[0], status: "NOT_NAMED" };

    const sufficient = named.filter((certificate) => certificate.limitPence >= requiredPence);
    if (sufficient.length === 0) return { certificate: named[0], status: "TOO_LOW" };

    return { certificate: sufficient[0], status: "OK" };
  }

  private assessActivity(
    activity: EventActivity,
    event: InsurableEvent,
    policy: InsurancePolicy | null,
    aggregateRemainingPence: number,
  ): ActivityDetermination {
    const activityClass = this.classes.get(activity.classId);
    const className = activityClass?.name ?? activity.classId;
    const { amountPence: requiredCoverPence, source: bindingRequirement } = this.requiredCoverFor(
      activity,
      event.venueId,
      event.eventDate,
    );

    const contractor = this.contractorCoverFor(activity, event.eventDate, requiredCoverPence);
    const finish = (
      status: ActivityCoverStatus,
      availableCoverPence: number,
      remedy: CoverRemedy,
      reason: string,
    ): ActivityDetermination => ({
      activityId: activity.activityId,
      classId: activity.classId,
      className,
      status,
      adequate: ADEQUATE_STATUSES.has(status),
      requiredCoverPence,
      availableCoverPence,
      shortfallPence: Math.max(0, requiredCoverPence - availableCoverPence),
      bindingRequirement,
      remedy,
      severity: SEVERITY[status],
      reason,
    });

    // Contractor cover is checked first because where it responds, the state of
    // the union's own policy is beside the point.
    if (contractor.status === "OK" && contractor.certificate) {
      return finish(
        "COVERED_BY_CONTRACTOR",
        contractor.certificate.limitPence,
        {
          kind: "NONE",
          detail: `Discharged by ${activity.contractorId}'s own cover`,
          costPence: null,
        },
        `${activity.contractorId} holds cover of ${contractor.certificate.limitPence} pence naming the union`,
      );
    }

    if (!policy) {
      const remedy: CoverRemedy =
        contractor.status === "EXPIRED"
          ? {
              kind: "RENEW_CONTRACTOR_CERTIFICATE",
              detail: `No union policy in force; ${activity.contractorId}'s certificate has expired`,
              costPence: null,
            }
          : {
              kind: "PLACE_STANDALONE_COVER",
              detail: "No policy in force on the event date",
              costPence: null,
            };
      return finish(
        "UNINSURED",
        0,
        remedy,
        `No policy in force on ${event.eventDate.toISOString()}`,
      );
    }

    const exclusion = this.exclusionFor(policy.policyId, activity.classId);
    if (exclusion) {
      // An exclusion is not the end of the argument — a contractor carrying the
      // activity on their own paper is how these events actually go ahead.
      const detail =
        contractor.status === "TOO_LOW"
          ? `${activity.contractorId}'s certificate is below the required limit`
          : contractor.status === "NOT_NAMED"
            ? `${activity.contractorId}'s certificate does not name the union`
            : contractor.status === "EXPIRED"
              ? `${activity.contractorId}'s certificate expired before the event date`
              : "Contractor cover on the supplier's own policy";
      return finish(
        "EXCLUDED",
        0,
        {
          kind:
            contractor.status === "EXPIRED"
              ? "RENEW_CONTRACTOR_CERTIFICATE"
              : "OBTAIN_CONTRACTOR_CERTIFICATE",
          detail,
          costPence: null,
        },
        `Excluded by the policy: ${exclusion.wording}`,
      );
    }

    const scheduled = this.scheduleItemFor(policy.policyId, activity.classId);
    if (!scheduled) {
      const endorsement = this.endorsementFor(policy.policyId, activity.classId, event.eventDate);
      if (endorsement) {
        const available = Math.min(endorsement.limitPence, aggregateRemainingPence);
        if (available >= requiredCoverPence) {
          return finish(
            "COVERED_BY_ENDORSEMENT",
            available,
            { kind: "NONE", detail: `Endorsement ${endorsement.endorsementId}`, costPence: null },
            `Added to the policy by endorsement ${endorsement.endorsementId}`,
          );
        }
        return finish(
          "LIMIT_SHORTFALL",
          available,
          {
            kind: "INCREASE_LIMIT",
            detail: `Endorsement ${endorsement.endorsementId} responds at a limit below the requirement`,
            costPence: null,
          },
          `Endorsed at ${endorsement.limitPence} pence against a requirement of ${requiredCoverPence}`,
        );
      }

      const band = activityClass?.hazardBand ?? 5;
      if (band <= policy.maxEndorsableBand) {
        return finish(
          "ENDORSABLE",
          0,
          {
            kind: "PURCHASE_ENDORSEMENT",
            detail: `${className} is not on the schedule but sits within the insurer's endorsable bands`,
            costPence: null,
          },
          `Not on the policy schedule; hazard band ${band} is within the endorsable ceiling of ${policy.maxEndorsableBand}`,
        );
      }

      return finish(
        "UNINSURED",
        0,
        {
          kind: "PLACE_STANDALONE_COVER",
          detail: `${className} is above the insurer's endorsable ceiling`,
          costPence: null,
        },
        `Hazard band ${band} exceeds the endorsable ceiling of ${policy.maxEndorsableBand}`,
      );
    }

    const perClaimPence = scheduled.innerLimitPence ?? policy.perClaimLimitPence;

    // The aggregate is checked separately from the per-claim limit because the
    // remedies differ: one is a conversation about this event, the other is a
    // conversation about the policy year. An aggregate eroded to nothing is a
    // gap whatever the required figure says — otherwise an activity nobody has
    // set a minimum for comes back COVERED while also reporting that no cover
    // is available, which is the exact failure this check exists to catch.
    if (aggregateRemainingPence < requiredCoverPence || aggregateRemainingPence === 0) {
      return finish(
        "AGGREGATE_SHORTFALL",
        Math.min(perClaimPence, aggregateRemainingPence),
        {
          kind: "INCREASE_LIMIT",
          detail:
            aggregateRemainingPence === 0
              ? "Earlier claims have exhausted the policy aggregate for this policy year"
              : "The policy aggregate has been eroded below the requirement by earlier claims",
          costPence: null,
        },
        `Aggregate remaining ${aggregateRemainingPence} pence against a requirement of ${requiredCoverPence}`,
      );
    }

    if (perClaimPence < requiredCoverPence) {
      return finish(
        "LIMIT_SHORTFALL",
        perClaimPence,
        {
          kind: "INCREASE_LIMIT",
          detail: scheduled.innerLimitPence
            ? `An inner limit of ${scheduled.innerLimitPence} pence applies to ${className}`
            : "The policy's per-claim limit is below the requirement",
          costPence: null,
        },
        `Cover of ${perClaimPence} pence against a requirement of ${requiredCoverPence} from ${bindingRequirement}`,
      );
    }

    return finish(
      "COVERED",
      Math.min(perClaimPence, aggregateRemainingPence),
      { kind: "NONE", detail: "On the policy schedule and within limits", costPence: null },
      `Scheduled at ${perClaimPence} pence`,
    );
  }

  /**
   * The whole question for one event. Every activity is assessed; the event is
   * adequate only if all of them are; and the gaps come back ranked so the
   * uninsurable one is read before the underinsured one.
   */
  assessEvent(event: InsurableEvent): EventCoverAssessment {
    const policy = this.policyInForceOn(event.eventDate);
    const aggregateRemainingPence = policy ? this.aggregateRemainingOn(policy, event.eventDate) : 0;

    const determinations = event.activities
      .map((activity) => this.assessActivity(activity, event, policy, aggregateRemainingPence))
      .sort((a, b) => b.severity - a.severity || b.shortfallPence - a.shortfallPence);

    const remediationCostPence = determinations.reduce(
      (total, determination) => total + (determination.remedy.costPence ?? 0),
      0,
    );

    return {
      eventId: event.eventId,
      eventDate: event.eventDate,
      adequate: determinations.every((determination) => determination.adequate),
      policyId: policy?.policyId ?? null,
      aggregateRemainingPence,
      determinations,
      remediationCostPence,
      blockingActivityIds: determinations
        .filter((determination) => !determination.adequate)
        .map((determination) => determination.activityId),
    };
  }

  /**
   * The same assessment across a diary, reduced to one line per event and
   * ranked. Used for the risk register the trustees ask for once a term and
   * nobody can currently produce.
   */
  sweep(events: InsurableEvent[]): RiskRegisterEntry[] {
    return events
      .map((event) => {
        const assessment = this.assessEvent(event);
        const gaps = assessment.determinations.filter((determination) => !determination.adequate);
        const worst = assessment.determinations[0];
        return {
          eventId: event.eventId,
          eventName: event.name,
          eventDate: event.eventDate,
          worstStatus: worst ? worst.status : ("COVERED" as ActivityCoverStatus),
          gapCount: gaps.length,
          totalShortfallPence: gaps.reduce((total, gap) => total + gap.shortfallPence, 0),
          severity: worst ? worst.severity : 0,
        };
      })
      .filter((entry) => entry.gapCount > 0)
      .sort(
        (a, b) =>
          b.severity - a.severity ||
          a.eventDate.getTime() - b.eventDate.getTime() ||
          b.totalShortfallPence - a.totalShortfallPence,
      );
  }
}
