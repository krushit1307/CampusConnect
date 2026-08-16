/**
 * Attendee Accessibility Accommodation Requests (#3396).
 *
 * The venue side of accessibility already exists: `accessibility_features` on
 * `venues` records what a room has, and `accessibilityFeaturesSchema` in
 * `eventUtils.ts` makes organisers fill it in. This module covers the other
 * half — what a specific person needs, and whether there is still time to
 * arrange it.
 *
 * The distinction matters because a hearing loop in the ceiling does not book
 * an ASL interpreter, and an interpreter cannot be booked the day before.
 * Campus disability services work to a lead time measured in business days,
 * so a request submitted on Friday afternoon for a Monday event has one day of
 * runway rather than three. Getting that wrong means telling a student their
 * request is fine when it is already too late.
 *
 * Everything here is pure and synchronous with the clock injected, so the
 * business-day arithmetic around weekends and campus holidays is exhaustively
 * testable without a database.
 */

export type AccommodationType =
  | "ASL_INTERPRETER"
  | "CART_CAPTIONING"
  | "ASSISTIVE_LISTENING"
  | "WHEELCHAIR_SEATING"
  | "COMPANION_SEAT"
  | "PERSONAL_AIDE"
  | "SERVICE_ANIMAL"
  | "QUIET_ROOM"
  | "LARGE_PRINT_MATERIALS"
  | "DIETARY_MEDICAL";

/** Who actually has to do the work. Routing is per accommodation, not per event. */
export type Fulfiller = "DISABILITY_SERVICES" | "VENUE" | "ORGANISER";

export type FeasibilityStatus =
  /** Requested with the full lead time available. */
  | "FEASIBLE"
  /** Inside the lead time but not impossible; worth escalating by hand. */
  | "AT_RISK"
  /** Past the point where the fulfiller can source it. */
  | "MISSED_DEADLINE"
  /** The room already provides this; no procurement needed. */
  | "SATISFIED_BY_VENUE"
  /** The room cannot host this request at all; this is a venue change. */
  | "VENUE_INCOMPATIBLE"
  /** Fulfillable in principle, but the venue's supply is exhausted. */
  | "OVER_CAPACITY";

export type RequestState = "SUBMITTED" | "ACKNOWLEDGED" | "ARRANGED" | "DECLINED" | "WITHDRAWN";

/** Keys mirror `venues.accessibility_features` from the accessibility audit migration. */
export type VenueFeatureKey =
  | "has_elevator"
  | "wheelchair_ramp"
  | "gender_neutral_restrooms"
  | "hearing_loop"
  | "low_sensory_zone";

/** The finite things a venue has a fixed number of. */
export type FiniteResource = "WHEELCHAIR_SPACE" | "COMPANION_SEAT" | "QUIET_ROOM_PLACE";

export interface AccommodationSpec {
  type: AccommodationType;
  label: string;
  fulfiller: Fulfiller;
  /**
   * Business days of notice the fulfiller needs. Business days rather than
   * calendar days because the offices that source these are shut at weekends.
   */
  leadTimeBusinessDays: number;
  /**
   * How far inside the lead time a request can still land and be worth
   * chasing. Below this it is genuinely unfulfillable and saying so honestly
   * is better than an acknowledgement that goes nowhere.
   */
  atRiskGraceBusinessDays: number;
  /** A venue feature that makes procurement unnecessary. */
  satisfiedByVenueFeature?: VenueFeatureKey;
  /** A venue feature without which the request cannot be met in that room. */
  requiresVenueFeature?: VenueFeatureKey;
  /** The finite venue resource this request consumes, if any. */
  consumes?: FiniteResource;
  /** How many units of that resource a single request takes. */
  consumesUnits?: number;
}

export const ACCOMMODATION_SPECS: Record<AccommodationType, AccommodationSpec> = {
  ASL_INTERPRETER: {
    type: "ASL_INTERPRETER",
    label: "ASL interpreter",
    fulfiller: "DISABILITY_SERVICES",
    // Agency interpreters are booked out; ten days is the usual ask and five
    // is the point past which availability is luck rather than planning.
    leadTimeBusinessDays: 10,
    atRiskGraceBusinessDays: 5,
  },
  CART_CAPTIONING: {
    type: "CART_CAPTIONING",
    label: "CART live captioning",
    fulfiller: "DISABILITY_SERVICES",
    leadTimeBusinessDays: 7,
    atRiskGraceBusinessDays: 4,
  },
  ASSISTIVE_LISTENING: {
    type: "ASSISTIVE_LISTENING",
    label: "Assistive listening device",
    fulfiller: "VENUE",
    leadTimeBusinessDays: 3,
    atRiskGraceBusinessDays: 2,
    satisfiedByVenueFeature: "hearing_loop",
  },
  WHEELCHAIR_SEATING: {
    type: "WHEELCHAIR_SEATING",
    label: "Wheelchair seating space",
    fulfiller: "VENUE",
    leadTimeBusinessDays: 2,
    atRiskGraceBusinessDays: 1,
    requiresVenueFeature: "wheelchair_ramp",
    consumes: "WHEELCHAIR_SPACE",
    consumesUnits: 1,
  },
  COMPANION_SEAT: {
    type: "COMPANION_SEAT",
    label: "Companion seat",
    fulfiller: "VENUE",
    leadTimeBusinessDays: 2,
    atRiskGraceBusinessDays: 1,
    consumes: "COMPANION_SEAT",
    consumesUnits: 1,
  },
  PERSONAL_AIDE: {
    type: "PERSONAL_AIDE",
    label: "Personal aide admission",
    fulfiller: "ORGANISER",
    leadTimeBusinessDays: 3,
    atRiskGraceBusinessDays: 2,
  },
  SERVICE_ANIMAL: {
    type: "SERVICE_ANIMAL",
    label: "Service animal accommodation",
    fulfiller: "ORGANISER",
    // Legally admissible without notice; the lead time is only so the
    // organiser can arrange a relief area and warn caterers about allergens.
    leadTimeBusinessDays: 1,
    atRiskGraceBusinessDays: 1,
  },
  QUIET_ROOM: {
    type: "QUIET_ROOM",
    label: "Quiet / low-sensory room",
    fulfiller: "VENUE",
    leadTimeBusinessDays: 3,
    atRiskGraceBusinessDays: 2,
    satisfiedByVenueFeature: "low_sensory_zone",
    consumes: "QUIET_ROOM_PLACE",
    consumesUnits: 1,
  },
  LARGE_PRINT_MATERIALS: {
    type: "LARGE_PRINT_MATERIALS",
    label: "Large print / braille materials",
    fulfiller: "ORGANISER",
    leadTimeBusinessDays: 5,
    atRiskGraceBusinessDays: 2,
  },
  DIETARY_MEDICAL: {
    type: "DIETARY_MEDICAL",
    label: "Medically required dietary accommodation",
    fulfiller: "ORGANISER",
    leadTimeBusinessDays: 5,
    atRiskGraceBusinessDays: 3,
  },
};

export const ALL_ACCOMMODATION_TYPES: ReadonlyArray<AccommodationType> = Object.keys(
  ACCOMMODATION_SPECS,
) as AccommodationType[];

export interface AccommodationRequest {
  id: string;
  eventId: string;
  requesterId: string;
  type: AccommodationType;
  submittedAt: string;
  state: RequestState;
  /** Set when this was generated from a standing accommodation rather than asked for. */
  fromStandingId?: string | null;
  /** Free-text detail for the fulfilling office only. Never shown to organisers. */
  privateNote?: string | null;
}

/**
 * An accommodation a student has on file with disability services, which
 * applies to every event rather than being re-requested each time.
 */
export interface StandingAccommodation {
  id: string;
  userId: string;
  type: AccommodationType;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  privateNote?: string | null;
}

export interface VenueCapability {
  venueId: string;
  features: Partial<Record<VenueFeatureKey, boolean>>;
  /** Fixed counts. An absent entry means the venue has none of that resource. */
  resources: Partial<Record<FiniteResource, number>>;
}

export interface EvaluationContext {
  eventId: string;
  /** ISO timestamp the event begins. Lead time is counted back from here. */
  eventStart: string;
  /** ISO timestamp used as "now". Injected so deadlines are testable. */
  now: string;
  venue: VenueCapability;
  /** Campus holidays, as YYYY-MM-DD. Excluded from business-day counts. */
  holidays?: ReadonlyArray<string>;
}

export interface RequestEvaluation {
  request: AccommodationRequest;
  status: FeasibilityStatus;
  fulfiller: Fulfiller;
  /** Business days between now and the event start. Negative once it has begun. */
  businessDaysRemaining: number;
  requiredLeadTimeBusinessDays: number;
  /** True when the organiser has to act rather than simply wait. */
  needsOrganiserAction: boolean;
  explanation: string;
}

const MS_PER_DAY = 86_400_000;

function toTime(iso: string): number {
  return new Date(iso).getTime();
}

/** YYYY-MM-DD in UTC, which is the granularity holidays are expressed at. */
export function toDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Business days strictly between two instants, excluding weekends and campus
 * holidays.
 *
 * The start day is not counted: a request submitted at 16:00 on Monday has not
 * given the office Monday. Returns a negative count once the deadline has
 * passed, so callers can report how far over they are rather than just that
 * they are over.
 */
export function businessDaysBetween(
  fromIso: string,
  toIso: string,
  holidays: ReadonlyArray<string> = [],
): number {
  const from = toTime(fromIso);
  const to = toTime(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;

  const holidaySet = new Set(holidays);
  const backwards = to < from;
  const start = backwards ? to : from;
  const end = backwards ? from : to;

  // Walk whole UTC days from the day after the start up to and including the
  // end day. Partial days at either edge are deliberately not credited.
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  let count = 0;
  while (cursor.getTime() <= end) {
    if (!isWeekend(cursor) && !holidaySet.has(cursor.toISOString().slice(0, 10))) {
      count += 1;
    }
    cursor.setTime(cursor.getTime() + MS_PER_DAY);
  }

  return backwards ? -count : count;
}

/**
 * The last instant a request of this type can be submitted and still clear its
 * full lead time. Exposed so a request form can show the deadline before the
 * student has typed anything.
 */
export function deadlineForType(
  type: AccommodationType,
  eventStart: string,
  holidays: ReadonlyArray<string> = [],
): string {
  const spec = ACCOMMODATION_SPECS[type];
  const holidaySet = new Set(holidays);
  const cursor = new Date(toTime(eventStart));
  cursor.setUTCHours(0, 0, 0, 0);

  let remaining = spec.leadTimeBusinessDays;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!isWeekend(cursor) && !holidaySet.has(cursor.toISOString().slice(0, 10))) {
      remaining -= 1;
    }
  }

  return cursor.toISOString();
}

function leadTimeStatus(
  spec: AccommodationSpec,
  businessDaysRemaining: number,
): "FEASIBLE" | "AT_RISK" | "MISSED_DEADLINE" {
  if (businessDaysRemaining >= spec.leadTimeBusinessDays) return "FEASIBLE";
  if (businessDaysRemaining >= spec.atRiskGraceBusinessDays) return "AT_RISK";
  return "MISSED_DEADLINE";
}

/**
 * Evaluates one request against the venue and the clock, ignoring contention
 * with other requests. Capacity is resolved by `evaluateRequests`, which is
 * the only place that can see the whole queue.
 */
export function evaluateRequest(
  request: AccommodationRequest,
  context: EvaluationContext,
): RequestEvaluation {
  const spec = ACCOMMODATION_SPECS[request.type];
  const holidays = context.holidays ?? [];
  const businessDaysRemaining = businessDaysBetween(context.now, context.eventStart, holidays);

  const base = {
    request,
    fulfiller: spec.fulfiller,
    businessDaysRemaining,
    requiredLeadTimeBusinessDays: spec.leadTimeBusinessDays,
  };

  // A room that cannot host the request is a venue problem, and no amount of
  // lead time fixes it. Saying so first is the whole value of the check.
  if (spec.requiresVenueFeature && context.venue.features[spec.requiresVenueFeature] !== true) {
    return {
      ...base,
      status: "VENUE_INCOMPATIBLE",
      needsOrganiserAction: true,
      explanation:
        `${spec.label} cannot be provided at this venue: it has no ` +
        `${spec.requiresVenueFeature.replace(/_/g, " ")}. This needs a venue change, not a booking.`,
    };
  }

  // The room already does it. Procurement would be duplicated effort and an
  // unnecessary disclosure to a third party.
  if (
    spec.satisfiedByVenueFeature &&
    context.venue.features[spec.satisfiedByVenueFeature] === true
  ) {
    return {
      ...base,
      status: "SATISFIED_BY_VENUE",
      needsOrganiserAction: false,
      explanation: `${spec.label} is already provided by the venue; nothing to arrange.`,
    };
  }

  const status = leadTimeStatus(spec, businessDaysRemaining);

  if (status === "MISSED_DEADLINE") {
    return {
      ...base,
      status,
      needsOrganiserAction: true,
      explanation:
        `${spec.label} needs ${spec.leadTimeBusinessDays} business days' notice and there ` +
        `${businessDaysRemaining === 1 ? "is" : "are"} ${businessDaysRemaining}. ` +
        `${spec.fulfiller === "DISABILITY_SERVICES" ? "Disability services" : "The fulfiller"} ` +
        `cannot source this in time.`,
    };
  }

  if (status === "AT_RISK") {
    return {
      ...base,
      status,
      needsOrganiserAction: true,
      explanation:
        `${spec.label} is inside its ${spec.leadTimeBusinessDays}-business-day lead time ` +
        `(${businessDaysRemaining} remaining). Escalate by hand rather than waiting in the queue.`,
    };
  }

  return {
    ...base,
    status,
    needsOrganiserAction: spec.fulfiller === "ORGANISER",
    explanation: `${spec.label} can be arranged; ${businessDaysRemaining} business days remain.`,
  };
}

/**
 * Evaluates a whole queue, resolving contention for finite venue resources.
 *
 * Requests are allocated in submission order, ties broken by id so the result
 * is deterministic. Requests that would exceed the venue's supply are reported
 * as OVER_CAPACITY rather than left pending, because "we have ten wheelchair
 * spaces and eleven requests" is a decision somebody has to make now.
 */
export function evaluateRequests(
  requests: AccommodationRequest[],
  context: EvaluationContext,
): RequestEvaluation[] {
  const ordered = [...requests].sort(
    (a, b) => toTime(a.submittedAt) - toTime(b.submittedAt) || a.id.localeCompare(b.id),
  );

  const consumed: Partial<Record<FiniteResource, number>> = {};

  return ordered.map((request) => {
    const evaluation = evaluateRequest(request, context);
    const spec = ACCOMMODATION_SPECS[request.type];

    // Withdrawn and declined requests hold nothing, and a request the venue
    // cannot host was never going to occupy one of its spaces.
    const holdsResource =
      spec.consumes !== undefined &&
      request.state !== "WITHDRAWN" &&
      request.state !== "DECLINED" &&
      evaluation.status !== "VENUE_INCOMPATIBLE" &&
      evaluation.status !== "SATISFIED_BY_VENUE";

    if (!holdsResource || !spec.consumes) return evaluation;

    const units = spec.consumesUnits ?? 1;
    const supply = context.venue.resources[spec.consumes] ?? 0;
    const alreadyTaken = consumed[spec.consumes] ?? 0;

    if (alreadyTaken + units > supply) {
      return {
        ...evaluation,
        status: "OVER_CAPACITY",
        needsOrganiserAction: true,
        explanation:
          `${spec.label}: the venue has ${supply} and ${alreadyTaken} ` +
          `${alreadyTaken === 1 ? "is" : "are"} already allocated. This request cannot be seated here.`,
      };
    }

    consumed[spec.consumes] = alreadyTaken + units;
    return evaluation;
  });
}

/**
 * Turns standing accommodations into per-event requests.
 *
 * A student registered with disability services should not have to re-declare
 * a permanent need for every event they attend. An explicit request already on
 * file wins, so expanding a standing accommodation never double-books the
 * resource.
 */
export function expandStandingAccommodations(
  standing: StandingAccommodation[],
  attendeeIds: ReadonlyArray<string>,
  context: EvaluationContext,
  existing: AccommodationRequest[] = [],
): AccommodationRequest[] {
  const attending = new Set(attendeeIds);
  const alreadyRequested = new Set(
    existing
      .filter((r) => r.eventId === context.eventId && r.state !== "WITHDRAWN")
      .map((r) => `${r.requesterId}::${r.type}`),
  );

  const eventStartMs = toTime(context.eventStart);

  return standing
    .filter((entry) => {
      if (!attending.has(entry.userId)) return false;
      if (alreadyRequested.has(`${entry.userId}::${entry.type}`)) return false;

      // The accommodation has to be in force on the day of the event, not on
      // the day the expansion happens to run.
      if (toTime(entry.effectiveFrom) > eventStartMs) return false;
      if (entry.effectiveUntil && toTime(entry.effectiveUntil) < eventStartMs) return false;

      return true;
    })
    .sort((a, b) => a.userId.localeCompare(b.userId) || a.type.localeCompare(b.type))
    .map((entry) => ({
      id: `auto_${entry.id}_${context.eventId}`,
      eventId: context.eventId,
      requesterId: entry.userId,
      type: entry.type,
      submittedAt: context.now,
      state: "SUBMITTED" as RequestState,
      fromStandingId: entry.id,
      privateNote: entry.privateNote ?? null,
    }));
}

export interface FulfilmentLine {
  type: AccommodationType;
  label: string;
  fulfiller: Fulfiller;
  count: number;
  statuses: Record<string, number>;
  needsAttention: boolean;
}

/**
 * The organiser-facing view: what has to be arranged, and how many of it.
 *
 * Deliberately carries no requester identity and no private note. An organiser
 * needs to book two interpreters; they do not need to know which two students
 * are deaf, and a student should not have to disclose that to a peer in order
 * to attend an event.
 */
export function buildFulfilmentSummary(evaluations: RequestEvaluation[]): FulfilmentLine[] {
  const lines = new Map<AccommodationType, FulfilmentLine>();

  for (const evaluation of evaluations) {
    if (evaluation.request.state === "WITHDRAWN") continue;

    const spec = ACCOMMODATION_SPECS[evaluation.request.type];
    const existing = lines.get(spec.type) ?? {
      type: spec.type,
      label: spec.label,
      fulfiller: spec.fulfiller,
      count: 0,
      statuses: {},
      needsAttention: false,
    };

    existing.count += 1;
    existing.statuses[evaluation.status] = (existing.statuses[evaluation.status] ?? 0) + 1;
    existing.needsAttention = existing.needsAttention || evaluation.needsOrganiserAction;
    lines.set(spec.type, existing);
  }

  return [...lines.values()].sort((a, b) => a.type.localeCompare(b.type));
}

export interface IdentifiedLine {
  requestId: string;
  requesterId: string;
  type: AccommodationType;
  status: FeasibilityStatus;
  privateNote: string | null;
}

/**
 * The identified view, for the fulfilling office only.
 *
 * Separated from the summary above so that the privacy boundary is a function
 * call rather than a convention somebody has to remember at the call site.
 */
export function buildIdentifiedManifest(
  evaluations: RequestEvaluation[],
  fulfiller: Fulfiller,
): IdentifiedLine[] {
  return evaluations
    .filter((evaluation) => evaluation.fulfiller === fulfiller)
    .filter((evaluation) => evaluation.request.state !== "WITHDRAWN")
    .map((evaluation) => ({
      requestId: evaluation.request.id,
      requesterId: evaluation.request.requesterId,
      type: evaluation.request.type,
      status: evaluation.status,
      privateNote: evaluation.request.privateNote ?? null,
    }))
    .sort((a, b) => a.requesterId.localeCompare(b.requesterId) || a.type.localeCompare(b.type));
}

/**
 * Requests still sitting in SUBMITTED that are running out of runway, most
 * urgent first. This is the escalation queue; without it an unacknowledged
 * request simply ages out in silence.
 */
export function findUnactionedRequests(evaluations: RequestEvaluation[]): RequestEvaluation[] {
  return evaluations
    .filter((evaluation) => evaluation.request.state === "SUBMITTED")
    .filter(
      (evaluation) =>
        evaluation.status === "AT_RISK" ||
        evaluation.status === "MISSED_DEADLINE" ||
        evaluation.status === "OVER_CAPACITY" ||
        evaluation.status === "VENUE_INCOMPATIBLE",
    )
    .sort(
      (a, b) =>
        a.businessDaysRemaining - b.businessDaysRemaining ||
        a.request.id.localeCompare(b.request.id),
    );
}
