import { describe, it, expect } from "vitest";
import {
  ageOnDate,
  resolveAgeBand,
  evaluateAdmission,
  serviceWindow,
  isWithinServiceWindow,
  evaluateService,
  evaluateServerRoster,
  reconcileBands,
  isApprovalStale,
  type ServiceConfig,
  type AgeVerification,
  type IssuedBand,
  type CertifiedServer,
} from "./ageRestrictedService";

const EVENT_START = "2026-10-16T22:00:00.000Z";
const EVENT_END = "2026-10-17T03:00:00.000Z";

function config(overrides: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    eventId: "e_1",
    mode: "MIXED_AGE_SERVICE",
    minimumAge: 21,
    eventStart: EVENT_START,
    eventEnd: EVENT_END,
    lastCallMinutesBeforeEnd: 30,
    hardStopMinutesBeforeEnd: 15,
    expectedAttendance: 150,
    attendeesPerCertifiedServer: 75,
    venueId: "v_1",
    ...overrides,
  };
}

function verification(overrides: Partial<AgeVerification> = {}): AgeVerification {
  return {
    id: "ver_1",
    eventId: "e_1",
    attendeeId: "u_1",
    method: "GOVERNMENT_ID",
    band: "OF_AGE",
    verifiedBy: "staff_1",
    verifiedAt: "2026-10-16T22:10:00.000Z",
    ...overrides,
  };
}

function band(overrides: Partial<IssuedBand> = {}): IssuedBand {
  return {
    attendeeId: "u_1",
    tier: "SERVICE_PERMITTED",
    issuedBy: "staff_1",
    issuedAt: "2026-10-16T22:10:00.000Z",
    ...overrides,
  };
}

function server(overrides: Partial<CertifiedServer> = {}): CertifiedServer {
  return {
    userId: "staff_1",
    certification: "TIPS",
    certificateNumber: "T-0001",
    expiresAt: "2027-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Age-Restricted Event Service Compliance (#3398)", () => {
  describe("age on the day", () => {
    it("counts somebody as of age on their birthday itself", () => {
      expect(ageOnDate("2005-10-16T00:00:00.000Z", "2026-10-16T22:00:00.000Z")).toBe(21);
    });

    it("counts them as a year younger the day before", () => {
      expect(ageOnDate("2005-10-17T00:00:00.000Z", "2026-10-16T22:00:00.000Z")).toBe(20);
    });

    it("handles a birthday later in the same month", () => {
      expect(ageOnDate("2005-10-30T00:00:00.000Z", "2026-10-16T00:00:00.000Z")).toBe(20);
    });

    it("handles a birthday in an earlier month", () => {
      expect(ageOnDate("2005-03-01T00:00:00.000Z", "2026-10-16T00:00:00.000Z")).toBe(21);
    });

    it("handles a birthday in a later month", () => {
      expect(ageOnDate("2005-12-01T00:00:00.000Z", "2026-10-16T00:00:00.000Z")).toBe(20);
    });

    it("does not drift for a leap-day birthday", () => {
      // Born 29 February 2004; on 28 February 2025 they have not had a
      // birthday yet that year, and on 1 March they have.
      expect(ageOnDate("2004-02-29T00:00:00.000Z", "2025-02-28T00:00:00.000Z")).toBe(20);
      expect(ageOnDate("2004-02-29T00:00:00.000Z", "2025-03-01T00:00:00.000Z")).toBe(21);
    });

    it("stays exact across a span containing several leap years", () => {
      expect(ageOnDate("2000-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(26);
    });

    it("returns NaN rather than a wrong number for an unparseable date", () => {
      expect(Number.isNaN(ageOnDate("not-a-date", EVENT_START))).toBe(true);
    });

    it("fails closed to under age when the date of birth is unusable", () => {
      expect(resolveAgeBand("not-a-date", EVENT_START, 21)).toBe("UNDER_AGE");
    });

    it("resolves the band against the threshold it is given", () => {
      const dob = "2007-01-01T00:00:00.000Z";
      expect(resolveAgeBand(dob, EVENT_START, 18)).toBe("OF_AGE");
      expect(resolveAgeBand(dob, EVENT_START, 21)).toBe("UNDER_AGE");
    });
  });

  describe("admission", () => {
    it("refuses an under-age attendee at a 21+ venue", () => {
      const result = evaluateAdmission({
        dateOfBirth: "2008-01-01T00:00:00.000Z",
        config: config({ mode: "AGE_RESTRICTED_VENUE" }),
      });

      expect(result.decision).toBe("REFUSE_ENTRY");
      expect(result.band).toBe("NONE");
    });

    it("admits an under-age attendee to a mixed-age event with an entry-only band", () => {
      // This is the case a single alcohol_present boolean cannot express, and
      // the one that actually happens.
      const result = evaluateAdmission({
        dateOfBirth: "2008-01-01T00:00:00.000Z",
        config: config(),
      });

      expect(result.decision).toBe("ADMIT_NO_SERVICE");
      expect(result.band).toBe("ENTRY_ONLY");
      expect(result.ageBand).toBe("UNDER_AGE");
    });

    it("issues a service band to an of-age attendee", () => {
      const result = evaluateAdmission({
        dateOfBirth: "2000-01-01T00:00:00.000Z",
        config: config(),
      });

      expect(result.decision).toBe("ADMIT_WITH_SERVICE");
      expect(result.band).toBe("SERVICE_PERMITTED");
    });

    it("bands nobody at an unrestricted event", () => {
      const result = evaluateAdmission({
        dateOfBirth: "2008-01-01T00:00:00.000Z",
        config: config({ mode: "NONE" }),
      });

      expect(result.decision).toBe("ADMIT_WITH_SERVICE");
      expect(result.band).toBe("NONE");
    });

    it("uses the event date rather than today for the age check", () => {
      // Turns 21 on the day of the event.
      const result = evaluateAdmission({
        dateOfBirth: "2005-10-16T00:00:00.000Z",
        config: config(),
      });
      expect(result.decision).toBe("ADMIT_WITH_SERVICE");
    });
  });

  describe("the service window", () => {
    it("derives last call and the hard stop from the event end", () => {
      const window = serviceWindow(config());
      expect(window.lastCallAt).toBe("2026-10-17T02:30:00.000Z");
      expect(window.closesAt).toBe("2026-10-17T02:45:00.000Z");
    });

    it("moves the cutoff when the event end moves", () => {
      // A cutoff that stays put while the event moves looks correct and is not.
      const window = serviceWindow(config({ eventEnd: "2026-10-17T04:00:00.000Z" }));
      expect(window.closesAt).toBe("2026-10-17T03:45:00.000Z");
    });

    it("is open in the middle of the event", () => {
      expect(isWithinServiceWindow("2026-10-17T01:00:00.000Z", serviceWindow(config()))).toBe(true);
    });

    it("is closed before the event starts", () => {
      expect(isWithinServiceWindow("2026-10-16T20:00:00.000Z", serviceWindow(config()))).toBe(
        false,
      );
    });

    it("is closed at the hard stop itself", () => {
      expect(isWithinServiceWindow("2026-10-17T02:45:00.000Z", serviceWindow(config()))).toBe(
        false,
      );
    });

    it("is still open one minute before the hard stop", () => {
      expect(isWithinServiceWindow("2026-10-17T02:44:00.000Z", serviceWindow(config()))).toBe(true);
    });
  });

  describe("point of service", () => {
    const NOW = "2026-10-17T01:00:00.000Z";

    it("serves a verified, banded attendee inside the window", () => {
      const result = evaluateService({
        config: config(),
        band: band(),
        verification: verification(),
        now: NOW,
      });

      expect(result.decision).toBe("SERVE");
    });

    it("refuses when no ID check is on record", () => {
      const result = evaluateService({
        config: config(),
        band: band(),
        verification: null,
        now: NOW,
      });

      expect(result.decision).toBe("REFUSE");
      expect(result.reason).toBe("NO_VERIFICATION");
    });

    it("distinguishes an absent check from one that came back under age", () => {
      const under = evaluateService({
        config: config(),
        band: band(),
        verification: verification({ band: "UNDER_AGE" }),
        now: NOW,
      });

      expect(under.reason).toBe("UNDER_AGE");
    });

    it("refuses an entry-only band even when the attendee verified as of age", () => {
      // The band is what the server reads. A mismatch here is worth catching
      // rather than quietly resolving in the attendee's favour.
      const result = evaluateService({
        config: config(),
        band: band({ tier: "ENTRY_ONLY" }),
        verification: verification(),
        now: NOW,
      });

      expect(result.reason).toBe("WRONG_BAND");
    });

    it("refuses after the hard stop", () => {
      const result = evaluateService({
        config: config(),
        band: band(),
        verification: verification(),
        now: "2026-10-17T02:50:00.000Z",
      });

      expect(result.reason).toBe("PAST_LAST_CALL");
    });

    it("refuses before service opens", () => {
      const result = evaluateService({
        config: config(),
        band: band(),
        verification: verification(),
        now: "2026-10-16T20:00:00.000Z",
      });

      expect(result.reason).toBe("OUTSIDE_SERVICE_WINDOW");
    });

    it("enforces the per-attendee drink cap", () => {
      const result = evaluateService({
        config: config({ drinksPerAttendeeCap: 3 }),
        band: band(),
        verification: verification(),
        drinksAlreadyServed: 3,
        now: NOW,
      });

      expect(result.reason).toBe("DRINK_CAP_REACHED");
    });

    it("serves up to but not beyond the cap", () => {
      const result = evaluateService({
        config: config({ drinksPerAttendeeCap: 3 }),
        band: band(),
        verification: verification(),
        drinksAlreadyServed: 2,
        now: NOW,
      });

      expect(result.decision).toBe("SERVE");
    });

    it("stops service entirely when no certified server is on duty", () => {
      const result = evaluateService({
        config: config(),
        band: band(),
        verification: verification(),
        certifiedServerOnDuty: false,
        now: NOW,
      });

      expect(result.reason).toBe("NO_CERTIFIED_SERVER");
    });

    it("checks the window before the attendee, since a closed bar serves nobody", () => {
      const result = evaluateService({
        config: config(),
        band: null,
        verification: null,
        now: "2026-10-17T02:50:00.000Z",
      });

      expect(result.reason).toBe("PAST_LAST_CALL");
    });

    it("serves without ceremony at an unrestricted event", () => {
      const result = evaluateService({
        config: config({ mode: "NONE" }),
        band: null,
        verification: null,
        now: NOW,
      });

      expect(result.decision).toBe("SERVE");
    });
  });

  describe("certified server roster", () => {
    it("requires a server for every started block of attendees", () => {
      const roster = evaluateServerRoster([server()], config({ expectedAttendance: 150 }));

      expect(roster.requiredCount).toBe(2);
      expect(roster.compliant).toBe(false);
      expect(roster.reasons[0]).toContain("require 2");
    });

    it("passes when the ratio is met", () => {
      const roster = evaluateServerRoster(
        [server(), server({ userId: "staff_2", certificateNumber: "T-0002" })],
        config({ expectedAttendance: 150 }),
      );

      expect(roster.compliant).toBe(true);
      expect(roster.certifiedCount).toBe(2);
    });

    it("treats a certification lapsing before the event as absent", () => {
      const roster = evaluateServerRoster(
        [server({ expiresAt: "2026-09-01T00:00:00.000Z" })],
        config({ expectedAttendance: 40 }),
      );

      expect(roster.compliant).toBe(false);
      expect(roster.certifiedCount).toBe(0);
      expect(roster.lapsed).toHaveLength(1);
    });

    it("names the lapsing certification so it can be renewed", () => {
      const roster = evaluateServerRoster(
        [server({ expiresAt: "2026-09-01T00:00:00.000Z" })],
        config(),
      );

      expect(roster.reasons.join(" ")).toContain("TIPS certification expires");
    });

    it("counts a certification expiring on the event date as still valid", () => {
      const roster = evaluateServerRoster(
        [server({ expiresAt: EVENT_START })],
        config({ expectedAttendance: 40 }),
      );

      expect(roster.compliant).toBe(true);
    });

    it("always requires at least one certified server, however small the event", () => {
      const roster = evaluateServerRoster([], config({ expectedAttendance: 5 }));

      expect(roster.requiredCount).toBe(1);
      expect(roster.reasons[0]).toContain("No certified server");
    });

    it("orders lapsed certifications by expiry", () => {
      const roster = evaluateServerRoster(
        [
          server({ userId: "staff_b", expiresAt: "2026-09-10T00:00:00.000Z" }),
          server({ userId: "staff_a", expiresAt: "2026-08-01T00:00:00.000Z" }),
        ],
        config(),
      );

      expect(roster.lapsed.map((s) => s.userId)).toEqual(["staff_a", "staff_b"]);
    });
  });

  describe("band reconciliation", () => {
    it("finds a band issued with no ID check behind it", () => {
      const anomalies = reconcileBands([band({ attendeeId: "u_9" })], []);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].kind).toBe("BAND_WITHOUT_VERIFICATION");
    });

    it("finds a service band issued to somebody the check returned as under age", () => {
      const anomalies = reconcileBands([band()], [verification({ band: "UNDER_AGE" })]);

      expect(anomalies.map((a) => a.kind)).toContain("SERVICE_BAND_FOR_UNDER_AGE");
    });

    it("finds a verified attendee who was never banded", () => {
      const anomalies = reconcileBands([], [verification()]);

      expect(anomalies[0].kind).toBe("VERIFIED_BUT_UNBANDED");
    });

    it("accepts an entry-only band for an under-age attendee", () => {
      const anomalies = reconcileBands(
        [band({ tier: "ENTRY_ONLY" })],
        [verification({ band: "UNDER_AGE" })],
      );

      expect(anomalies).toEqual([]);
    });

    it("ignores an explicitly empty band", () => {
      expect(reconcileBands([band({ tier: "NONE" })], [])).toEqual([]);
    });

    it("reports nothing when bands and checks agree", () => {
      const anomalies = reconcileBands(
        [band(), band({ attendeeId: "u_2", tier: "ENTRY_ONLY" })],
        [verification(), verification({ id: "ver_2", attendeeId: "u_2", band: "UNDER_AGE" })],
      );

      expect(anomalies).toEqual([]);
    });

    it("is ordered deterministically", () => {
      const anomalies = reconcileBands(
        [band({ attendeeId: "u_c" }), band({ attendeeId: "u_a" }), band({ attendeeId: "u_b" })],
        [],
      );

      expect(anomalies.map((a) => a.attendeeId)).toEqual(["u_a", "u_b", "u_c"]);
    });
  });

  describe("approval staleness", () => {
    const approved = {
      expectedAttendance: 80,
      venueId: "v_1",
      eventEnd: EVENT_END,
      mode: "MIXED_AGE_SERVICE" as const,
    };

    it("flags an event that has grown well beyond what was approved", () => {
      const check = isApprovalStale(approved, config({ expectedAttendance: 300 }));

      expect(check.stale).toBe(true);
      expect(check.changes[0]).toContain("80 to 300");
    });

    it("tolerates ordinary growth within the margin", () => {
      expect(isApprovalStale(approved, config({ expectedAttendance: 90 })).stale).toBe(false);
    });

    it("does not flag an event that has shrunk", () => {
      expect(isApprovalStale(approved, config({ expectedAttendance: 40 })).stale).toBe(false);
    });

    it("flags a venue change", () => {
      const check = isApprovalStale(approved, config({ expectedAttendance: 80, venueId: "v_2" }));

      expect(check.changes).toHaveLength(1);
      expect(check.changes[0]).toContain("venue has changed");
    });

    it("flags a later finish but not an earlier one", () => {
      // Attendance is held at the approved figure so the verdict can only be
      // coming from the end time.
      const later = config({ expectedAttendance: 80, eventEnd: "2026-10-17T05:00:00.000Z" });
      const earlier = config({ expectedAttendance: 80, eventEnd: "2026-10-17T01:00:00.000Z" });

      expect(isApprovalStale(approved, later).stale).toBe(true);
      expect(isApprovalStale(approved, earlier).stale).toBe(false);
    });

    it("flags a change of restriction mode", () => {
      const check = isApprovalStale(
        approved,
        config({ expectedAttendance: 80, mode: "AGE_RESTRICTED_VENUE" }),
      );

      expect(check.changes).toHaveLength(1);
      expect(check.changes[0]).toContain("restriction mode");
    });

    it("reports an unchanged event as current", () => {
      expect(isApprovalStale(approved, config({ expectedAttendance: 80 }))).toEqual({
        stale: false,
        changes: [],
      });
    });

    it("flags any attendance at all when none was approved", () => {
      const check = isApprovalStale({ ...approved, expectedAttendance: 0 }, config());
      expect(check.stale).toBe(true);
    });
  });
});
