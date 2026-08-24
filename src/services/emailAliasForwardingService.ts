/**
 * Module: Automated "Graduating Senior" Email Forwarding
 * File: src/services/emailAliasForwardingService.ts
 * Issue: #4425
 *
 * When an officer graduates, external sponsors keep emailing
 * 'president@techclub.campusconnect.edu' long after that student's inbox is
 * gone. This service owns the digital "mail forwarding" handover that runs
 * inside the audit_graduates pass:
 *
 *   1. Detect graduating users who hold an alias that receives external mail
 *      (SendGrid/Mailgun inbound routing backed by `email_alias_routes`).
 *   2. Open an inheritance offer prompting the incoming officer:
 *      "Do you want to inherit the 'president@' alias?"
 *   3. On acceptance, re-map the routing rule so external mail instantly
 *      forwards to the successor's personal inbox — same public address, new
 *      destination — preserving every sponsor thread.
 *
 * The domain logic here is deliberately pure (in-memory state, injected clock
 * and id factory) so the full audit -> offer -> accept lifecycle can be tested
 * without a database or an email-provider account. Persistence lives in the
 * paired SQL migration and the Supabase store layer.
 */

export type EmailProvider = "sendgrid" | "mailgun" | "mock";

export type AliasRouteStatus = "ACTIVE" | "PENDING_HANDOVER" | "RELEASED";

export type OfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";

/**
 * Officer roles whose holders receive mail from people *outside* the club
 * (sponsors, vendors, alumni, other universities). Only these aliases are
 * worth inheriting across a graduation; internal-only roles are skipped.
 */
export const EXTERNAL_MAIL_ROLES: readonly string[] = [
  "President",
  "Vice President",
  "Treasurer",
  "Secretary",
];

/** How long the successor has to answer the inheritance prompt. */
export const OFFER_TTL_DAYS = 14;

export function isExternalMailRole(roleTitle: string): boolean {
  return EXTERNAL_MAIL_ROLES.some(
    (role) => role.toLowerCase() === (roleTitle ?? "").trim().toLowerCase(),
  );
}

/** 'Tech Club' hosting 'president@' -> 'president@techclub.campusconnect.edu'. */
export function aliasAddressForRole(clubName: string, roleTitle: string): string {
  const slug = clubName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
  const local = roleTitle.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${local || "club"}@${slug || "club"}.campusconnect.edu`;
}

function isValidEmail(address: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

export interface AliasRoute {
  aliasId: string;
  clubId: string;
  /** The public address sponsors write to. Never changes across handovers. */
  aliasAddress: string;
  roleTitle: string;
  /** Officer currently responsible for the alias. */
  holderUserId: string | null;
  /** Personal inbox currently receiving the forwarded mail. */
  forwardToInbox: string;
  provider: EmailProvider;
  providerRouteId: string | null;
  status: AliasRouteStatus;
  /** Bumped on every successful re-map; a cheap audit counter. */
  generation: number;
}

export interface GraduatingHolder {
  userId: string;
  clubId: string;
  roleTitle: string;
}

export interface Successor {
  userId: string;
  /** Where the successor wants inherited mail delivered. */
  inboxAddress: string;
}

export interface AliasInheritanceOffer {
  offerId: string;
  aliasId: string;
  aliasAddress: string;
  roleTitle: string;
  clubId: string;
  outgoingHolderUserId: string;
  successorUserId: string;
  status: OfferStatus;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
}

export interface UnstaffedHandover {
  aliasId: string;
  aliasAddress: string;
  roleTitle: string;
  clubId: string;
  outgoingHolderUserId: string;
  reason: "NO_SUCCESSOR_REGISTERED";
}

export interface AuditResult {
  offers: AliasInheritanceOffer[];
  /** Graduating officers held an alias, but nobody is lined up to inherit it. */
  unstaffedHandovers: UnstaffedHandover[];
}

/**
 * The instruction handed to the outbound integration after a re-map. The
 * payloads mirror each provider's real inbound-routing API shape; the mock
 * provider exists so local/dev runs exercise the same code path safely.
 */
export interface ProviderRoutingUpdate {
  provider: EmailProvider;
  /** Remote route id when the provider already knows this rule. */
  providerRouteId: string | null;
  /** Public address being re-routed (unchanged across generations). */
  aliasAddress: string;
  /** New delivery target. */
  forwardToInbox: string;
  action: "UPDATE_ROUTE";
  payload: Record<string, unknown>;
}

interface RegisterRouteInput {
  aliasId?: string;
  clubId: string;
  roleTitle: string;
  aliasAddress?: string;
  clubName?: string;
  holderUserId: string;
  forwardToInbox: string;
  provider?: EmailProvider;
  providerRouteId?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class EmailAliasForwardingService {
  private readonly routes = new Map<string, AliasRoute>();
  private readonly offers = new Map<string, AliasInheritanceOffer>();
  /**
   * Incoming officers registered by the executive-transition flow, keyed by
   * `${clubId}::${normalized role title}`.
   */
  private readonly successors = new Map<string, Successor>();
  /** Optional club archive/advisor inbox used when an alias would otherwise die. */
  private readonly fallbackInboxes = new Map<string, string>();

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly generateId: () => string = () =>
      `alias_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
  ) {}

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerSuccessor(clubId: string, roleTitle: string, successor: Successor): void {
    if (!isValidEmail(successor.inboxAddress)) {
      throw new Error("The successor inbox must be a valid email address.");
    }
    this.successors.set(this.successorKey(clubId, roleTitle), { ...successor });
  }

  registerFallbackInbox(clubId: string, inboxAddress: string): void {
    if (!isValidEmail(inboxAddress)) {
      throw new Error("The fallback inbox must be a valid email address.");
    }
    this.fallbackInboxes.set(clubId, inboxAddress);
  }

  registerRoute(input: RegisterRouteInput): AliasRoute {
    const roleTitle = input.roleTitle.trim();
    const aliasAddress =
      input.aliasAddress ?? aliasAddressForRole(input.clubName ?? input.clubId, roleTitle);

    if (!isValidEmail(aliasAddress)) {
      throw new Error(`Alias '${aliasAddress}' is not a valid address.`);
    }
    for (const existing of this.routes.values()) {
      if (
        existing.aliasAddress.toLowerCase() === aliasAddress.toLowerCase() &&
        existing.status !== "RELEASED"
      ) {
        throw new Error(`Alias '${aliasAddress}' already has an active routing rule.`);
      }
    }

    const route: AliasRoute = {
      aliasId: input.aliasId ?? this.generateId(),
      clubId: input.clubId,
      aliasAddress,
      roleTitle,
      holderUserId: input.holderUserId,
      forwardToInbox: input.forwardToInbox,
      provider: input.provider ?? "mock",
      providerRouteId: input.providerRouteId ?? null,
      status: "ACTIVE",
      generation: 0,
    };
    this.routes.set(route.aliasId, route);
    return { ...route };
  }

  getRoute(aliasId: string): AliasRoute | null {
    const route = this.routes.get(aliasId);
    return route ? { ...route } : null;
  }

  getOffer(offerId: string): AliasInheritanceOffer | null {
    const offer = this.offers.get(offerId);
    return offer ? { ...offer } : null;
  }

  // ---------------------------------------------------------------------------
  // Step 1+2: audit graduating officers and prompt their successors
  // ---------------------------------------------------------------------------

  auditGraduatingHolders(
    graduating: readonly GraduatingHolder[],
    at: Date = this.now(),
  ): AuditResult {
    const offers: AliasInheritanceOffer[] = [];
    const unstaffedHandovers: UnstaffedHandover[] = [];

    for (const graduate of graduating) {
      if (!isExternalMailRole(graduate.roleTitle)) continue;

      const route = [...this.routes.values()].find(
        (candidate) =>
          candidate.clubId === graduate.clubId &&
          candidate.roleTitle.toLowerCase() === graduate.roleTitle.trim().toLowerCase() &&
          candidate.holderUserId === graduate.userId &&
          candidate.status === "ACTIVE",
      );
      if (!route) continue;

      const successor =
        this.successors.get(this.successorKey(graduate.clubId, graduate.roleTitle)) ?? null;

      if (!successor || successor.userId === graduate.userId) {
        // Nobody is lined up (or the graduate "succeeded" themselves). Leave the
        // route forwarding to the outgoing inbox for now and flag it loudly.
        unstaffedHandovers.push({
          aliasId: route.aliasId,
          aliasAddress: route.aliasAddress,
          roleTitle: route.roleTitle,
          clubId: route.clubId,
          outgoingHolderUserId: graduate.userId,
          reason: "NO_SUCCESSOR_REGISTERED",
        });
        continue;
      }

      route.status = "PENDING_HANDOVER";
      const offer: AliasInheritanceOffer = {
        offerId: this.generateId(),
        aliasId: route.aliasId,
        aliasAddress: route.aliasAddress,
        roleTitle: route.roleTitle,
        clubId: route.clubId,
        outgoingHolderUserId: graduate.userId,
        successorUserId: successor.userId,
        status: "PENDING",
        createdAt: at,
        expiresAt: new Date(at.getTime() + OFFER_TTL_DAYS * DAY_MS),
        respondedAt: null,
      };
      this.offers.set(offer.offerId, offer);
      offers.push({ ...offer });
      this.routes.set(route.aliasId, { ...route });
    }

    return { offers, unstaffedHandovers };
  }

  /** Every open prompt addressed to the given incoming officer. */
  pendingOffersForUser(userId: string): AliasInheritanceOffer[] {
    return [...this.offers.values()]
      .filter((offer) => offer.status === "PENDING" && offer.successorUserId === userId)
      .map((offer) => ({ ...offer }));
  }

  // ---------------------------------------------------------------------------
  // Step 3: resolve the prompt
  // ---------------------------------------------------------------------------

  acceptOffer(
    offerId: string,
    responderUserId: string,
    at: Date = this.now(),
  ): { offer: AliasInheritanceOffer; route: AliasRoute; routingUpdate: ProviderRoutingUpdate } {
    const offer = this.requireOpenOffer(offerId, at);
    if (offer.successorUserId !== responderUserId) {
      throw new Error("Only the offered successor may inherit this alias.");
    }
    const route = this.routes.get(offer.aliasId)!;
    const successor = this.successors.get(this.successorKey(route.clubId, route.roleTitle))!;

    // The seamless re-map: same public address, new destination inbox.
    route.holderUserId = successor.userId;
    route.forwardToInbox = successor.inboxAddress;
    route.status = "ACTIVE";
    route.generation += 1;

    offer.status = "ACCEPTED";
    offer.respondedAt = at;

    const result = {
      offer: { ...offer },
      route: { ...route },
      routingUpdate: this.buildRoutingUpdate(route),
    };
    this.routes.set(route.aliasId, { ...route });
    this.offers.set(offer.offerId, { ...offer });
    return result;
  }

  declineOffer(
    offerId: string,
    responderUserId: string,
    at: Date = this.now(),
  ): {
    offer: AliasInheritanceOffer;
    route: AliasRoute;
    routingUpdate: ProviderRoutingUpdate | null;
  } {
    const offer = this.requireOpenOffer(offerId, at);
    if (offer.successorUserId !== responderUserId) {
      throw new Error("Only the offered successor may respond to this inheritance offer.");
    }
    const route = this.routes.get(offer.aliasId)!;

    offer.status = "DECLINED";
    offer.respondedAt = at;

    // A declined alias must not keep pointing at a graduate's dead inbox, and
    // it must not bounce either. Hand it to the club fallback when one exists;
    // otherwise release it explicitly.
    const fallback = this.fallbackInboxes.get(route.clubId) ?? null;
    let routingUpdate: ProviderRoutingUpdate | null = null;
    if (fallback) {
      route.forwardToInbox = fallback;
      route.holderUserId = null;
      route.status = "ACTIVE";
      route.generation += 1;
      routingUpdate = this.buildRoutingUpdate(route);
    } else {
      route.status = "RELEASED";
    }

    const result = { offer: { ...offer }, route: { ...route }, routingUpdate };
    this.routes.set(route.aliasId, { ...route });
    this.offers.set(offer.offerId, { ...offer });
    return result;
  }

  /**
   * Sweep for prompts nobody answered. Expired offers suspend the alias to the
   * club fallback inbox (or release it outright) so sponsor mail never bounces
   * silently against a graduated student's address.
   */
  expireStaleOffers(at: Date = this.now()): AliasInheritanceOffer[] {
    const expired: AliasInheritanceOffer[] = [];
    for (const offer of this.offers.values()) {
      if (offer.status !== "PENDING") continue;
      if (offer.expiresAt.getTime() > at.getTime()) continue;

      offer.status = "EXPIRED";
      offer.respondedAt = at;
      this.offers.set(offer.offerId, { ...offer });
      this.suspendRouteForExpiredOffer(offer);
      expired.push({ ...offer });
    }
    return expired;
  }

  // ---------------------------------------------------------------------------
  // Provider integration
  // ---------------------------------------------------------------------------

  buildRoutingUpdate(route: AliasRoute): ProviderRoutingUpdate {
    switch (route.provider) {
      case "sendgrid":
        // SendGrid Inbound Parse: the host's MX records push mail to the
        // configured URL; changing the target is a PUT on the parse setting.
        return {
          provider: "sendgrid",
          providerRouteId: route.providerRouteId,
          aliasAddress: route.aliasAddress,
          forwardToInbox: route.forwardToInbox,
          action: "UPDATE_ROUTE",
          payload: {
            hostname: route.aliasAddress.split("@")[1],
            url: `https://inbound.campusconnect.edu/forward/${encodeURIComponent(route.forwardToInbox)}`,
            spam_check: true,
          },
        };
      case "mailgun":
        // Mailgun Routes API: match the recipient, forward, stop.
        return {
          provider: "mailgun",
          providerRouteId: route.providerRouteId,
          aliasAddress: route.aliasAddress,
          forwardToInbox: route.forwardToInbox,
          action: "UPDATE_ROUTE",
          payload: {
            priority: 0,
            expression: `match_recipient('${route.aliasAddress}')`,
            action: [`forward('${route.forwardToInbox}')`, "stop()"],
          },
        };
      default:
        return {
          provider: "mock",
          providerRouteId: route.providerRouteId,
          aliasAddress: route.aliasAddress,
          forwardToInbox: route.forwardToInbox,
          action: "UPDATE_ROUTE",
          payload: {
            note: "No provider credentials configured; routing change recorded locally.",
          },
        };
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private requireOpenOffer(offerId: string, at: Date): AliasInheritanceOffer {
    const offer = this.offers.get(offerId);
    if (!offer) throw new Error(`Unknown inheritance offer '${offerId}'.`);
    if (offer.status !== "PENDING") {
      throw new Error(`Offer '${offerId}' was already ${offer.status.toLowerCase()}.`);
    }
    if (offer.expiresAt.getTime() <= at.getTime()) {
      offer.status = "EXPIRED";
      offer.respondedAt = at;
      this.offers.set(offer.offerId, { ...offer });
      this.suspendRouteForExpiredOffer(offer);
      throw new Error(`Offer '${offerId}' expired on ${offer.expiresAt.toISOString()}.`);
    }
    return { ...offer, status: "PENDING" };
  }

  private successorKey(clubId: string, roleTitle: string): string {
    return `${clubId}::${roleTitle.trim().toLowerCase()}`;
  }

  /**
   * Shared expiry outcome: an alias nobody inherited must not keep pointing at
   * a graduate's dying inbox. Forward to the club fallback when one exists,
   * otherwise release the rule so the bounce is at least explicit.
   */
  private suspendRouteForExpiredOffer(offer: AliasInheritanceOffer): void {
    const route = this.routes.get(offer.aliasId);
    if (!route || route.status !== "PENDING_HANDOVER") return;
    const fallback = this.fallbackInboxes.get(route.clubId) ?? null;
    if (fallback) {
      route.forwardToInbox = fallback;
      route.holderUserId = null;
      route.status = "ACTIVE";
      route.generation += 1;
      void this.buildRoutingUpdate(route);
    } else {
      route.status = "RELEASED";
    }
    this.routes.set(route.aliasId, { ...route });
  }
}

// -----------------------------------------------------------------------------
// audit_graduates entry point
// -----------------------------------------------------------------------------

export interface GraduateAliasAuditDeps {
  /** The graduating cohort as reported by the graduation audit query. */
  graduatingHolders: readonly GraduatingHolder[];
  /** Active external-mail aliases for the affected clubs. */
  activeRoutes: readonly AliasRoute[];
  /**
   * Incoming officers from the executive-transition flow, keyed by
   * `${clubId}::${roleTitle.toLowerCase()}`.
   */
  successors?: ReadonlyMap<string, Successor>;
  /** Persist a newly created inheritance offer. */
  persistOffer?: (offer: AliasInheritanceOffer) => Promise<void>;
  /** Deliver the "Do you want to inherit ... ?" prompt to the successor. */
  notifySuccessor?: (offer: AliasInheritanceOffer) => Promise<void>;
}

/**
 * The unit of work the audit_graduates scheduler runs. Pure orchestration over
 * the domain service with all side effects injected, so schedulers can wire
 * Supabase, queues and email delivery without this module knowing about them.
 */
export async function runGraduateAliasAudit(deps: GraduateAliasAuditDeps): Promise<AuditResult> {
  const service = new EmailAliasForwardingService();

  for (const [key, successor] of deps.successors ?? []) {
    const separator = key.indexOf("::");
    if (separator <= 0) {
      console.warn(`[emailAliasForwarding] Skipping malformed successor key '${key}'.`);
      continue;
    }
    service.registerSuccessor(key.slice(0, separator), key.slice(separator + 2), successor);
  }
  for (const route of deps.activeRoutes) {
    // Routes already exist in storage; re-register them under their own ids.
    service.registerRoute({
      aliasId: route.aliasId,
      clubId: route.clubId,
      roleTitle: route.roleTitle,
      aliasAddress: route.aliasAddress,
      holderUserId: route.holderUserId ?? "system",
      forwardToInbox: route.forwardToInbox,
      provider: route.provider,
      providerRouteId: route.providerRouteId,
    });
  }

  const result = service.auditGraduatingHolders(deps.graduatingHolders);

  for (const offer of result.offers) {
    await deps.persistOffer?.(offer);
    await deps.notifySuccessor?.(offer);
  }
  for (const handover of result.unstaffedHandovers) {
    console.warn(
      `[emailAliasForwarding] Alias '${handover.aliasAddress}' (${handover.roleTitle}, ` +
        `club ${handover.clubId}) is graduating without an identified successor.`,
    );
  }

  return result;
}
