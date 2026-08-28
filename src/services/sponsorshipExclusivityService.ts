/**
 * Module: Sponsorship Exclusivity Register
 * File: src/services/sponsorshipExclusivityService.ts
 * Scope: Models brands under corporate parents and categories as a hierarchy,
 *        holds exclusivity grants with an explicit scope, term and strength,
 *        answers whether a proposed grant may be signed, and finds, ranks and
 *        dispositions the conflicts among grants entered after the fact (#5015).
 *
 * Exclusivity is the thing being sold and the thing nobody records. A sponsor
 * pays a premium precisely so that a competitor does not appear, and that
 * promise has a category, a scope and a term. Written into a paragraph of a PDF
 * in the inbox of somebody who graduates in June, it gets breached by a
 * different committee six weeks later, and the breach is discovered by the
 * sponsor, at the event, on a banner.
 *
 * Competitor is a relation, not a name match. Two brands owned by one drinks
 * group share nothing in their names and are competitors of each other for this
 * purpose; a carve-out negotiated against one of them has to extend to the
 * others, or the carve-out is worthless the moment the group re-brands.
 * Detecting either of those by comparing strings finds none of the real cases
 * and flags the false ones.
 *
 * Categories are a hierarchy and exclusivity binds downward. Exclusivity over
 * financial services precludes a retail bank and an insurer; exclusivity over
 * retail banking precludes neither an insurer nor a broker. A flat list forces
 * every deal to be written at one granularity, which means it is written at the
 * wrong one for most of them.
 *
 * Scope is what makes a conflict a conflict. A single event, a club's season, a
 * venue and the whole union are four different products, and two grants collide
 * only where they overlap in scope *and* term *and* category. Treating every
 * grant as union-wide blocks legitimate deals; treating every one as
 * event-local misses the deals that matter.
 *
 * Terms overlap partially, and partially is enough. A season-long grant running
 * to June and a competing one-night deal in March overlap for one night, which
 * is one night more than the promise allowed. Comparing start dates, or asking
 * whether one term contains the other, misses exactly that case. Terms are
 * half-open here, so a grant ending on the day another begins does not collide
 * with it.
 *
 * And not every exclusivity is absolute. First refusal is an obligation to
 * offer rather than a block; "no competitor above tier two" permits the small
 * deals it was written to permit; a named carve-out is the reason a deal was
 * signable in the first place. Collapsed to a boolean, the register either
 * blocks deals it should allow or allows the ones it exists to prevent.
 */

export type ScopeLevel = "EVENT" | "CLUB_SEASON" | "VENUE" | "UNION_WIDE";

export type ExclusivityStrength = "ABSOLUTE" | "ABOVE_TIER" | "FIRST_REFUSAL";

export type ConflictEffect =
  "BLOCK" | "OFFER_REQUIRED" | "PERMITTED_BY_CARVE_OUT" | "PERMITTED_BELOW_TIER";

export type ProposalOutcome = "PERMITTED" | "BLOCKED" | "OFFER_REQUIRED";

export type Disposition = "OUTSTANDING" | "WAIVED_BY_INCUMBENT" | "RELEASED" | "BREACHED";

export interface SponsorBrand {
  brandId: string;
  name: string;
  /** The group that owns it. Null for an independent brand. */
  parentGroupId: string | null;
}

export interface SponsorCategory {
  categoryId: string;
  name: string;
  parentCategoryId: string | null;
}

/** Enough about an event to decide whether a broader scope covers it. */
export interface ScopedEvent {
  eventId: string;
  clubId: string;
  seasonId: string;
  venueId: string;
  startsAt: Date;
}

export interface ExclusivityScope {
  level: ScopeLevel;
  eventId?: string;
  clubId?: string;
  seasonId?: string;
  venueId?: string;
}

export interface ExclusivityGrant {
  grantId: string;
  brandId: string;
  categoryId: string;
  scope: ExclusivityScope;
  /** Half-open: the grant is in force from termFrom up to but not including termTo. */
  termFrom: Date;
  termTo: Date;
  strength: ExclusivityStrength;
  /**
   * For ABOVE_TIER: competitors at this tier or better are blocked, lesser ones
   * are not. Tier 1 is the highest.
   */
  blocksCompetitorsAtOrAboveTier: number | null;
  /** Brands explicitly permitted despite the grant. Extends across a group. */
  carveOutBrandIds: string[];
  /** The tier this grant itself was sold at. */
  tier: number;
  signedAt: Date;
}

export type ProposedGrant = Omit<ExclusivityGrant, "grantId"> & { grantId?: string };

export interface ConflictFinding {
  conflictId: string;
  incumbentGrantId: string;
  /** Null when the finding is about a proposal that has not been signed. */
  challengerGrantId: string | null;
  incumbentBrandId: string;
  challengerBrandId: string;
  effect: ConflictEffect;
  /** Higher is more serious. Used to rank a register-wide sweep. */
  severity: number;
  reasons: string[];
  disposition: Disposition;
}

export interface ProposalDecision {
  outcome: ProposalOutcome;
  permitted: boolean;
  conflicts: ConflictFinding[];
}

const SCOPE_BREADTH: Record<ScopeLevel, number> = {
  EVENT: 1,
  CLUB_SEASON: 2,
  VENUE: 3,
  UNION_WIDE: 4,
};

const STRENGTH_WEIGHT: Record<ExclusivityStrength, number> = {
  FIRST_REFUSAL: 1,
  ABOVE_TIER: 2,
  ABSOLUTE: 3,
};

export class SponsorshipExclusivityService {
  private readonly brands = new Map<string, SponsorBrand>();
  private readonly categories = new Map<string, SponsorCategory>();
  private readonly events = new Map<string, ScopedEvent>();
  private readonly grants = new Map<string, ExclusivityGrant>();
  private readonly dispositions = new Map<string, Disposition>();

  registerBrand(brand: SponsorBrand): void {
    this.brands.set(brand.brandId, { ...brand });
  }

  registerCategory(category: SponsorCategory): void {
    this.categories.set(category.categoryId, { ...category });
  }

  registerEvent(event: ScopedEvent): void {
    this.events.set(event.eventId, { ...event });
  }

  signGrant(grant: ExclusivityGrant): void {
    this.grants.set(grant.grantId, {
      ...grant,
      scope: { ...grant.scope },
      carveOutBrandIds: [...grant.carveOutBrandIds],
    });
  }

  getGrant(grantId: string): ExclusivityGrant | undefined {
    const grant = this.grants.get(grantId);
    return grant ? { ...grant, scope: { ...grant.scope } } : undefined;
  }

  /** The chain from a category up to its root, itself first. */
  private ancestry(categoryId: string): string[] {
    const chain: string[] = [];
    const seen = new Set<string>();
    let current: string | null = categoryId;

    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(current);
      current = this.categories.get(current)?.parentCategoryId ?? null;
    }
    return chain;
  }

  /**
   * Exclusivity binds downward and upward: a grant over financial services
   * precludes a retail bank, and a grant over retail banking is precluded by
   * one over financial services. Siblings do not conflict.
   */
  categoriesConflict(a: string, b: string): boolean {
    if (a === b) return true;
    return this.ancestry(a).includes(b) || this.ancestry(b).includes(a);
  }

  /** Two brands under one corporate parent are one sponsor for carve-out purposes. */
  private sameGroup(a: string, b: string): boolean {
    if (a === b) return true;
    const left = this.brands.get(a);
    const right = this.brands.get(b);
    if (!left?.parentGroupId || !right?.parentGroupId) return false;
    return left.parentGroupId === right.parentGroupId;
  }

  /**
   * Competitor is a relation between distinct brands, resolved without ever
   * looking at a name. Two differently named brands under one drinks group are
   * competitors; a brand is not a competitor of itself.
   */
  isCompetitor(a: string, b: string): boolean {
    return a !== b;
  }

  /** Whether a scope reaches a particular event. */
  private scopeCoversEvent(scope: ExclusivityScope, event: ScopedEvent): boolean {
    switch (scope.level) {
      case "UNION_WIDE":
        return true;
      case "VENUE":
        return scope.venueId === event.venueId;
      case "CLUB_SEASON":
        return scope.clubId === event.clubId && scope.seasonId === event.seasonId;
      case "EVENT":
        return scope.eventId === event.eventId;
      default:
        return false;
    }
  }

  /**
   * Two scopes overlap where a broader one contains the narrower, or where a
   * known event falls inside both. A venue booking and a club's season are not
   * comparable in the abstract; they overlap exactly when the club plays there.
   */
  scopesOverlap(a: ExclusivityScope, b: ExclusivityScope): boolean {
    if (a.level === "UNION_WIDE" || b.level === "UNION_WIDE") return true;

    if (a.level === "EVENT") {
      const event = a.eventId ? this.events.get(a.eventId) : undefined;
      if (!event) return b.level === "EVENT" && a.eventId === b.eventId;
      return this.scopeCoversEvent(b, event);
    }
    if (b.level === "EVENT") return this.scopesOverlap(b, a);

    if (a.level === "VENUE" && b.level === "VENUE") return a.venueId === b.venueId;
    if (a.level === "CLUB_SEASON" && b.level === "CLUB_SEASON") {
      return a.clubId === b.clubId && a.seasonId === b.seasonId;
    }

    // A venue and a club season intersect only through an event that is in both.
    return [...this.events.values()].some(
      (event) => this.scopeCoversEvent(a, event) && this.scopeCoversEvent(b, event),
    );
  }

  /**
   * Genuine interval intersection on half-open terms. A season running to June
   * and a one-night deal in March overlap for one night; a grant ending the day
   * another begins does not overlap it at all.
   */
  termsOverlap(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
    return aFrom.getTime() < bTo.getTime() && bFrom.getTime() < aTo.getTime();
  }

  private conflictIdFor(incumbentGrantId: string, challenger: string): string {
    return [incumbentGrantId, challenger].sort().join("::");
  }

  /**
   * Compare one grant against one incumbent. Returns null where they do not
   * collide at all; otherwise the effect, which is not always a block.
   */
  private assess(
    challenger: ProposedGrant,
    challengerId: string,
    incumbent: ExclusivityGrant,
  ): ConflictFinding | null {
    if (!this.isCompetitor(challenger.brandId, incumbent.brandId)) return null;
    if (!this.categoriesConflict(challenger.categoryId, incumbent.categoryId)) return null;
    if (!this.scopesOverlap(challenger.scope, incumbent.scope)) return null;
    if (
      !this.termsOverlap(
        challenger.termFrom,
        challenger.termTo,
        incumbent.termFrom,
        incumbent.termTo,
      )
    ) {
      return null;
    }

    const reasons = [
      `Category ${challenger.categoryId} conflicts with ${incumbent.categoryId}.`,
      `Scope ${challenger.scope.level} overlaps ${incumbent.scope.level}.`,
      "Terms intersect.",
    ];

    // A carve-out negotiated against one brand of a group covers the others,
    // or it is worthless the moment the group re-brands.
    const carvedOut = incumbent.carveOutBrandIds.some((brandId) =>
      this.sameGroup(brandId, challenger.brandId),
    );

    let effect: ConflictEffect;
    if (carvedOut) {
      effect = "PERMITTED_BY_CARVE_OUT";
      reasons.push("Challenger is named in the incumbent's carve-outs, or shares its group.");
    } else if (incumbent.strength === "FIRST_REFUSAL") {
      // An obligation to offer, not a block.
      effect = "OFFER_REQUIRED";
      reasons.push("Incumbent holds first refusal and must be offered the slot first.");
    } else if (incumbent.strength === "ABOVE_TIER") {
      const threshold = incumbent.blocksCompetitorsAtOrAboveTier;
      if (threshold !== null && challenger.tier > threshold) {
        effect = "PERMITTED_BELOW_TIER";
        reasons.push(
          `Challenger is tier ${challenger.tier}, below the tier ${threshold} the grant protects against.`,
        );
      } else {
        effect = "BLOCK";
        reasons.push(
          `Challenger is tier ${challenger.tier}, at or above the protected tier ${threshold}.`,
        );
      }
    } else {
      effect = "BLOCK";
      reasons.push("Incumbent holds absolute exclusivity.");
    }

    const conflictId = this.conflictIdFor(incumbent.grantId, challengerId);

    return {
      conflictId,
      incumbentGrantId: incumbent.grantId,
      challengerGrantId: this.grants.has(challengerId) ? challengerId : null,
      incumbentBrandId: incumbent.brandId,
      challengerBrandId: challenger.brandId,
      effect,
      severity: STRENGTH_WEIGHT[incumbent.strength] * 10 + SCOPE_BREADTH[incumbent.scope.level],
      reasons,
      disposition: this.dispositions.get(conflictId) ?? "OUTSTANDING",
    };
  }

  /**
   * The question a committee actually asks before it signs: may we do this?
   * Everything in force that touches the proposal comes back with the reason it
   * touches it, whether or not it blocks.
   */
  checkProposed(proposal: ProposedGrant, at: Date): ProposalDecision {
    const challengerId = proposal.grantId ?? "proposed";

    const conflicts = [...this.grants.values()]
      // A grant that has already expired protects nothing.
      .filter((incumbent) => incumbent.termTo.getTime() > at.getTime())
      .filter((incumbent) => incumbent.grantId !== challengerId)
      .map((incumbent) => this.assess(proposal, challengerId, incumbent))
      .filter((finding): finding is ConflictFinding => finding !== null)
      .sort(
        (a, b) => b.severity - a.severity || a.incumbentGrantId.localeCompare(b.incumbentGrantId),
      );

    const blocking = conflicts.filter((finding) => finding.effect === "BLOCK");
    const offers = conflicts.filter((finding) => finding.effect === "OFFER_REQUIRED");

    const outcome: ProposalOutcome =
      blocking.length > 0 ? "BLOCKED" : offers.length > 0 ? "OFFER_REQUIRED" : "PERMITTED";

    return { outcome, permitted: blocking.length === 0, conflicts };
  }

  /**
   * Deals get signed offline and entered late, so the register also has to find
   * the conflicts that already exist. Ranked by how serious the incumbent's
   * promise was, not by when it was noticed.
   */
  sweep(at: Date): ConflictFinding[] {
    const live = [...this.grants.values()].filter((grant) => grant.termTo.getTime() > at.getTime());

    const findings = new Map<string, ConflictFinding>();

    for (const incumbent of live) {
      for (const challenger of live) {
        if (challenger.grantId === incumbent.grantId) continue;
        // The later signature is the challenger; the earlier promise is what
        // was broken.
        if (challenger.signedAt.getTime() < incumbent.signedAt.getTime()) continue;
        if (
          challenger.signedAt.getTime() === incumbent.signedAt.getTime() &&
          challenger.grantId <= incumbent.grantId
        ) {
          continue;
        }

        const finding = this.assess(challenger, challenger.grantId, incumbent);
        if (!finding) continue;
        if (
          finding.effect === "PERMITTED_BY_CARVE_OUT" ||
          finding.effect === "PERMITTED_BELOW_TIER"
        ) {
          continue;
        }
        findings.set(finding.conflictId, finding);
      }
    }

    return [...findings.values()].sort(
      (a, b) => b.severity - a.severity || a.conflictId.localeCompare(b.conflictId),
    );
  }

  /** Record what was done about a conflict. Anything else leaves it outstanding. */
  disposition(conflictId: string, disposition: Exclude<Disposition, "OUTSTANDING">): void {
    this.dispositions.set(conflictId, disposition);
  }

  /** Conflicts nobody has dealt with. An undispositioned conflict is not resolved. */
  outstandingConflicts(at: Date): ConflictFinding[] {
    return this.sweep(at).filter((finding) => finding.disposition === "OUTSTANDING");
  }
}
