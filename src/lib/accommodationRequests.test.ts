import { describe, it, expect } from "vitest";
import {
  ACCOMMODATION_SPECS,
  ALL_ACCOMMODATION_TYPES,
  businessDaysBetween,
  deadlineForType,
  toDateKey,
  evaluateRequest,
  evaluateRequests,
  expandStandingAccommodations,
  buildFulfilmentSummary,
  buildIdentifiedManifest,
  findUnactionedRequests,
  type AccommodationRequest,
  type EvaluationContext,
  type StandingAccommodation,
  type VenueCapability,
} from "./accommodationRequests";

// Monday. Chosen so weekend behaviour is exercised by the arithmetic below
// rather than assumed.
const EVENT_START = "2026-09-07T18:00:00.000Z";

const ACCESSIBLE_VENUE: VenueCapability = {
  venueId: "v_main_hall",
  features: {
    has_elevator: true,
    wheelchair_ramp: true,
    gender_neutral_restrooms: true,
    hearing_loop: false,
    low_sensory_zone: false,
  },
  resources: { WHEELCHAIR_SPACE: 2, COMPANION_SEAT: 2, QUIET_ROOM_PLACE: 1 },
};

function context(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    eventId: "e_1",
    eventStart: EVENT_START,
    now: "2026-08-17T09:00:00.000Z",
    venue: ACCESSIBLE_VENUE,
    ...overrides,
  };
}

function request(overrides: Partial<AccommodationRequest> & { id: string }): AccommodationRequest {
  return {
    eventId: "e_1",
    requesterId: "u_1",
    type: "ASL_INTERPRETER",
    submittedAt: "2026-08-17T09:00:00.000Z",
    state: "SUBMITTED",
    ...overrides,
  };
}

describe("Accessibility Accommodation Requests (#3396)", () => {
  describe("business-day arithmetic", () => {
    it("does not credit the day a request was submitted", () => {
      // Friday 16:00 to Monday 09:00 is one business day of runway, not three.
      expect(businessDaysBetween("2026-08-14T16:00:00.000Z", "2026-08-17T09:00:00.000Z")).toBe(1);
    });

    it("counts the event day but skips the weekend in between", () => {
      // Thu 13 -> Thu 20: Fri, Mon, Tue, Wed, Thu.
      expect(businessDaysBetween("2026-08-13T00:00:00.000Z", "2026-08-20T00:00:00.000Z")).toBe(5);
    });

    it("counts a clean run of weekdays", () => {
      expect(businessDaysBetween("2026-08-17T00:00:00.000Z", "2026-08-21T23:00:00.000Z")).toBe(4);
    });

    it("excludes campus holidays", () => {
      expect(
        businessDaysBetween("2026-08-13T00:00:00.000Z", "2026-08-20T00:00:00.000Z", ["2026-08-17"]),
      ).toBe(4);
    });

    it("does not double-deduct a holiday that falls on a weekend", () => {
      expect(
        businessDaysBetween("2026-08-13T00:00:00.000Z", "2026-08-20T00:00:00.000Z", [
          "2026-08-15",
          "2026-08-16",
        ]),
      ).toBe(5);
    });

    it("returns zero within a single day", () => {
      expect(businessDaysBetween("2026-08-17T01:00:00.000Z", "2026-08-17T23:00:00.000Z")).toBe(0);
    });

    it("returns a negative count once the event has passed", () => {
      expect(businessDaysBetween("2026-08-20T00:00:00.000Z", "2026-08-13T00:00:00.000Z")).toBe(-5);
    });

    it("survives an unparseable timestamp without throwing", () => {
      expect(businessDaysBetween("not-a-date", EVENT_START)).toBe(0);
    });

    it("derives date keys in UTC", () => {
      expect(toDateKey("2026-09-07T18:00:00.000Z")).toBe("2026-09-07");
    });
  });

  describe("deadlines", () => {
    it("walks a full lead time back over two weekends", () => {
      // Ten business days back from Monday 7 September.
      expect(deadlineForType("ASL_INTERPRETER", EVENT_START)).toBe("2026-08-24T00:00:00.000Z");
    });

    it("is the exact instant at which the lead time is still met", () => {
      const deadline = deadlineForType("ASL_INTERPRETER", EVENT_START);
      expect(businessDaysBetween(deadline, EVENT_START)).toBe(
        ACCOMMODATION_SPECS.ASL_INTERPRETER.leadTimeBusinessDays,
      );
    });

    it("moves earlier when a holiday falls inside the window", () => {
      const withHoliday = deadlineForType("ASL_INTERPRETER", EVENT_START, ["2026-09-02"]);
      expect(new Date(withHoliday).getTime()).toBeLessThan(
        new Date(deadlineForType("ASL_INTERPRETER", EVENT_START)).getTime(),
      );
    });

    it("agrees with the lead time of every accommodation type", () => {
      for (const type of ALL_ACCOMMODATION_TYPES) {
        const deadline = deadlineForType(type, EVENT_START);
        expect(businessDaysBetween(deadline, EVENT_START)).toBe(
          ACCOMMODATION_SPECS[type].leadTimeBusinessDays,
        );
      }
    });
  });

  describe("lead-time feasibility", () => {
    it("is feasible with the full lead time available", () => {
      const result = evaluateRequest(
        request({ id: "r_1" }),
        context({ now: "2026-08-24T00:00:00.000Z" }),
      );
      expect(result.status).toBe("FEASIBLE");
      expect(result.businessDaysRemaining).toBe(10);
    });

    it("is at risk one day inside the lead time", () => {
      const result = evaluateRequest(
        request({ id: "r_1" }),
        context({ now: "2026-08-25T00:00:00.000Z" }),
      );
      expect(result.status).toBe("AT_RISK");
      expect(result.needsOrganiserAction).toBe(true);
    });

    it("treats the grace boundary itself as still worth chasing", () => {
      const result = evaluateRequest(
        request({ id: "r_1" }),
        context({ now: "2026-08-31T00:00:00.000Z" }),
      );
      expect(result.businessDaysRemaining).toBe(
        ACCOMMODATION_SPECS.ASL_INTERPRETER.atRiskGraceBusinessDays,
      );
      expect(result.status).toBe("AT_RISK");
    });

    it("declares the deadline missed below the grace window", () => {
      const result = evaluateRequest(
        request({ id: "r_1" }),
        context({ now: "2026-09-01T00:00:00.000Z" }),
      );
      expect(result.status).toBe("MISSED_DEADLINE");
      expect(result.explanation).toContain("cannot source this in time");
    });

    it("treats a request made after the event as missed rather than feasible", () => {
      const result = evaluateRequest(
        request({ id: "r_1" }),
        context({ now: "2026-09-10T00:00:00.000Z" }),
      );
      expect(result.status).toBe("MISSED_DEADLINE");
      expect(result.businessDaysRemaining).toBeLessThan(0);
    });

    it("shortens the runway when a campus holiday intervenes", () => {
      const withoutHoliday = evaluateRequest(
        request({ id: "r_1" }),
        context({ now: "2026-08-24T00:00:00.000Z" }),
      );
      const withHoliday = evaluateRequest(
        request({ id: "r_1" }),
        context({ now: "2026-08-24T00:00:00.000Z", holidays: ["2026-09-02", "2026-09-03"] }),
      );

      expect(withoutHoliday.status).toBe("FEASIBLE");
      expect(withHoliday.businessDaysRemaining).toBe(8);
      expect(withHoliday.status).toBe("AT_RISK");
    });

    it("applies each type's own lead time rather than a shared one", () => {
      const ctx = context({ now: "2026-09-02T00:00:00.000Z" });

      // Three business days remain: too late for an interpreter, fine for a
      // service animal, which only needs the organiser warned.
      expect(evaluateRequest(request({ id: "r_1", type: "ASL_INTERPRETER" }), ctx).status).toBe(
        "MISSED_DEADLINE",
      );
      expect(evaluateRequest(request({ id: "r_2", type: "SERVICE_ANIMAL" }), ctx).status).toBe(
        "FEASIBLE",
      );
    });
  });

  describe("venue cross-checks", () => {
    it("marks a request the room already satisfies", () => {
      const looped = {
        ...ACCESSIBLE_VENUE,
        features: { ...ACCESSIBLE_VENUE.features, hearing_loop: true },
      };
      const result = evaluateRequest(
        request({ id: "r_1", type: "ASSISTIVE_LISTENING" }),
        context({ venue: looped }),
      );

      expect(result.status).toBe("SATISFIED_BY_VENUE");
      expect(result.needsOrganiserAction).toBe(false);
    });

    it("still requires procurement when the room lacks the feature", () => {
      const result = evaluateRequest(
        request({ id: "r_1", type: "ASSISTIVE_LISTENING" }),
        context({ now: "2026-08-24T00:00:00.000Z" }),
      );
      expect(result.status).toBe("FEASIBLE");
    });

    it("reports an incompatible room as a venue change, not a booking", () => {
      const noRamp = {
        ...ACCESSIBLE_VENUE,
        features: { ...ACCESSIBLE_VENUE.features, wheelchair_ramp: false },
      };
      const result = evaluateRequest(
        request({ id: "r_1", type: "WHEELCHAIR_SEATING" }),
        context({ venue: noRamp }),
      );

      expect(result.status).toBe("VENUE_INCOMPATIBLE");
      expect(result.explanation).toContain("venue change");
    });

    it("prefers the incompatibility verdict over the lead time", () => {
      // No amount of notice fixes a room without a ramp, so that has to be the
      // message even when the request arrived in good time.
      const noRamp = {
        ...ACCESSIBLE_VENUE,
        features: { ...ACCESSIBLE_VENUE.features, wheelchair_ramp: false },
      };
      const result = evaluateRequest(
        request({ id: "r_1", type: "WHEELCHAIR_SEATING" }),
        context({ venue: noRamp, now: "2026-06-01T00:00:00.000Z" }),
      );
      expect(result.status).toBe("VENUE_INCOMPATIBLE");
    });

    it("treats a missing feature key as absent rather than permitted", () => {
      const unknown: VenueCapability = { venueId: "v_x", features: {}, resources: {} };
      const result = evaluateRequest(
        request({ id: "r_1", type: "WHEELCHAIR_SEATING" }),
        context({ venue: unknown }),
      );
      expect(result.status).toBe("VENUE_INCOMPATIBLE");
    });
  });

  describe("finite resource contention", () => {
    it("allocates in submission order and reports the overflow", () => {
      const requests = [
        request({
          id: "r_3",
          type: "WHEELCHAIR_SEATING",
          requesterId: "u_3",
          submittedAt: "2026-08-19T00:00:00.000Z",
        }),
        request({
          id: "r_1",
          type: "WHEELCHAIR_SEATING",
          requesterId: "u_1",
          submittedAt: "2026-08-17T00:00:00.000Z",
        }),
        request({
          id: "r_2",
          type: "WHEELCHAIR_SEATING",
          requesterId: "u_2",
          submittedAt: "2026-08-18T00:00:00.000Z",
        }),
      ];

      const results = evaluateRequests(requests, context());

      expect(results.map((r) => r.request.id)).toEqual(["r_1", "r_2", "r_3"]);
      expect(results[0].status).toBe("FEASIBLE");
      expect(results[1].status).toBe("FEASIBLE");
      expect(results[2].status).toBe("OVER_CAPACITY");
      expect(results[2].explanation).toContain("cannot be seated here");
    });

    it("breaks submission-time ties deterministically by id", () => {
      const sameInstant = "2026-08-17T00:00:00.000Z";
      const requests = [
        request({ id: "r_b", type: "WHEELCHAIR_SEATING", submittedAt: sameInstant }),
        request({ id: "r_a", type: "WHEELCHAIR_SEATING", submittedAt: sameInstant }),
        request({ id: "r_c", type: "WHEELCHAIR_SEATING", submittedAt: sameInstant }),
      ];

      const first = evaluateRequests(requests, context()).map((r) => r.request.id);
      const second = evaluateRequests([...requests].reverse(), context()).map((r) => r.request.id);

      expect(first).toEqual(["r_a", "r_b", "r_c"]);
      expect(second).toEqual(first);
    });

    it("does not let a withdrawn request hold a space", () => {
      const requests = [
        request({
          id: "r_1",
          type: "WHEELCHAIR_SEATING",
          submittedAt: "2026-08-17T00:00:00.000Z",
          state: "WITHDRAWN",
        }),
        request({ id: "r_2", type: "WHEELCHAIR_SEATING", submittedAt: "2026-08-18T00:00:00.000Z" }),
        request({ id: "r_3", type: "WHEELCHAIR_SEATING", submittedAt: "2026-08-19T00:00:00.000Z" }),
      ];

      const results = evaluateRequests(requests, context());
      expect(results.map((r) => r.status)).toEqual(["FEASIBLE", "FEASIBLE", "FEASIBLE"]);
    });

    it("does not let a declined request hold a space", () => {
      const requests = [
        request({
          id: "r_1",
          type: "WHEELCHAIR_SEATING",
          submittedAt: "2026-08-17T00:00:00.000Z",
          state: "DECLINED",
        }),
        request({ id: "r_2", type: "WHEELCHAIR_SEATING", submittedAt: "2026-08-18T00:00:00.000Z" }),
        request({ id: "r_3", type: "WHEELCHAIR_SEATING", submittedAt: "2026-08-19T00:00:00.000Z" }),
      ];

      expect(evaluateRequests(requests, context()).every((r) => r.status === "FEASIBLE")).toBe(
        true,
      );
    });

    it("counts each resource pool independently", () => {
      const requests = [
        request({ id: "r_1", type: "WHEELCHAIR_SEATING", submittedAt: "2026-08-17T00:00:00.000Z" }),
        request({ id: "r_2", type: "COMPANION_SEAT", submittedAt: "2026-08-17T01:00:00.000Z" }),
        request({ id: "r_3", type: "WHEELCHAIR_SEATING", submittedAt: "2026-08-17T02:00:00.000Z" }),
        request({ id: "r_4", type: "COMPANION_SEAT", submittedAt: "2026-08-17T03:00:00.000Z" }),
      ];

      expect(evaluateRequests(requests, context()).every((r) => r.status === "FEASIBLE")).toBe(
        true,
      );
    });

    it("treats an unlisted resource as a supply of zero", () => {
      const bare: VenueCapability = {
        venueId: "v_bare",
        features: { wheelchair_ramp: true },
        resources: {},
      };
      const results = evaluateRequests(
        [request({ id: "r_1", type: "WHEELCHAIR_SEATING" })],
        context({ venue: bare }),
      );
      expect(results[0].status).toBe("OVER_CAPACITY");
    });

    it("does not consume a space for a request the venue already satisfies", () => {
      const lowSensory = {
        ...ACCESSIBLE_VENUE,
        features: { ...ACCESSIBLE_VENUE.features, low_sensory_zone: true },
      };
      const requests = [
        request({ id: "r_1", type: "QUIET_ROOM", submittedAt: "2026-08-17T00:00:00.000Z" }),
        request({ id: "r_2", type: "QUIET_ROOM", submittedAt: "2026-08-18T00:00:00.000Z" }),
      ];

      const results = evaluateRequests(requests, context({ venue: lowSensory }));
      expect(results.map((r) => r.status)).toEqual(["SATISFIED_BY_VENUE", "SATISFIED_BY_VENUE"]);
    });
  });

  describe("standing accommodations", () => {
    const standing: StandingAccommodation[] = [
      {
        id: "s_1",
        userId: "u_1",
        type: "CART_CAPTIONING",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        privateNote: "On file with disability services",
      },
      {
        id: "s_2",
        userId: "u_2",
        type: "ASL_INTERPRETER",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    ];

    it("generates a request for each attending student on file", () => {
      const generated = expandStandingAccommodations(standing, ["u_1", "u_2"], context());
      expect(generated).toHaveLength(2);
      expect(generated.map((r) => r.requesterId)).toEqual(["u_1", "u_2"]);
      expect(generated[0].fromStandingId).toBe("s_1");
    });

    it("ignores students who are not attending", () => {
      const generated = expandStandingAccommodations(standing, ["u_2"], context());
      expect(generated.map((r) => r.requesterId)).toEqual(["u_2"]);
    });

    it("does not double-book an accommodation already requested by hand", () => {
      const existing = [request({ id: "r_1", requesterId: "u_1", type: "CART_CAPTIONING" })];
      const generated = expandStandingAccommodations(standing, ["u_1", "u_2"], context(), existing);

      expect(generated.map((r) => r.requesterId)).toEqual(["u_2"]);
    });

    it("re-generates when the earlier request was withdrawn", () => {
      const existing = [
        request({ id: "r_1", requesterId: "u_1", type: "CART_CAPTIONING", state: "WITHDRAWN" }),
      ];
      const generated = expandStandingAccommodations(standing, ["u_1", "u_2"], context(), existing);

      expect(generated.map((r) => r.requesterId)).toEqual(["u_1", "u_2"]);
    });

    it("ignores an existing request belonging to a different event", () => {
      const existing = [
        request({ id: "r_1", requesterId: "u_1", type: "CART_CAPTIONING", eventId: "e_other" }),
      ];
      const generated = expandStandingAccommodations(standing, ["u_1"], context(), existing);
      expect(generated).toHaveLength(1);
    });

    it("tests the effective window against the event, not against today", () => {
      const lapsed: StandingAccommodation[] = [
        {
          id: "s_3",
          userId: "u_3",
          type: "QUIET_ROOM",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          effectiveUntil: "2026-09-01T00:00:00.000Z",
        },
      ];

      // Still in force today, but expires before the event happens.
      const generated = expandStandingAccommodations(lapsed, ["u_3"], context());
      expect(generated).toHaveLength(0);
    });

    it("ignores an accommodation that only starts after the event", () => {
      const future: StandingAccommodation[] = [
        {
          id: "s_4",
          userId: "u_4",
          type: "QUIET_ROOM",
          effectiveFrom: "2026-10-01T00:00:00.000Z",
        },
      ];
      expect(expandStandingAccommodations(future, ["u_4"], context())).toHaveLength(0);
    });

    it("produces a stable id so repeated expansion is idempotent", () => {
      const first = expandStandingAccommodations(standing, ["u_1"], context());
      const second = expandStandingAccommodations(standing, ["u_1"], context());
      expect(first[0].id).toBe(second[0].id);
    });
  });

  describe("organiser summary", () => {
    const requests = [
      request({ id: "r_1", requesterId: "u_1", type: "ASL_INTERPRETER", privateNote: "medical" }),
      request({ id: "r_2", requesterId: "u_2", type: "ASL_INTERPRETER" }),
      request({ id: "r_3", requesterId: "u_3", type: "WHEELCHAIR_SEATING" }),
    ];

    it("counts what has to be arranged", () => {
      const summary = buildFulfilmentSummary(evaluateRequests(requests, context()));
      const interpreters = summary.find((line) => line.type === "ASL_INTERPRETER");

      expect(interpreters?.count).toBe(2);
      expect(interpreters?.fulfiller).toBe("DISABILITY_SERVICES");
    });

    it("carries no requester identity or private note", () => {
      const summary = buildFulfilmentSummary(evaluateRequests(requests, context()));
      const serialised = JSON.stringify(summary);

      expect(serialised).not.toContain("u_1");
      expect(serialised).not.toContain("medical");
    });

    it("excludes withdrawn requests from the count", () => {
      const withWithdrawal = [
        ...requests,
        request({ id: "r_4", requesterId: "u_4", type: "ASL_INTERPRETER", state: "WITHDRAWN" }),
      ];
      const summary = buildFulfilmentSummary(evaluateRequests(withWithdrawal, context()));

      expect(summary.find((line) => line.type === "ASL_INTERPRETER")?.count).toBe(2);
    });

    it("flags the line an organiser has to act on", () => {
      const summary = buildFulfilmentSummary(
        evaluateRequests(requests, context({ now: "2026-09-03T00:00:00.000Z" })),
      );
      expect(summary.find((line) => line.type === "ASL_INTERPRETER")?.needsAttention).toBe(true);
    });

    it("is ordered deterministically", () => {
      const summary = buildFulfilmentSummary(evaluateRequests(requests, context()));
      expect(summary.map((line) => line.type)).toEqual([...summary.map((l) => l.type)].sort());
    });
  });

  describe("identified manifest", () => {
    const requests = [
      request({
        id: "r_1",
        requesterId: "u_2",
        type: "ASL_INTERPRETER",
        privateNote: "needs front row",
      }),
      request({ id: "r_2", requesterId: "u_1", type: "WHEELCHAIR_SEATING" }),
      request({ id: "r_3", requesterId: "u_3", type: "PERSONAL_AIDE" }),
    ];

    it("returns only the rows belonging to the named fulfiller", () => {
      const manifest = buildIdentifiedManifest(
        evaluateRequests(requests, context()),
        "DISABILITY_SERVICES",
      );

      expect(manifest).toHaveLength(1);
      expect(manifest[0].requesterId).toBe("u_2");
      expect(manifest[0].privateNote).toBe("needs front row");
    });

    it("routes venue work separately from organiser work", () => {
      const evaluations = evaluateRequests(requests, context());
      expect(buildIdentifiedManifest(evaluations, "VENUE").map((l) => l.type)).toEqual([
        "WHEELCHAIR_SEATING",
      ]);
      expect(buildIdentifiedManifest(evaluations, "ORGANISER").map((l) => l.type)).toEqual([
        "PERSONAL_AIDE",
      ]);
    });

    it("normalises an absent note to null rather than undefined", () => {
      const manifest = buildIdentifiedManifest(evaluateRequests(requests, context()), "VENUE");
      expect(manifest[0].privateNote).toBeNull();
    });
  });

  describe("escalation queue", () => {
    it("surfaces only unacknowledged requests in trouble, most urgent first", () => {
      const requests = [
        request({ id: "r_ok", type: "SERVICE_ANIMAL" }),
        request({ id: "r_late", type: "ASL_INTERPRETER" }),
        request({ id: "r_done", type: "ASL_INTERPRETER", state: "ARRANGED" }),
      ];

      const queue = findUnactionedRequests(
        evaluateRequests(requests, context({ now: "2026-09-02T00:00:00.000Z" })),
      );

      expect(queue.map((entry) => entry.request.id)).toEqual(["r_late"]);
    });

    it("includes capacity and venue failures, not just late ones", () => {
      const requests = [
        request({ id: "r_1", type: "WHEELCHAIR_SEATING", submittedAt: "2026-08-17T00:00:00.000Z" }),
        request({ id: "r_2", type: "WHEELCHAIR_SEATING", submittedAt: "2026-08-18T00:00:00.000Z" }),
        request({ id: "r_3", type: "WHEELCHAIR_SEATING", submittedAt: "2026-08-19T00:00:00.000Z" }),
      ];

      const queue = findUnactionedRequests(evaluateRequests(requests, context()));
      expect(queue.map((entry) => entry.request.id)).toEqual(["r_3"]);
      expect(queue[0].status).toBe("OVER_CAPACITY");
    });

    it("is empty when everything is in hand", () => {
      const requests = [request({ id: "r_1", state: "ARRANGED" })];
      expect(findUnactionedRequests(evaluateRequests(requests, context()))).toEqual([]);
    });
  });

  describe("catalogue invariants", () => {
    it("gives every type a grace window no longer than its lead time", () => {
      for (const type of ALL_ACCOMMODATION_TYPES) {
        const spec = ACCOMMODATION_SPECS[type];
        expect(spec.atRiskGraceBusinessDays).toBeLessThanOrEqual(spec.leadTimeBusinessDays);
        expect(spec.leadTimeBusinessDays).toBeGreaterThan(0);
      }
    });

    it("keys every spec by its own type", () => {
      for (const type of ALL_ACCOMMODATION_TYPES) {
        expect(ACCOMMODATION_SPECS[type].type).toBe(type);
      }
    });

    it("gives every resource-consuming type a positive unit cost", () => {
      for (const type of ALL_ACCOMMODATION_TYPES) {
        const spec = ACCOMMODATION_SPECS[type];
        if (spec.consumes) {
          expect(spec.consumesUnits ?? 1).toBeGreaterThan(0);
        }
      }
    });
  });
});
