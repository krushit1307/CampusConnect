/**
 * Age-Restricted Event Service Compliance (#3398).
 *
 * `events.alcohol_present` is a single boolean that routes an event to a
 * co-signer for approval (20260810000094_event_co_signers.sql). After that
 * point the platform has nothing: no record that an ID was checked, no
 * distinction between a 21+ door and a mixed-age room where under-21 students
 * attend legitimately and must simply not be served, no certified-server
 * roster, no service cutoff.
 *
 * The question asked after an incident is never "was alcohol present". It is
 * whether this specific person was of age, whether the person who served them
 * was certified, whether service stopped on time, and whether any of that can
 * be shown. This module answers those.
 *
 * Two deliberate constraints:
 *
 *   - Date of birth is an input, never an output. The caller passes it at the
 *     moment of verification and stores the resulting band. Copying a DOB onto
 *     a verification row for every event a student attends creates a standing
 *     liability to answer a question that only needs a yes or no once.
 *
 *   - Everything is pure and synchronous. This sits in the check-in scanning
 *     path next to `ticketScanner.ts` and cannot afford a round trip.
 */

export type RestrictionMode =
  /** No age restriction applies. */
  | "NONE"
  /** Nobody below the threshold is admitted at all. */
  | "AGE_RESTRICTED_VENUE"
  /** All ages admitted; service is what is restricted. */
  | "MIXED_AGE_SERVICE";

export type VerificationMethod =
  "GOVERNMENT_ID" | "PASSPORT" | "CAMPUS_ID_WITH_DOB" | "PREVIOUSLY_VERIFIED";

export type AgeBand = "UNDER_AGE" | "OF_AGE";

/**
 * The physical carrier of the decision. A server reads the band, not a
 * database, so the band is what actually governs at the point of pour.
 */
export type WristbandTier = "NONE" | "ENTRY_ONLY" | "SERVICE_PERMITTED";

export type AdmissionDecision = "ADMIT_WITH_SERVICE" | "ADMIT_NO_SERVICE" | "REFUSE_ENTRY";

export type ServiceDecision = "SERVE" | "REFUSE";

export type ServiceRefusalReason =
  | "UNDER_AGE"
  | "NO_VERIFICATION"
  | "WRONG_BAND"
  | "OUTSIDE_SERVICE_WINDOW"
  | "PAST_LAST_CALL"
  | "DRINK_CAP_REACHED"
  | "NO_CERTIFIED_SERVER";

export type CertificationType = "TIPS" | "SERVSAFE_ALCOHOL" | "STATE_EQUIVALENT";

export interface ServiceConfig {
  eventId: string;
  mode: RestrictionMode;
  /** Minimum age for service, in years. */
  minimumAge: number;
  /** ISO timestamp the event starts. */
  eventStart: string;
  /** ISO timestamp the event ends. */
  eventEnd: string;
  /** Minutes before the event end at which last call is announced. */
  lastCallMinutesBeforeEnd: number;
  /** Minutes before the event end at which service stops entirely. */
  hardStopMinutesBeforeEnd: number;
  /** Maximum drinks a single attendee may be served, if capped. */
  drinksPerAttendeeCap?: number | null;
  /** Attendance figure the roster requirement is scaled against. */
  expectedAttendance: number;
  /** Attendees per certified server the institution requires. */
  attendeesPerCertifiedServer: number;
  venueId?: string | null;
}

/**
 * The outcome of an ID check. Note the absence of a date of birth field: the
 * band is the fact worth keeping.
 */
export interface AgeVerification {
  id: string;
  eventId: string;
  attendeeId: string;
  method: VerificationMethod;
  band: AgeBand;
  verifiedBy: string;
  verifiedAt: string;
}

export interface IssuedBand {
  attendeeId: string;
  tier: WristbandTier;
  issuedBy: string;
  issuedAt: string;
}

export interface CertifiedServer {
  userId: string;
  certification: CertificationType;
  certificateNumber: string;
  /** Certifications lapse, typically every three years. */
  expiresAt: string;
}

export interface AdmissionResult {
  decision: AdmissionDecision;
  band: WristbandTier;
  ageBand: AgeBand;
  explanation: string;
}

export interface ServiceResult {
  decision: ServiceDecision;
  reason?: ServiceRefusalReason;
  explanation: string;
}

export interface RosterEvaluation {
  compliant: boolean;
  certifiedCount: number;
  requiredCount: number;
  /** Servers whose certification lapses before the event date. */
  lapsed: CertifiedServer[];
  reasons: string[];
}

const MS_PER_MINUTE = 60_000;

function toTime(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Whole years old on a given date.
 *
 * A student whose twenty-first birthday is the day of the event is twenty-one
 * at that event. An off-by-one here is not cosmetic in either direction: it
 * either refuses a legal attendee or serves an illegal one. Compared on UTC
 * calendar parts rather than by dividing a millisecond difference, which drifts
 * across leap years.
 */
export function ageOnDate(dateOfBirth: string, onDate: string): number {
  const dob = new Date(dateOfBirth);
  const on = new Date(onDate);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(on.getTime())) return Number.NaN;

  let age = on.getUTCFullYear() - dob.getUTCFullYear();

  const monthDelta = on.getUTCMonth() - dob.getUTCMonth();
  const dayDelta = on.getUTCDate() - dob.getUTCDate();

  // The birthday has not arrived yet this year.
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  return age;
}

/** The band the age check resolves to. */
export function resolveAgeBand(
  dateOfBirth: string,
  eventDate: string,
  minimumAge: number,
): AgeBand {
  const age = ageOnDate(dateOfBirth, eventDate);
  if (Number.isNaN(age)) return "UNDER_AGE";
  return age >= minimumAge ? "OF_AGE" : "UNDER_AGE";
}

/**
 * Whether this person may come in, and with which band.
 *
 * The mixed-age case is the one that actually goes wrong, and the one a single
 * `alcohol_present` boolean cannot express at all: an under-21 student at a
 * mixed-age event is admitted, wears a band that does not permit service, and
 * is refused at the bar rather than at the door.
 */
export function evaluateAdmission(params: {
  dateOfBirth: string;
  config: ServiceConfig;
}): AdmissionResult {
  const { dateOfBirth, config } = params;
  const ageBand = resolveAgeBand(dateOfBirth, config.eventStart, config.minimumAge);

  if (config.mode === "NONE") {
    return {
      decision: "ADMIT_WITH_SERVICE",
      band: "NONE",
      ageBand,
      explanation: "No age restriction applies to this event.",
    };
  }

  if (config.mode === "AGE_RESTRICTED_VENUE" && ageBand === "UNDER_AGE") {
    return {
      decision: "REFUSE_ENTRY",
      band: "NONE",
      ageBand,
      explanation: `This event is ${config.minimumAge}+ throughout; entry cannot be granted.`,
    };
  }

  if (ageBand === "UNDER_AGE") {
    return {
      decision: "ADMIT_NO_SERVICE",
      band: "ENTRY_ONLY",
      ageBand,
      explanation:
        `Admitted to a mixed-age event. The entry-only band must be visible at the bar, ` +
        `as service is restricted to ${config.minimumAge} and over.`,
    };
  }

  return {
    decision: "ADMIT_WITH_SERVICE",
    band: "SERVICE_PERMITTED",
    ageBand,
    explanation: `Verified as ${config.minimumAge} or over; service band issued.`,
  };
}

export interface ServiceWindow {
  opensAt: string;
  lastCallAt: string;
  closesAt: string;
}

/**
 * Derives last call and the hard stop from the event end.
 *
 * Expressed as offsets from the end rather than as absolute times so that
 * rescheduling an event moves its cutoff with it. A cutoff that stays put
 * while the event moves is worse than no cutoff, because it looks correct.
 */
export function serviceWindow(config: ServiceConfig): ServiceWindow {
  const endMs = toTime(config.eventEnd);

  return {
    opensAt: config.eventStart,
    lastCallAt: new Date(endMs - config.lastCallMinutesBeforeEnd * MS_PER_MINUTE).toISOString(),
    closesAt: new Date(endMs - config.hardStopMinutesBeforeEnd * MS_PER_MINUTE).toISOString(),
  };
}

/** Whether a given instant falls inside the window service is permitted in. */
export function isWithinServiceWindow(now: string, window: ServiceWindow): boolean {
  const nowMs = toTime(now);
  return nowMs >= toTime(window.opensAt) && nowMs < toTime(window.closesAt);
}

/**
 * The point-of-service check: may this person be poured a drink right now.
 *
 * Every refusal names its reason so the server has something to say, and so
 * the pattern of refusals is auditable afterwards.
 */
export function evaluateService(params: {
  config: ServiceConfig;
  band: IssuedBand | null;
  verification: AgeVerification | null;
  drinksAlreadyServed?: number;
  certifiedServerOnDuty?: boolean;
  now: string;
}): ServiceResult {
  const { config, band, verification, now } = params;
  const drinksServed = params.drinksAlreadyServed ?? 0;
  const certifiedServerOnDuty = params.certifiedServerOnDuty ?? true;

  if (config.mode === "NONE") {
    return { decision: "SERVE", explanation: "No age restriction applies to this event." };
  }

  if (!certifiedServerOnDuty) {
    return {
      decision: "REFUSE",
      reason: "NO_CERTIFIED_SERVER",
      explanation: "No certified server is on duty; service must stop.",
    };
  }

  const window = serviceWindow(config);
  const nowMs = toTime(now);

  if (!isWithinServiceWindow(now, window)) {
    const past = nowMs >= toTime(window.closesAt);
    return {
      decision: "REFUSE",
      reason: past ? "PAST_LAST_CALL" : "OUTSIDE_SERVICE_WINDOW",
      explanation: past
        ? `Service closed at ${window.closesAt}.`
        : `Service does not open until ${window.opensAt}.`,
    };
  }

  // No verification at all is a different failure from a verification that
  // came back under age, and conflating them hides the anomaly worth chasing.
  if (!verification) {
    return {
      decision: "REFUSE",
      reason: "NO_VERIFICATION",
      explanation: "No age verification is on record for this attendee.",
    };
  }

  if (verification.band === "UNDER_AGE") {
    return {
      decision: "REFUSE",
      reason: "UNDER_AGE",
      explanation: `Verified as under ${config.minimumAge}.`,
    };
  }

  if (!band || band.tier !== "SERVICE_PERMITTED") {
    return {
      decision: "REFUSE",
      reason: "WRONG_BAND",
      explanation: "The attendee is not wearing a band that permits service.",
    };
  }

  if (config.drinksPerAttendeeCap != null && drinksServed >= config.drinksPerAttendeeCap) {
    return {
      decision: "REFUSE",
      reason: "DRINK_CAP_REACHED",
      explanation: `The per-attendee cap of ${config.drinksPerAttendeeCap} has been reached.`,
    };
  }

  return { decision: "SERVE", explanation: "Verified, banded and within the service window." };
}

/**
 * Whether the serving team satisfies the certification requirement.
 *
 * A certification that lapses before the event date is treated as absent
 * rather than valid; an expired card is not a qualification, and counting it
 * would produce a roster that passes on paper and fails on the night.
 */
export function evaluateServerRoster(
  servers: ReadonlyArray<CertifiedServer>,
  config: ServiceConfig,
): RosterEvaluation {
  const eventMs = toTime(config.eventStart);

  const lapsed = servers
    .filter((server) => toTime(server.expiresAt) < eventMs)
    .sort((a, b) => toTime(a.expiresAt) - toTime(b.expiresAt) || a.userId.localeCompare(b.userId));

  const valid = servers.filter((server) => toTime(server.expiresAt) >= eventMs);

  const requiredCount = Math.max(
    1,
    Math.ceil(config.expectedAttendance / Math.max(1, config.attendeesPerCertifiedServer)),
  );

  const reasons: string[] = [];

  if (valid.length === 0) {
    reasons.push("No certified server is rostered for this event.");
  } else if (valid.length < requiredCount) {
    reasons.push(
      `${valid.length} certified ${valid.length === 1 ? "server is" : "servers are"} rostered; ` +
        `${config.expectedAttendance} expected attendees require ${requiredCount}.`,
    );
  }

  for (const server of lapsed) {
    reasons.push(
      `${server.userId}'s ${server.certification} certification expires ${server.expiresAt}, before the event.`,
    );
  }

  return {
    compliant: valid.length >= requiredCount,
    certifiedCount: valid.length,
    requiredCount,
    lapsed,
    reasons,
  };
}

export interface BandAnomaly {
  attendeeId: string;
  kind: "BAND_WITHOUT_VERIFICATION" | "SERVICE_BAND_FOR_UNDER_AGE" | "VERIFIED_BUT_UNBANDED";
  explanation: string;
}

/**
 * Reconciles bands handed out against ID checks recorded.
 *
 * A service band issued with no matching verification is the exact anomaly
 * worth finding, and it is invisible today because neither side is recorded.
 * Reconciling the two is what turns a pile of wristbands into evidence.
 */
export function reconcileBands(
  issued: ReadonlyArray<IssuedBand>,
  verifications: ReadonlyArray<AgeVerification>,
): BandAnomaly[] {
  const byAttendee = new Map<string, AgeVerification>();
  for (const verification of verifications) {
    byAttendee.set(verification.attendeeId, verification);
  }

  const bandedAttendees = new Set(issued.map((band) => band.attendeeId));
  const anomalies: BandAnomaly[] = [];

  for (const band of issued) {
    if (band.tier === "NONE") continue;

    const verification = byAttendee.get(band.attendeeId);

    if (!verification) {
      anomalies.push({
        attendeeId: band.attendeeId,
        kind: "BAND_WITHOUT_VERIFICATION",
        explanation: `A ${band.tier} band was issued by ${band.issuedBy} with no ID check on record.`,
      });
      continue;
    }

    if (band.tier === "SERVICE_PERMITTED" && verification.band === "UNDER_AGE") {
      anomalies.push({
        attendeeId: band.attendeeId,
        kind: "SERVICE_BAND_FOR_UNDER_AGE",
        explanation: "A service band was issued to somebody the ID check returned as under age.",
      });
    }
  }

  for (const verification of verifications) {
    if (verification.band === "OF_AGE" && !bandedAttendees.has(verification.attendeeId)) {
      anomalies.push({
        attendeeId: verification.attendeeId,
        kind: "VERIFIED_BUT_UNBANDED",
        explanation:
          "An ID check was recorded but no band was issued; the attendee cannot be served.",
      });
    }
  }

  return anomalies.sort(
    (a, b) => a.attendeeId.localeCompare(b.attendeeId) || a.kind.localeCompare(b.kind),
  );
}

export interface ApprovedParameters {
  expectedAttendance: number;
  venueId: string | null;
  eventEnd: string;
  mode: RestrictionMode;
}

export interface StalenessCheck {
  stale: boolean;
  changes: string[];
}

/**
 * Whether an approval still describes the event it was granted for.
 *
 * An event approved at eighty attendees that has since grown to three hundred
 * is running on an approval nobody gave. The existing co-signer trigger already
 * re-fires when the underlying columns change; the compliance verdict has to
 * follow the same principle or it becomes a rubber stamp with a date on it.
 */
export function isApprovalStale(
  approved: ApprovedParameters,
  current: ServiceConfig,
  attendanceTolerance = 0.2,
): StalenessCheck {
  const changes: string[] = [];

  const growth =
    approved.expectedAttendance > 0
      ? (current.expectedAttendance - approved.expectedAttendance) / approved.expectedAttendance
      : current.expectedAttendance > 0
        ? Number.POSITIVE_INFINITY
        : 0;

  if (growth > attendanceTolerance) {
    changes.push(
      `Expected attendance has moved from ${approved.expectedAttendance} to ${current.expectedAttendance}.`,
    );
  }

  if ((current.venueId ?? null) !== approved.venueId) {
    changes.push(
      `The venue has changed from ${approved.venueId ?? "none"} to ${current.venueId ?? "none"}.`,
    );
  }

  if (toTime(current.eventEnd) > toTime(approved.eventEnd)) {
    changes.push(
      `The event now ends at ${current.eventEnd}, later than the approved ${approved.eventEnd}.`,
    );
  }

  if (current.mode !== approved.mode) {
    changes.push(`The restriction mode has changed from ${approved.mode} to ${current.mode}.`);
  }

  return { stale: changes.length > 0, changes };
}
