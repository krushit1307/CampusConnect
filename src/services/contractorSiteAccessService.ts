/**
 * Module: Contractor Site Access
 * File: src/services/contractorSiteAccessService.ts
 * Scope: Decides whether a contractor may work on site by evaluating their
 *        paperwork against the works window rather than against the moment it
 *        was uploaded (#4923).
 *
 * The paperwork is checked once, at upload, and then never again — but the
 * thing it certifies is not the upload, it is the day of the work. A marquee
 * firm approved in March with employers' liability cover to 30 April turns up
 * on 12 May holding an approval granted on evidence that has since lapsed. The
 * approval is stale in exactly the way that matters and looks identical to a
 * fresh one.
 *
 * Four further gaps this module is built around, each of which passes a
 * present-and-in-date check:
 *
 * A company being approved is not the same as the person at the gate being
 * competent. The firm holds a valid scaffolding licence; the individual who
 * arrives may be an apprentice who is not signed off for it. Approval granted
 * at company level and enforced at company level is not enforced at all.
 *
 * An insurance certificate has a number on it as well as a date. A £1m policy
 * is valid, current, and below the £5m required for work at height. Presence
 * and currency is what gets checked, and it is not what the requirement says.
 *
 * A method statement is written for a specific job, and jobs change. RAMS
 * submitted for "erect marquee, grass, staked" is silently reused when the firm
 * decides on the day to ballast it on the car park instead.
 *
 * Some work stops other work. Hot work in a loading bay and a fuel delivery to
 * the same bay are each individually approved and jointly a bad afternoon.
 * Permits are issued one at a time by whoever is on the desk, and nothing looks
 * at the pair.
 *
 * Money is integer pence throughout. An indemnity shortfall reported from
 * floating-point pounds is a shortfall of £0.00000001.
 */

export type DocumentKind = "RAMS" | "METHOD_STATEMENT" | "PUBLIC_LIABILITY" | "EMPLOYERS_LIABILITY";

export type WorksStatus = "SUBMITTED" | "PERMITTED" | "CANCELLED";

export type PermitStatus = "ISSUED" | "VOIDED";

export type RefusalKind =
  | "NO_ACTIVITIES"
  | "NO_PERSONNEL"
  | "UNKNOWN_ACTIVITY"
  | "UNKNOWN_PERSONNEL"
  | "PERSONNEL_NOT_EMPLOYED_BY_COMPANY"
  | "DOCUMENT_MISSING"
  | "DOCUMENT_NOT_YET_VALID"
  | "DOCUMENT_EXPIRED"
  | "INSUFFICIENT_INDEMNITY"
  | "COMPETENCY_MISSING"
  | "COMPETENCY_EXPIRED"
  | "RAMS_SCOPE_GAP"
  | "PERMIT_CONFLICT";

export type IssueOutcome =
  | "ISSUED"
  | "REFUSED_ACCESS_DENIED"
  | "REFUSED_ALREADY_PERMITTED"
  | "REFUSED_WORKS_CANCELLED"
  | "REFUSED_UNKNOWN_WORKS";

export interface ContractorCompany {
  companyId: string;
  name: string;
}

export interface ContractorPerson {
  personId: string;
  companyId: string;
  name: string;
}

/**
 * A document's validity is a window, not a flag. `validUntil` is exclusive: a
 * certificate expiring on the 30th does not cover work starting on the 30th.
 */
export interface ContractorDocument {
  documentId: string;
  companyId: string;
  kind: DocumentKind;
  reference: string;
  validFrom: Date;
  validUntil: Date;
  /** Set on liability certificates. Integer pence. */
  indemnityLimitPence?: number;
  /**
   * Set on RAMS and method statements: the activity codes the document was
   * written for. A works order carrying an activity outside this set is not
   * covered by the document, however current the document is.
   */
  coversActivities?: string[];
}

/** Competency is per person, per activity, and expires on its own schedule. */
export interface Competency {
  competencyId: string;
  personId: string;
  activityCode: string;
  certificateReference: string;
  validFrom: Date;
  validUntil: Date;
}

export interface ActivityRequirement {
  activityCode: string;
  label: string;
  /** Integer pence of public liability cover the activity demands. */
  requiredIndemnityPence: number;
  requiresRams: boolean;
  /** Competency codes every person on this activity must personally hold. */
  requiredCompetencies: string[];
}

export interface WorksOrder {
  worksId: string;
  companyId: string;
  zoneId: string;
  description: string;
  activityCodes: string[];
  personnelIds: string[];
  windowStart: Date;
  windowEnd: Date;
  status: WorksStatus;
  permitId: string | null;
}

export interface SiteAccessPermit {
  permitId: string;
  worksId: string;
  zoneId: string;
  issuedBy: string;
  issuedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  activityCodes: string[];
  personnelIds: string[];
  status: PermitStatus;
  voidedReason: string | null;
}

export interface Refusal {
  kind: RefusalKind;
  /** The person the refusal is about, where it is about a person. */
  personId: string | null;
  /** The activity the refusal is about, where it is about an activity. */
  activityCode: string | null;
  documentKind: DocumentKind | null;
  /** For an expiry refusal: the instant the evidence stopped covering the work. */
  lapsedAt: Date | null;
  /** For an indemnity refusal: how far short the cover falls, in pence. */
  shortfallPence: number | null;
  /** For a conflict refusal: the permit on the other side of it. */
  conflictingPermitId: string | null;
  detail: string;
}

export interface AccessDecision {
  worksId: string;
  granted: boolean;
  /** Every reason, not the first. A contractor sent away twice sends nobody. */
  refusals: Refusal[];
  evaluatedFrom: Date;
  evaluatedTo: Date;
}

export interface IssueResult {
  outcome: IssueOutcome;
  permitId: string | null;
  decision: AccessDecision | null;
  detail: string;
}

export interface AmendmentResult {
  amended: boolean;
  voidedPermitId: string | null;
  detail: string;
}

export interface ActivityConflict {
  activityA: string;
  activityB: string;
  reason: string;
}

/**
 * Every company sending anybody onto site needs employers' liability cover,
 * regardless of what they are here to do. It is not activity-specific, so it
 * does not live on an activity requirement.
 */
export const REQUIRED_EMPLOYERS_LIABILITY_PENCE = 500_000_000;

function formatPounds(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function windowsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

function conflictKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

export class ContractorSiteAccessService {
  private readonly companies = new Map<string, ContractorCompany>();
  private readonly personnel = new Map<string, ContractorPerson>();
  private readonly documents = new Map<string, ContractorDocument>();
  private readonly competencies = new Map<string, Competency>();
  private readonly activities = new Map<string, ActivityRequirement>();
  private readonly conflicts = new Map<string, ActivityConflict>();
  private readonly works = new Map<string, WorksOrder>();
  private readonly permits = new Map<string, SiteAccessPermit>();

  private permitSequence = 0;

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerCompany(company: ContractorCompany): void {
    this.companies.set(company.companyId, { ...company });
  }

  registerPerson(person: ContractorPerson): void {
    if (!this.companies.has(person.companyId)) {
      throw new Error(`Person ${person.personId} references unknown company ${person.companyId}`);
    }
    this.personnel.set(person.personId, { ...person });
  }

  registerDocument(document: ContractorDocument): void {
    if (!this.companies.has(document.companyId)) {
      throw new Error(`Document ${document.documentId} references unknown company`);
    }
    if (document.validUntil.getTime() <= document.validFrom.getTime()) {
      throw new Error(`Document ${document.documentId} expires at or before it starts`);
    }
    this.documents.set(document.documentId, { ...document });
  }

  registerCompetency(competency: Competency): void {
    if (!this.personnel.has(competency.personId)) {
      throw new Error(`Competency ${competency.competencyId} references unknown person`);
    }
    if (competency.validUntil.getTime() <= competency.validFrom.getTime()) {
      throw new Error(`Competency ${competency.competencyId} expires at or before it starts`);
    }
    this.competencies.set(competency.competencyId, { ...competency });
  }

  registerActivity(activity: ActivityRequirement): void {
    if (activity.requiredIndemnityPence < 0) {
      throw new Error(`Activity ${activity.activityCode} has a negative indemnity requirement`);
    }
    this.activities.set(activity.activityCode, { ...activity });
  }

  /** Declared incompatibility between two activity types. Symmetric by construction. */
  registerActivityConflict(conflict: ActivityConflict): void {
    this.conflicts.set(conflictKey(conflict.activityA, conflict.activityB), { ...conflict });
  }

  submitWorksOrder(input: {
    worksId: string;
    companyId: string;
    zoneId: string;
    description: string;
    activityCodes: string[];
    personnelIds: string[];
    windowStart: Date;
    windowEnd: Date;
  }): WorksOrder {
    if (!this.companies.has(input.companyId)) {
      throw new Error(`Works order ${input.worksId} references unknown company`);
    }
    if (input.windowEnd.getTime() <= input.windowStart.getTime()) {
      throw new Error(`Works order ${input.worksId} ends at or before it starts`);
    }
    const order: WorksOrder = {
      ...input,
      activityCodes: [...input.activityCodes],
      personnelIds: [...input.personnelIds],
      status: "SUBMITTED",
      permitId: null,
    };
    this.works.set(order.worksId, order);
    return {
      ...order,
      activityCodes: [...order.activityCodes],
      personnelIds: [...order.personnelIds],
    };
  }

  getWorksOrder(worksId: string): WorksOrder | null {
    const order = this.works.get(worksId);
    if (!order) return null;
    return {
      ...order,
      activityCodes: [...order.activityCodes],
      personnelIds: [...order.personnelIds],
    };
  }

  getPermit(permitId: string): SiteAccessPermit | null {
    const permit = this.permits.get(permitId);
    if (!permit) return null;
    return {
      ...permit,
      activityCodes: [...permit.activityCodes],
      personnelIds: [...permit.personnelIds],
    };
  }

  // ---------------------------------------------------------------------------
  // Point-in-time predicates
  // ---------------------------------------------------------------------------

  /** Whether a document covers a single instant. `validUntil` is exclusive. */
  isDocumentValidAt(documentId: string, at: Date): boolean {
    const document = this.documents.get(documentId);
    if (!document) return false;
    return (
      at.getTime() >= document.validFrom.getTime() && at.getTime() < document.validUntil.getTime()
    );
  }

  /**
   * Whether a document covers a whole window. This, not the instant form, is
   * what an access decision runs on: a certificate that lapses half-way through
   * a two-day build covers the first day and nothing that gets built on it.
   */
  documentCoversWindow(documentId: string, from: Date, to: Date): boolean {
    const document = this.documents.get(documentId);
    if (!document) return false;
    return (
      document.validFrom.getTime() <= from.getTime() &&
      document.validUntil.getTime() >= to.getTime()
    );
  }

  /** Whether a named individual personally holds a competency at an instant. */
  isCompetentAt(personId: string, competencyCode: string, at: Date): boolean {
    for (const competency of this.competencies.values()) {
      if (competency.personId !== personId) continue;
      if (competency.activityCode !== competencyCode) continue;
      if (
        at.getTime() >= competency.validFrom.getTime() &&
        at.getTime() < competency.validUntil.getTime()
      ) {
        return true;
      }
    }
    return false;
  }

  private competencyFor(personId: string, competencyCode: string): Competency | null {
    let latest: Competency | null = null;
    for (const competency of this.competencies.values()) {
      if (competency.personId !== personId) continue;
      if (competency.activityCode !== competencyCode) continue;
      if (!latest || competency.validUntil.getTime() > latest.validUntil.getTime()) {
        latest = competency;
      }
    }
    return latest;
  }

  private documentsOfKind(companyId: string, kind: DocumentKind): ContractorDocument[] {
    return [...this.documents.values()].filter(
      (document) => document.companyId === companyId && document.kind === kind,
    );
  }

  // ---------------------------------------------------------------------------
  // The access decision
  // ---------------------------------------------------------------------------

  /**
   * Evaluate a works order against the window it will actually happen in.
   *
   * Every refusal is collected rather than returned at the first failure. A
   * contractor turned away for one missing certificate, who then returns and is
   * turned away for a second, stops turning up.
   */
  evaluate(worksId: string): AccessDecision {
    const order = this.works.get(worksId);
    if (!order) {
      throw new Error(`Works order ${worksId} does not exist`);
    }

    const from = order.windowStart;
    const to = order.windowEnd;
    const refusals: Refusal[] = [];

    if (order.activityCodes.length === 0) {
      refusals.push(
        this.refusal("NO_ACTIVITIES", { detail: `Works order ${worksId} describes no activities` }),
      );
    }

    if (order.personnelIds.length === 0) {
      refusals.push(
        this.refusal("NO_PERSONNEL", { detail: `Works order ${worksId} names nobody` }),
      );
    }

    this.checkEmployersLiability(order, from, to, refusals);
    this.checkPersonnel(order, refusals);

    const requirements: ActivityRequirement[] = [];
    for (const code of order.activityCodes) {
      const requirement = this.activities.get(code);
      if (!requirement) {
        refusals.push(
          this.refusal("UNKNOWN_ACTIVITY", {
            activityCode: code,
            detail: `Activity ${code} has no registered requirement, so it cannot be assessed`,
          }),
        );
        continue;
      }
      requirements.push(requirement);
    }

    this.checkPublicLiability(order, requirements, from, to, refusals);
    this.checkRamsScope(order, requirements, from, to, refusals);
    this.checkCompetencies(order, requirements, from, to, refusals);
    this.checkPermitConflicts(order, refusals);

    return {
      worksId,
      granted: refusals.length === 0,
      refusals,
      evaluatedFrom: from,
      evaluatedTo: to,
    };
  }

  /**
   * Documents of a kind that cover the whole works window. A certificate that
   * lapses half-way through a two-day build covers the first day and nothing
   * that gets built on it, so a partial overlap is not cover.
   */
  private coveringDocuments(
    companyId: string,
    kind: DocumentKind,
    from: Date,
    to: Date,
  ): ContractorDocument[] {
    return this.documentsOfKind(companyId, kind).filter((document) =>
      this.documentCoversWindow(document.documentId, from, to),
    );
  }

  /**
   * Why no document of this kind covers the window. "Missing" and "lapsed on
   * the 30th" send a contractor to two different filing cabinets, so they are
   * not collapsed into one refusal.
   */
  private missingOrLapsedRefusal(
    companyId: string,
    kind: DocumentKind,
    from: Date,
    label: string,
  ): Refusal {
    const held = this.documentsOfKind(companyId, kind);
    if (held.length === 0) {
      return this.refusal("DOCUMENT_MISSING", {
        documentKind: kind,
        detail: `${this.companyName(companyId)} holds no ${label}`,
      });
    }

    const best = held.reduce((a, b) => (a.validUntil > b.validUntil ? a : b));
    if (best.validFrom.getTime() > from.getTime()) {
      return this.refusal("DOCUMENT_NOT_YET_VALID", {
        documentKind: kind,
        detail:
          `${label} ${best.reference} does not start until ${best.validFrom.toISOString()}, ` +
          `after the works begin`,
      });
    }

    return this.refusal("DOCUMENT_EXPIRED", {
      documentKind: kind,
      lapsedAt: best.validUntil,
      detail:
        `${label} ${best.reference} does not cover the works window; it lapses at ` +
        `${best.validUntil.toISOString()}`,
    });
  }

  private checkEmployersLiability(
    order: WorksOrder,
    from: Date,
    to: Date,
    refusals: Refusal[],
  ): void {
    const covering = this.coveringDocuments(order.companyId, "EMPLOYERS_LIABILITY", from, to);
    if (covering.length === 0) {
      refusals.push(
        this.missingOrLapsedRefusal(
          order.companyId,
          "EMPLOYERS_LIABILITY",
          from,
          "employers' liability certificate",
        ),
      );
      return;
    }

    // The highest single policy governs. Two £1m policies are not £2m of cover.
    const bestLimit = Math.max(...covering.map((document) => document.indemnityLimitPence ?? 0));
    if (bestLimit < REQUIRED_EMPLOYERS_LIABILITY_PENCE) {
      const shortfall = REQUIRED_EMPLOYERS_LIABILITY_PENCE - bestLimit;
      refusals.push(
        this.refusal("INSUFFICIENT_INDEMNITY", {
          documentKind: "EMPLOYERS_LIABILITY",
          shortfallPence: shortfall,
          detail:
            `Employers' liability cover of ${formatPounds(bestLimit)} is ` +
            `${formatPounds(shortfall)} short of the ` +
            `${formatPounds(REQUIRED_EMPLOYERS_LIABILITY_PENCE)} required`,
        }),
      );
    }
  }

  private checkPublicLiability(
    order: WorksOrder,
    requirements: ActivityRequirement[],
    from: Date,
    to: Date,
    refusals: Refusal[],
  ): void {
    const required = requirements.reduce(
      (highest, requirement) => Math.max(highest, requirement.requiredIndemnityPence),
      0,
    );
    // Work that demands no cover demands no certificate either.
    if (required === 0) return;

    const covering = this.coveringDocuments(order.companyId, "PUBLIC_LIABILITY", from, to);
    if (covering.length === 0) {
      refusals.push(
        this.missingOrLapsedRefusal(
          order.companyId,
          "PUBLIC_LIABILITY",
          from,
          "public liability certificate",
        ),
      );
      return;
    }

    const bestLimit = Math.max(...covering.map((document) => document.indemnityLimitPence ?? 0));
    if (bestLimit < required) {
      const demanding = requirements.find(
        (requirement) => requirement.requiredIndemnityPence === required,
      );
      refusals.push(
        this.refusal("INSUFFICIENT_INDEMNITY", {
          documentKind: "PUBLIC_LIABILITY",
          activityCode: demanding?.activityCode ?? null,
          shortfallPence: required - bestLimit,
          detail:
            `Public liability cover of ${formatPounds(bestLimit)} is ` +
            `${formatPounds(required - bestLimit)} short of the ${formatPounds(required)} ` +
            `required for ${demanding?.label ?? "this work"}`,
        }),
      );
    }
  }

  private checkRamsScope(
    order: WorksOrder,
    requirements: ActivityRequirement[],
    from: Date,
    to: Date,
    refusals: Refusal[],
  ): void {
    const needsRams = requirements.filter((requirement) => requirement.requiresRams);
    if (needsRams.length === 0) return;

    const covering = this.coveringDocuments(order.companyId, "RAMS", from, to);
    if (covering.length === 0) {
      refusals.push(
        this.missingOrLapsedRefusal(
          order.companyId,
          "RAMS",
          from,
          "risk assessment and method statement",
        ),
      );
      return;
    }

    // An approved RAMS is bound to the activities it was written for. Adding an
    // activity to the works order does not extend the document describing it.
    const scoped = new Set<string>();
    for (const document of covering) {
      for (const code of document.coversActivities ?? []) {
        scoped.add(code);
      }
    }

    for (const requirement of needsRams) {
      if (!scoped.has(requirement.activityCode)) {
        refusals.push(
          this.refusal("RAMS_SCOPE_GAP", {
            activityCode: requirement.activityCode,
            documentKind: "RAMS",
            detail:
              `No approved RAMS covers "${requirement.label}"; the works order has drifted ` +
              `outside the method statement it was approved against`,
          }),
        );
      }
    }
  }

  private checkPersonnel(order: WorksOrder, refusals: Refusal[]): void {
    for (const personId of order.personnelIds) {
      const person = this.personnel.get(personId);
      if (!person) {
        refusals.push(
          this.refusal("UNKNOWN_PERSONNEL", {
            personId,
            detail: `${personId} is not a registered contractor operative`,
          }),
        );
        continue;
      }
      if (person.companyId !== order.companyId) {
        refusals.push(
          this.refusal("PERSONNEL_NOT_EMPLOYED_BY_COMPANY", {
            personId,
            detail:
              `${person.name} is employed by ${this.companyName(person.companyId)}, not by ` +
              `${this.companyName(order.companyId)}, and is not covered by their insurance`,
          }),
        );
      }
    }
  }

  private checkCompetencies(
    order: WorksOrder,
    requirements: ActivityRequirement[],
    from: Date,
    to: Date,
    refusals: Refusal[],
  ): void {
    for (const requirement of requirements) {
      for (const competencyCode of requirement.requiredCompetencies) {
        for (const personId of order.personnelIds) {
          if (!this.personnel.has(personId)) continue;

          const held = this.competencyFor(personId, competencyCode);
          if (!held) {
            refusals.push(
              this.refusal("COMPETENCY_MISSING", {
                personId,
                activityCode: requirement.activityCode,
                detail:
                  `${this.personName(personId)} holds no ${competencyCode} competency, ` +
                  `required for ${requirement.label}`,
              }),
            );
            continue;
          }

          if (
            held.validFrom.getTime() > from.getTime() ||
            held.validUntil.getTime() < to.getTime()
          ) {
            refusals.push(
              this.refusal("COMPETENCY_EXPIRED", {
                personId,
                activityCode: requirement.activityCode,
                lapsedAt: held.validUntil,
                detail:
                  `${this.personName(personId)}'s ${competencyCode} certificate ` +
                  `${held.certificateReference} does not cover the works window; it lapses at ` +
                  `${held.validUntil.toISOString()}`,
              }),
            );
          }
        }
      }
    }
  }

  private checkPermitConflicts(order: WorksOrder, refusals: Refusal[]): void {
    for (const permit of this.permits.values()) {
      if (permit.status !== "ISSUED") continue;
      if (permit.worksId === order.worksId) continue;
      if (permit.zoneId !== order.zoneId) continue;
      if (
        !windowsOverlap(order.windowStart, order.windowEnd, permit.windowStart, permit.windowEnd)
      ) {
        continue;
      }

      for (const mine of order.activityCodes) {
        for (const theirs of permit.activityCodes) {
          const conflict = this.conflicts.get(conflictKey(mine, theirs));
          if (!conflict) continue;
          refusals.push(
            this.refusal("PERMIT_CONFLICT", {
              activityCode: mine,
              conflictingPermitId: permit.permitId,
              detail:
                `${mine} conflicts with ${theirs} already permitted in ${order.zoneId} ` +
                `under permit ${permit.permitId}: ${conflict.reason}`,
            }),
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Permits
  // ---------------------------------------------------------------------------

  /**
   * Issue a permit for a works order that passes evaluation. The permit records
   * the activities, personnel and window it was issued against, because that is
   * what every refusal above was computed from.
   */
  issuePermit(worksId: string, issuedBy: string, issuedAt: Date): IssueResult {
    const order = this.works.get(worksId);
    if (!order) {
      return {
        outcome: "REFUSED_UNKNOWN_WORKS",
        permitId: null,
        decision: null,
        detail: `Works order ${worksId} does not exist`,
      };
    }
    if (order.status === "CANCELLED") {
      return {
        outcome: "REFUSED_WORKS_CANCELLED",
        permitId: null,
        decision: null,
        detail: `Works order ${worksId} is cancelled`,
      };
    }
    if (order.status === "PERMITTED") {
      return {
        outcome: "REFUSED_ALREADY_PERMITTED",
        permitId: order.permitId,
        decision: null,
        detail: `Works order ${worksId} already holds permit ${order.permitId}`,
      };
    }

    const decision = this.evaluate(worksId);
    if (!decision.granted) {
      return {
        outcome: "REFUSED_ACCESS_DENIED",
        permitId: null,
        decision,
        detail: `${decision.refusals.length} outstanding refusal(s) on works order ${worksId}`,
      };
    }

    this.permitSequence += 1;
    const permitId = `permit-${this.permitSequence}`;
    this.permits.set(permitId, {
      permitId,
      worksId,
      zoneId: order.zoneId,
      issuedBy,
      issuedAt,
      windowStart: order.windowStart,
      windowEnd: order.windowEnd,
      activityCodes: [...order.activityCodes],
      personnelIds: [...order.personnelIds],
      status: "ISSUED",
      voidedReason: null,
    });

    order.status = "PERMITTED";
    order.permitId = permitId;

    return {
      outcome: "ISSUED",
      permitId,
      decision,
      detail: `Permit ${permitId} issued for ${order.description} by ${issuedBy}`,
    };
  }

  /**
   * Change a works order. A live permit refers to a specific piece of work, by
   * specific people, in a specific window; changing any of the three voids it
   * rather than carrying it across.
   */
  amendWorksOrder(
    worksId: string,
    changes: Partial<
      Pick<WorksOrder, "activityCodes" | "personnelIds" | "windowStart" | "windowEnd" | "zoneId">
    >,
  ): AmendmentResult {
    const order = this.works.get(worksId);
    if (!order) {
      return { amended: false, voidedPermitId: null, detail: `Works order ${worksId} not found` };
    }
    if (order.status === "CANCELLED") {
      return {
        amended: false,
        voidedPermitId: null,
        detail: `Works order ${worksId} is cancelled`,
      };
    }

    if (changes.activityCodes) order.activityCodes = [...changes.activityCodes];
    if (changes.personnelIds) order.personnelIds = [...changes.personnelIds];
    if (changes.windowStart) order.windowStart = changes.windowStart;
    if (changes.windowEnd) order.windowEnd = changes.windowEnd;
    if (changes.zoneId) order.zoneId = changes.zoneId;

    if (order.windowEnd.getTime() <= order.windowStart.getTime()) {
      throw new Error(`Amended works order ${worksId} ends at or before it starts`);
    }

    const voidedPermitId = order.permitId;
    if (voidedPermitId) {
      const permit = this.permits.get(voidedPermitId);
      if (permit) {
        permit.status = "VOIDED";
        permit.voidedReason = "Works order amended after issue";
      }
      order.permitId = null;
      order.status = "SUBMITTED";
    }

    return {
      amended: true,
      voidedPermitId,
      detail: voidedPermitId
        ? `Permit ${voidedPermitId} voided; works order ${worksId} must be re-permitted`
        : `Works order ${worksId} amended`,
    };
  }

  cancelWorksOrder(worksId: string, reason: string): boolean {
    const order = this.works.get(worksId);
    if (!order || order.status === "CANCELLED") return false;
    if (order.permitId) {
      const permit = this.permits.get(order.permitId);
      if (permit) {
        permit.status = "VOIDED";
        permit.voidedReason = reason;
      }
      order.permitId = null;
    }
    order.status = "CANCELLED";
    return true;
  }

  /** Permits live in a zone at an instant. Used by the gate, and by conflict checks. */
  livePermitsInZone(zoneId: string, at: Date): SiteAccessPermit[] {
    return [...this.permits.values()]
      .filter(
        (permit) =>
          permit.status === "ISSUED" &&
          permit.zoneId === zoneId &&
          at.getTime() >= permit.windowStart.getTime() &&
          at.getTime() < permit.windowEnd.getTime(),
      )
      .map((permit) => ({
        ...permit,
        activityCodes: [...permit.activityCodes],
        personnelIds: [...permit.personnelIds],
      }));
  }

  // ---------------------------------------------------------------------------

  private companyName(companyId: string): string {
    return this.companies.get(companyId)?.name ?? companyId;
  }

  private personName(personId: string): string {
    return this.personnel.get(personId)?.name ?? personId;
  }

  private refusal(kind: RefusalKind, fields: Partial<Refusal> & { detail: string }): Refusal {
    return {
      kind,
      personId: fields.personId ?? null,
      activityCode: fields.activityCode ?? null,
      documentKind: fields.documentKind ?? null,
      lapsedAt: fields.lapsedAt ?? null,
      shortfallPence: fields.shortfallPence ?? null,
      conflictingPermitId: fields.conflictingPermitId ?? null,
      detail: fields.detail,
    };
  }
}
