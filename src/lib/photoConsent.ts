/**
 * Photo Consent Registry (#3138).
 *
 * Decides whether a person's likeness may be tagged, published or exported in
 * a given context. Consulted by the auto-tagging pipeline before a face match
 * is written, not after: for someone who has opted out on safeguarding
 * grounds, the tag row existing in the database at all is the harm.
 *
 * Pure and synchronous by design so it can sit directly in the tagging hot
 * path. Consent state is loaded once per batch and passed in; nothing here
 * touches the network. The current time is injected rather than read from the
 * system clock so expiry is exhaustively testable.
 */

export type ConsentScope =
  "INTERNAL_GALLERY" | "PUBLIC_WEBSITE" | "SOCIAL_MEDIA" | "PRESS_MARKETING";

export type ConsentDecision = "GRANTED" | "DENIED";

export type ConsentLevel = "ACCOUNT" | "EVENT";

export type ConsentReason =
  | "WITHDRAWN"
  | "EXPLICIT_DENIAL"
  | "EVENT_GRANT"
  | "ACCOUNT_GRANT"
  | "EXPIRED"
  | "DEFAULT_DENY"
  | "DEFAULT_ALLOW";

export const ALL_SCOPES: ReadonlyArray<ConsentScope> = [
  "INTERNAL_GALLERY",
  "PUBLIC_WEBSITE",
  "SOCIAL_MEDIA",
  "PRESS_MARKETING",
];

/**
 * What an absent record means for each scope.
 *
 * Consent that was never given is not consent, so everything outward-facing
 * defaults to denied. Only the members-only club gallery is permitted by
 * default, and that is the scope a member opts into by joining the club.
 */
export const DEFAULT_WHEN_ABSENT: Record<ConsentScope, ConsentDecision> = {
  INTERNAL_GALLERY: "GRANTED",
  PUBLIC_WEBSITE: "DENIED",
  SOCIAL_MEDIA: "DENIED",
  PRESS_MARKETING: "DENIED",
};

export interface ConsentRecord {
  id: string;
  userId: string;
  scope: ConsentScope;
  decision: ConsentDecision;
  level: ConsentLevel;
  /** Required when level is EVENT. */
  eventId?: string | null;
  recordedAt: string;
  /** Media releases lapse, typically at the end of an academic year. */
  expiresAt?: string | null;
  /** Set when the person has actively withdrawn this consent. */
  withdrawnAt?: string | null;
}

export interface ConsentQuery {
  userId: string;
  scope: ConsentScope;
  eventId?: string;
  /** ISO timestamp used as "now". Injected so expiry is testable. */
  now: string;
}

export interface ConsentEvaluation {
  allowed: boolean;
  reason: ConsentReason;
  /** The record that decided the outcome, when one did. */
  decidedBy: ConsentRecord | null;
  explanation: string;
}

export interface FaceMatch {
  photoId: string;
  userId: string;
  confidence: number;
}

export interface PublishedAsset {
  assetId: string;
  photoId: string;
  userId: string;
  scope: ConsentScope;
  publishedAt: string;
  location: string;
}

export interface RedactionTask {
  assetId: string;
  photoId: string;
  userId: string;
  scope: ConsentScope;
  location: string;
  reason: string;
}

function toTime(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
}

/** A record is live if it has not been withdrawn and has not lapsed. */
function isExpired(record: ConsentRecord, nowMs: number): boolean {
  const expiry = toTime(record.expiresAt);
  return !Number.isNaN(expiry) && expiry <= nowMs;
}

function isWithdrawn(record: ConsentRecord, nowMs: number): boolean {
  const withdrawn = toTime(record.withdrawnAt);
  return !Number.isNaN(withdrawn) && withdrawn <= nowMs;
}

/** Records that apply to this query, ignoring other users, scopes and events. */
export function relevantRecords(records: ConsentRecord[], query: ConsentQuery): ConsentRecord[] {
  return records.filter((record) => {
    if (record.userId !== query.userId) return false;
    if (record.scope !== query.scope) return false;
    if (record.level === "EVENT") {
      return query.eventId !== undefined && record.eventId === query.eventId;
    }
    return true;
  });
}

/**
 * Resolves whether the given use is permitted.
 *
 * Precedence, highest first:
 *   1. A withdrawal always wins, whenever it was recorded.
 *   2. An explicit denial beats a grant at any level.
 *   3. An event-level grant overrides the account-level default.
 *   4. An account-level grant.
 *   5. A lapsed grant resolves as denied, never as the scope default.
 *   6. The scope default.
 */
export function evaluateConsent(records: ConsentRecord[], query: ConsentQuery): ConsentEvaluation {
  const nowMs = toTime(query.now);
  const applicable = relevantRecords(records, query);

  const withdrawn = applicable.find((record) => isWithdrawn(record, nowMs));
  if (withdrawn) {
    return {
      allowed: false,
      reason: "WITHDRAWN",
      decidedBy: withdrawn,
      explanation: `Consent for ${query.scope} was withdrawn on ${withdrawn.withdrawnAt}.`,
    };
  }

  const denial = applicable.find((record) => record.decision === "DENIED");
  if (denial) {
    return {
      allowed: false,
      reason: "EXPLICIT_DENIAL",
      decidedBy: denial,
      explanation: `${query.userId} has explicitly denied ${query.scope} at ${denial.level.toLowerCase()} level.`,
    };
  }

  const liveGrants = applicable.filter(
    (record) => record.decision === "GRANTED" && !isExpired(record, nowMs),
  );

  const eventGrant = liveGrants.find((record) => record.level === "EVENT");
  if (eventGrant) {
    return {
      allowed: true,
      reason: "EVENT_GRANT",
      decidedBy: eventGrant,
      explanation: `Granted for this event specifically.`,
    };
  }

  const accountGrant = liveGrants.find((record) => record.level === "ACCOUNT");
  if (accountGrant) {
    return {
      allowed: true,
      reason: "ACCOUNT_GRANT",
      decidedBy: accountGrant,
      explanation: `Granted at account level for ${query.scope}.`,
    };
  }

  // A grant that has lapsed must not silently fall back to a permissive
  // default; an expired media release is the same as no release.
  const lapsed = applicable.find(
    (record) => record.decision === "GRANTED" && isExpired(record, nowMs),
  );
  if (lapsed) {
    return {
      allowed: false,
      reason: "EXPIRED",
      decidedBy: lapsed,
      explanation: `The media release for ${query.scope} lapsed on ${lapsed.expiresAt}.`,
    };
  }

  const fallback = DEFAULT_WHEN_ABSENT[query.scope];
  return {
    allowed: fallback === "GRANTED",
    reason: fallback === "GRANTED" ? "DEFAULT_ALLOW" : "DEFAULT_DENY",
    decidedBy: null,
    explanation:
      fallback === "GRANTED"
        ? `No record found; ${query.scope} is permitted by default.`
        : `No record found; ${query.scope} requires explicit consent.`,
  };
}

/** Evaluates every scope at once, for rendering a person's consent settings. */
export function evaluateAllScopes(
  records: ConsentRecord[],
  userId: string,
  now: string,
  eventId?: string,
): Record<ConsentScope, ConsentEvaluation> {
  const result = {} as Record<ConsentScope, ConsentEvaluation>;

  for (const scope of ALL_SCOPES) {
    result[scope] = evaluateConsent(records, { userId, scope, eventId, now });
  }

  return result;
}

/**
 * Gate for the auto-tagging pipeline. Face matches for people who have not
 * consented to this scope are dropped before any tag row is written.
 */
export function filterTaggableMatches(
  matches: FaceMatch[],
  records: ConsentRecord[],
  scope: ConsentScope,
  now: string,
  eventId?: string,
): { taggable: FaceMatch[]; suppressed: Array<{ match: FaceMatch; reason: ConsentReason }> } {
  const taggable: FaceMatch[] = [];
  const suppressed: Array<{ match: FaceMatch; reason: ConsentReason }> = [];

  for (const match of matches) {
    const evaluation = evaluateConsent(records, {
      userId: match.userId,
      scope,
      eventId,
      now,
    });

    if (evaluation.allowed) {
      taggable.push(match);
    } else {
      suppressed.push({ match, reason: evaluation.reason });
    }
  }

  return { taggable, suppressed };
}

/**
 * Applies a withdrawal and returns the work it creates.
 *
 * Withdrawal is not just a flag: anything already published under the
 * withdrawn scope now needs redacting, and that obligation has to be visible
 * rather than silently accruing.
 */
export function withdrawConsent(
  records: ConsentRecord[],
  publishedAssets: PublishedAsset[],
  params: { userId: string; scope: ConsentScope; withdrawnAt: string; eventId?: string },
): { records: ConsentRecord[]; redactions: RedactionTask[] } {
  const updated = records.map((record) => {
    const matchesScope = record.userId === params.userId && record.scope === params.scope;
    const matchesEvent =
      params.eventId === undefined ||
      record.level === "ACCOUNT" ||
      record.eventId === params.eventId;

    if (matchesScope && matchesEvent && !record.withdrawnAt) {
      return { ...record, withdrawnAt: params.withdrawnAt };
    }
    return record;
  });

  const redactions: RedactionTask[] = publishedAssets
    .filter((asset) => asset.userId === params.userId && asset.scope === params.scope)
    .map((asset) => ({
      assetId: asset.assetId,
      photoId: asset.photoId,
      userId: asset.userId,
      scope: asset.scope,
      location: asset.location,
      reason: `Consent for ${asset.scope} withdrawn on ${params.withdrawnAt}.`,
    }))
    .sort((a, b) => a.assetId.localeCompare(b.assetId));

  return { records: updated, redactions };
}

/**
 * Media releases due to lapse within the given window, so students can be
 * asked to renew before their photos silently drop out of use.
 */
export function findExpiringConsents(
  records: ConsentRecord[],
  now: string,
  withinDays = 30,
): ConsentRecord[] {
  const nowMs = toTime(now);
  const horizon = nowMs + withinDays * 86_400_000;

  return records
    .filter((record) => {
      if (record.decision !== "GRANTED") return false;
      if (isWithdrawn(record, nowMs)) return false;

      const expiry = toTime(record.expiresAt);
      return !Number.isNaN(expiry) && expiry > nowMs && expiry <= horizon;
    })
    .sort((a, b) => toTime(a.expiresAt) - toTime(b.expiresAt) || a.id.localeCompare(b.id));
}

/**
 * Whether a published asset was covered by consent at the moment it was
 * published. This is the question that matters if a decision is ever
 * challenged: not what we believe now, but what we believed then.
 */
export function wasPublicationCovered(
  records: ConsentRecord[],
  asset: PublishedAsset,
): ConsentEvaluation {
  // Records created after publication cannot retroactively justify it.
  const knownAtPublication = records.filter(
    (record) => toTime(record.recordedAt) <= toTime(asset.publishedAt),
  );

  return evaluateConsent(knownAtPublication, {
    userId: asset.userId,
    scope: asset.scope,
    now: asset.publishedAt,
  });
}
