// =============================================================================
// Tests: Automated "Graduating Senior" Email Forwarding (#4425)
// Covers the full audit -> inheritance prompt -> accept/decline lifecycle,
// provider routing payloads and expiry fallbacks.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import {
  EmailAliasForwardingService,
  aliasAddressForRole,
  isExternalMailRole,
  runGraduateAliasAudit,
  OFFER_TTL_DAYS,
} from "./emailAliasForwardingService";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeService(now = new Date("2026-08-24T00:00:00Z")) {
  let counter = 0;
  return new EmailAliasForwardingService(
    () => now,
    () => `id_${++counter}`,
  );
}

const presidentRoute = {
  clubId: "club-1",
  roleTitle: "President",
  clubName: "Tech Club",
  holderUserId: "grad-1",
  forwardToInbox: "aarav@campus.edu",
  provider: "mailgun" as const,
};

describe("isExternalMailRole / aliasAddressForRole (#4425)", () => {
  it("recognises roles that receive external mail, case-insensitively", () => {
    expect(isExternalMailRole("President")).toBe(true);
    expect(isExternalMailRole("vice president")).toBe(true);
    expect(isExternalMailRole("Member")).toBe(false);
    expect(isExternalMailRole("")).toBe(false);
  });

  it("slugifies club + role into the external alias address", () => {
    expect(aliasAddressForRole("Tech Club", "President")).toBe(
      "president@techclub.campusconnect.edu",
    );
    expect(aliasAddressForRole("Design & Innovation Society", "Vice President")).toBe(
      "vicepresident@designinnovationsociety.campusconnect.edu",
    );
  });
});

describe("auditGraduatingHolders (#4425)", () => {
  it("flags graduating officers holding an active alias and prompts their successor", () => {
    const svc = makeService();
    svc.registerRoute(presidentRoute);
    svc.registerSuccessor("club-1", "President", {
      userId: "incoming-1",
      inboxAddress: "priya@campus.edu",
    });

    const result = svc.auditGraduatingHolders([
      { userId: "grad-1", clubId: "club-1", roleTitle: "President" },
    ]);

    expect(result.unstaffedHandovers).toHaveLength(0);
    expect(result.offers).toHaveLength(1);
    const offer = result.offers[0];
    expect(offer.aliasAddress).toBe("president@techclub.campusconnect.edu");
    expect(offer.successorUserId).toBe("incoming-1");
    expect(offer.outgoingHolderUserId).toBe("grad-1");
    expect(offer.status).toBe("PENDING");
    expect(offer.expiresAt.getTime() - offer.createdAt.getTime()).toBe(OFFER_TTL_DAYS * DAY_MS);

    // The route is suspended mid-handover but still forwards to the graduate
    // until the successor answers, so sponsor threads never hard-bounce.
    expect(svc.getRoute(offer.aliasId)!.status).toBe("PENDING_HANDOVER");
    expect(svc.pendingOffersForUser("incoming-1")).toHaveLength(1);
  });

  it("ignores members without an eligible external-mail role", () => {
    const svc = makeService();
    svc.registerRoute(presidentRoute);

    const result = svc.auditGraduatingHolders([
      { userId: "grad-1", clubId: "club-1", roleTitle: "Member" },
    ]);
    expect(result.offers).toHaveLength(0);
    expect(result.unstaffedHandovers).toHaveLength(0);
  });

  it("reports unstaffed handovers when no successor is registered", () => {
    const svc = makeService();
    const route = svc.registerRoute(presidentRoute);

    const result = svc.auditGraduatingHolders([
      { userId: "grad-1", clubId: "club-1", roleTitle: "president" }, // case-insensitive
    ]);

    expect(result.offers).toHaveLength(0);
    expect(result.unstaffedHandovers).toEqual([
      expect.objectContaining({
        aliasAddress: "president@techclub.campusconnect.edu",
        reason: "NO_SUCCESSOR_REGISTERED",
      }),
    ]);
    // Route stays ACTIVE with the outgoing holder until a successor exists.
    expect(svc.getRoute(route.aliasId)!.status).toBe("ACTIVE");
  });

  it("does not prompt a graduate to inherit their own alias", () => {
    const svc = makeService();
    svc.registerRoute(presidentRoute);
    svc.registerSuccessor("club-1", "President", {
      userId: "grad-1",
      inboxAddress: "aarav@campus.edu",
    });

    const result = svc.auditGraduatingHolders([
      { userId: "grad-1", clubId: "club-1", roleTitle: "President" },
    ]);
    expect(result.offers).toHaveLength(0);
    expect(result.unstaffedHandovers).toHaveLength(1);
  });
});

describe("acceptOffer (#4425)", () => {
  function offerAcceptedSetup() {
    const svc = makeService();
    svc.registerRoute(presidentRoute);
    svc.registerSuccessor("club-1", "President", {
      userId: "incoming-1",
      inboxAddress: "priya@campus.edu",
    });
    const { offers } = svc.auditGraduatingHolders([
      { userId: "grad-1", clubId: "club-1", roleTitle: "President" },
    ]);
    return { svc, offerId: offers[0].offerId };
  }

  it("re-maps the routing rule so the alias forwards to the successor's inbox", () => {
    const { svc, offerId } = offerAcceptedSetup();

    const { offer, route, routingUpdate } = svc.acceptOffer(offerId, "incoming-1");

    expect(offer.status).toBe("ACCEPTED");
    expect(offer.respondedAt).not.toBeNull();

    // Same public address sponsors already know...
    expect(route.aliasAddress).toBe("president@techclub.campusconnect.edu");
    // ...new destination.
    expect(route.holderUserId).toBe("incoming-1");
    expect(route.forwardToInbox).toBe("priya@campus.edu");
    expect(route.status).toBe("ACTIVE");
    expect(route.generation).toBe(1);

    expect(routingUpdate.action).toBe("UPDATE_ROUTE");
    expect(routingUpdate.provider).toBe("mailgun");
    expect(routingUpdate.payload.expression).toBe(
      "match_recipient('president@techclub.campusconnect.edu')",
    );
    expect(routingUpdate.payload.action).toContain("forward('priya@campus.edu')");
  });

  it("rejects responses from anyone who is not the offered successor", () => {
    const { svc, offerId } = offerAcceptedSetup();
    expect(() => svc.acceptOffer(offerId, "random-user")).toThrow(/successor/i);
  });

  it("cannot accept twice", () => {
    const { svc, offerId } = offerAcceptedSetup();
    svc.acceptOffer(offerId, "incoming-1");
    expect(() => svc.acceptOffer(offerId, "incoming-1")).toThrow(/already accepted/i);
  });

  it("cannot accept an expired offer; expiry suspends to the club fallback", () => {
    const svc = new EmailAliasForwardingService(() => new Date("2026-08-24T00:00:00Z"));
    svc.registerFallbackInbox("club-1", "advisor@campus.edu");
    svc.registerRoute(presidentRoute);
    svc.registerSuccessor("club-1", "President", {
      userId: "incoming-1",
      inboxAddress: "priya@campus.edu",
    });
    const { offers } = svc.auditGraduatingHolders([
      { userId: "grad-1", clubId: "club-1", roleTitle: "President" },
    ]);

    const dayAfterTtl = new Date(
      Date.parse("2026-08-24T00:00:00Z") + (OFFER_TTL_DAYS + 1) * DAY_MS,
    );
    expect(() => svc.acceptOffer(offers[0].offerId, "incoming-1", dayAfterTtl)).toThrow(/expired/i);

    // The late attempt itself finalises the expiry...
    expect(svc.getOffer(offers[0].offerId)!.status).toBe("EXPIRED");
    const route = svc.getRoute(offers[0].aliasId)!;
    // ...and sponsor mail lands with the advisor instead of bouncing.
    expect(route.forwardToInbox).toBe("advisor@campus.edu");
    expect(route.generation).toBe(1);

    // A later sweep finds nothing further to do.
    expect(svc.expireStaleOffers(dayAfterTtl)).toHaveLength(0);
  });

  it("sweeps offers that were never answered into the club fallback inbox", () => {
    const svc = makeService();
    svc.registerFallbackInbox("club-1", "advisor@campus.edu");
    svc.registerRoute(presidentRoute);
    svc.registerSuccessor("club-1", "President", {
      userId: "incoming-1",
      inboxAddress: "priya@campus.edu",
    });
    const { offers } = svc.auditGraduatingHolders([
      { userId: "grad-1", clubId: "club-1", roleTitle: "President" },
    ]);

    const dayAfterTtl = new Date(
      Date.parse("2026-08-24T00:00:00Z") + (OFFER_TTL_DAYS + 1) * DAY_MS,
    );
    const expired = svc.expireStaleOffers(dayAfterTtl);
    expect(expired.map((o) => o.offerId)).toEqual([offers[0].offerId]);
    expect(svc.getRoute(offers[0].aliasId)!.forwardToInbox).toBe("advisor@campus.edu");
  });
});

describe("declineOffer (#4425)", () => {
  it("releases the alias when declined and no fallback exists", () => {
    const svc = makeService();
    svc.registerRoute(presidentRoute);
    svc.registerSuccessor("club-1", "President", {
      userId: "incoming-1",
      inboxAddress: "priya@campus.edu",
    });
    const { offers } = svc.auditGraduatingHolders([
      { userId: "grad-1", clubId: "club-1", roleTitle: "President" },
    ]);

    const { route } = svc.declineOffer(offers[0].offerId, "incoming-1");
    expect(route.status).toBe("RELEASED");

    // Once released, next year's election can register the address afresh.
    expect(() =>
      svc.registerRoute({
        ...presidentRoute,
        holderUserId: "someone-else",
      }),
    ).not.toThrow();
  });

  it("hands a declined alias to the club fallback inbox when registered", () => {
    const svc = makeService();
    svc.registerFallbackInbox("club-1", "advisor@campus.edu");
    svc.registerRoute(presidentRoute);
    svc.registerSuccessor("club-1", "President", {
      userId: "incoming-1",
      inboxAddress: "priya@campus.edu",
    });
    const { offers } = svc.auditGraduatingHolders([
      { userId: "grad-1", clubId: "club-1", roleTitle: "President" },
    ]);

    const { route, routingUpdate } = svc.declineOffer(offers[0].offerId, "incoming-1");
    expect(route.status).toBe("ACTIVE");
    expect(route.forwardToInbox).toBe("advisor@campus.edu");
    expect(routingUpdate!.payload.action).toContain("forward('advisor@campus.edu')");
  });
});

describe("provider payloads (#4425)", () => {
  it("builds SendGrid inbound-parse updates", () => {
    const svc = makeService();
    const route = svc.registerRoute({ ...presidentRoute, provider: "sendgrid" });
    const update = svc.buildRoutingUpdate(route);
    expect(update.payload.hostname).toBe("techclub.campusconnect.edu");
    expect(update.payload.url).toContain("/forward/aarav%40campus.edu");
  });

  it("defaults to the mock provider payload when no provider is configured", () => {
    const svc = makeService();
    const route = svc.registerRoute({ ...presidentRoute, provider: undefined });
    const update = svc.buildRoutingUpdate(route);
    expect(update.provider).toBe("mock");
    expect(update.payload.note).toMatch(/no provider credentials/i);
  });
});

describe("runGraduateAliasAudit (#4425 audit_graduates entry point)", () => {
  it("creates and delivers inheritance offers for graduating alias holders", async () => {
    const persistOffer = vi.fn().mockResolvedValue(undefined);
    const notifySuccessor = vi.fn().mockResolvedValue(undefined);

    const result = await runGraduateAliasAudit({
      graduatingHolders: [
        { userId: "grad-1", clubId: "club-1", roleTitle: "President" },
        // A second graduate whose role carries no external alias duty.
        { userId: "grad-2", clubId: "club-1", roleTitle: "Member" },
      ],
      activeRoutes: [
        {
          aliasId: "route-1",
          clubId: "club-1",
          aliasAddress: "president@techclub.campusconnect.edu",
          roleTitle: "President",
          holderUserId: "grad-1",
          forwardToInbox: "aarav@campus.edu",
          provider: "sendgrid",
          providerRouteId: "sg-route-77",
          status: "ACTIVE",
          generation: 0,
        },
      ],
      successors: new Map([
        ["club-1::president", { userId: "incoming-1", inboxAddress: "priya@campus.edu" }],
      ]),
      persistOffer,
      notifySuccessor,
    });

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].successorUserId).toBe("incoming-1");
    expect(persistOffer).toHaveBeenCalledTimes(1);
    expect(notifySuccessor).toHaveBeenCalledWith(
      expect.objectContaining({ offerId: result.offers[0].offerId }),
    );
  });

  it("warns instead of prompting when a successor was never registered", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const notifySuccessor = vi.fn();

    const result = await runGraduateAliasAudit({
      graduatingHolders: [{ userId: "grad-1", clubId: "club-1", roleTitle: "Treasurer" }],
      activeRoutes: [
        {
          aliasId: "route-2",
          clubId: "club-1",
          aliasAddress: "treasurer@techclub.campusconnect.edu",
          roleTitle: "Treasurer",
          holderUserId: "grad-1",
          forwardToInbox: "aarav@campus.edu",
          provider: "mock",
          providerRouteId: null,
          status: "ACTIVE",
          generation: 3,
        },
      ],
      notifySuccessor,
    });

    expect(result.offers).toHaveLength(0);
    expect(result.unstaffedHandovers).toHaveLength(1);
    expect(notifySuccessor).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/without an identified successor/));
    warnSpy.mockRestore();
  });
});
