import { describe, it, expect } from "vitest";
import {
  ALL_SCOPES,
  DEFAULT_WHEN_ABSENT,
  relevantRecords,
  evaluateConsent,
  evaluateAllScopes,
  filterTaggableMatches,
  withdrawConsent,
  findExpiringConsents,
  wasPublicationCovered,
  type ConsentRecord,
  type PublishedAsset,
} from "./photoConsent";

const NOW = "2026-08-12T12:00:00.000Z";

function record(overrides: Partial<ConsentRecord> & { id: string }): ConsentRecord {
  return {
    userId: "u_1",
    scope: "PRESS_MARKETING",
    decision: "GRANTED",
    level: "ACCOUNT",
    recordedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Photo Consent Registry (#3138)", () => {
  describe("defaults in the absence of a record", () => {
    it("denies every outward-facing scope", () => {
      expect(DEFAULT_WHEN_ABSENT.PRESS_MARKETING).toBe("DENIED");
      expect(DEFAULT_WHEN_ABSENT.SOCIAL_MEDIA).toBe("DENIED");
      expect(DEFAULT_WHEN_ABSENT.PUBLIC_WEBSITE).toBe("DENIED");
    });

    it("permits only the members-only gallery by default", () => {
      expect(DEFAULT_WHEN_ABSENT.INTERNAL_GALLERY).toBe("GRANTED");
    });

    it("resolves an unknown user to the scope default", () => {
      const pressed = evaluateConsent([], { userId: "u_new", scope: "PRESS_MARKETING", now: NOW });
      expect(pressed.allowed).toBe(false);
      expect(pressed.reason).toBe("DEFAULT_DENY");
      expect(pressed.decidedBy).toBeNull();

      const gallery = evaluateConsent([], { userId: "u_new", scope: "INTERNAL_GALLERY", now: NOW });
      expect(gallery.allowed).toBe(true);
      expect(gallery.reason).toBe("DEFAULT_ALLOW");
    });
  });

  describe("record scoping", () => {
    it("ignores records for other users and other scopes", () => {
      const records = [
        record({ id: "c_1", userId: "u_2" }),
        record({ id: "c_2", scope: "SOCIAL_MEDIA" }),
        record({ id: "c_3" }),
      ];

      const applicable = relevantRecords(records, {
        userId: "u_1",
        scope: "PRESS_MARKETING",
        now: NOW,
      });
      expect(applicable.map((r) => r.id)).toEqual(["c_3"]);
    });

    it("only applies an event-level record to that event", () => {
      const records = [record({ id: "c_1", level: "EVENT", eventId: "evt_a" })];

      expect(
        relevantRecords(records, {
          userId: "u_1",
          scope: "PRESS_MARKETING",
          eventId: "evt_a",
          now: NOW,
        }),
      ).toHaveLength(1);

      expect(
        relevantRecords(records, {
          userId: "u_1",
          scope: "PRESS_MARKETING",
          eventId: "evt_b",
          now: NOW,
        }),
      ).toHaveLength(0);
    });
  });

  describe("precedence", () => {
    it("allows an outward-facing scope once granted at account level", () => {
      const evaluation = evaluateConsent([record({ id: "c_1" })], {
        userId: "u_1",
        scope: "PRESS_MARKETING",
        now: NOW,
      });

      expect(evaluation.allowed).toBe(true);
      expect(evaluation.reason).toBe("ACCOUNT_GRANT");
    });

    it("lets an event-level grant override the deny-by-default", () => {
      const records = [
        record({ id: "c_1", level: "EVENT", eventId: "evt_a", scope: "SOCIAL_MEDIA" }),
      ];

      const atEvent = evaluateConsent(records, {
        userId: "u_1",
        scope: "SOCIAL_MEDIA",
        eventId: "evt_a",
        now: NOW,
      });
      expect(atEvent.allowed).toBe(true);
      expect(atEvent.reason).toBe("EVENT_GRANT");

      const elsewhere = evaluateConsent(records, {
        userId: "u_1",
        scope: "SOCIAL_MEDIA",
        eventId: "evt_b",
        now: NOW,
      });
      expect(elsewhere.allowed).toBe(false);
      expect(elsewhere.reason).toBe("DEFAULT_DENY");
    });

    it("lets an explicit denial beat a grant at any level", () => {
      const records = [
        record({ id: "c_grant", level: "EVENT", eventId: "evt_a" }),
        record({ id: "c_deny", decision: "DENIED", level: "ACCOUNT" }),
      ];

      const evaluation = evaluateConsent(records, {
        userId: "u_1",
        scope: "PRESS_MARKETING",
        eventId: "evt_a",
        now: NOW,
      });

      expect(evaluation.allowed).toBe(false);
      expect(evaluation.reason).toBe("EXPLICIT_DENIAL");
      expect(evaluation.decidedBy?.id).toBe("c_deny");
    });

    it("lets a withdrawal beat everything else", () => {
      const records = [
        record({ id: "c_1", withdrawnAt: "2026-06-01T00:00:00.000Z" }),
        record({ id: "c_2", level: "EVENT", eventId: "evt_a" }),
      ];

      const evaluation = evaluateConsent(records, {
        userId: "u_1",
        scope: "PRESS_MARKETING",
        eventId: "evt_a",
        now: NOW,
      });

      expect(evaluation.allowed).toBe(false);
      expect(evaluation.reason).toBe("WITHDRAWN");
    });

    it("ignores a withdrawal dated in the future", () => {
      const evaluation = evaluateConsent(
        [record({ id: "c_1", withdrawnAt: "2026-12-01T00:00:00.000Z" })],
        { userId: "u_1", scope: "PRESS_MARKETING", now: NOW },
      );
      expect(evaluation.allowed).toBe(true);
    });
  });

  describe("expiry", () => {
    it("treats a lapsed media release as no release", () => {
      const evaluation = evaluateConsent(
        [record({ id: "c_1", expiresAt: "2026-07-31T23:59:59.000Z" })],
        { userId: "u_1", scope: "PRESS_MARKETING", now: NOW },
      );

      expect(evaluation.allowed).toBe(false);
      expect(evaluation.reason).toBe("EXPIRED");
      expect(evaluation.explanation).toContain("lapsed");
    });

    it("does not fall back to a permissive default when a grant has lapsed", () => {
      // INTERNAL_GALLERY is allowed by default, but an explicit grant that has
      // since lapsed must not silently resolve back to that default.
      const evaluation = evaluateConsent(
        [
          record({
            id: "c_1",
            scope: "INTERNAL_GALLERY",
            expiresAt: "2026-07-31T23:59:59.000Z",
          }),
        ],
        { userId: "u_1", scope: "INTERNAL_GALLERY", now: NOW },
      );

      expect(evaluation.allowed).toBe(false);
      expect(evaluation.reason).toBe("EXPIRED");
    });

    it("honours a grant that has not yet lapsed", () => {
      const evaluation = evaluateConsent(
        [record({ id: "c_1", expiresAt: "2026-09-30T00:00:00.000Z" })],
        { userId: "u_1", scope: "PRESS_MARKETING", now: NOW },
      );
      expect(evaluation.allowed).toBe(true);
    });

    it("lists releases lapsing inside the renewal window", () => {
      const records = [
        record({ id: "c_soon", expiresAt: "2026-08-20T00:00:00.000Z" }),
        record({ id: "c_later", expiresAt: "2026-11-01T00:00:00.000Z" }),
        record({ id: "c_gone", expiresAt: "2026-01-01T00:00:00.000Z" }),
        record({ id: "c_none" }),
      ];

      expect(findExpiringConsents(records, NOW, 30).map((r) => r.id)).toEqual(["c_soon"]);
      expect(findExpiringConsents(records, NOW, 120).map((r) => r.id)).toEqual([
        "c_soon",
        "c_later",
      ]);
    });

    it("excludes an already withdrawn release from the renewal prompt", () => {
      const records = [
        record({
          id: "c_soon",
          expiresAt: "2026-08-20T00:00:00.000Z",
          withdrawnAt: "2026-08-01T00:00:00.000Z",
        }),
      ];
      expect(findExpiringConsents(records, NOW, 30)).toHaveLength(0);
    });
  });

  describe("scope independence", () => {
    it("lets someone appear in the club gallery but not in press material", () => {
      const records = [
        record({ id: "c_1", scope: "INTERNAL_GALLERY", decision: "GRANTED" }),
        record({ id: "c_2", scope: "PRESS_MARKETING", decision: "DENIED" }),
      ];

      const all = evaluateAllScopes(records, "u_1", NOW);
      expect(all.INTERNAL_GALLERY.allowed).toBe(true);
      expect(all.PRESS_MARKETING.allowed).toBe(false);
      expect(all.SOCIAL_MEDIA.allowed).toBe(false);
      expect(Object.keys(all)).toHaveLength(ALL_SCOPES.length);
    });
  });

  describe("auto-tagging gate", () => {
    const matches = [
      { photoId: "ph_1", userId: "u_1", confidence: 0.94 },
      { photoId: "ph_1", userId: "u_2", confidence: 0.88 },
      { photoId: "ph_2", userId: "u_3", confidence: 0.91 },
    ];

    it("drops matches for people who have not consented to the scope", () => {
      const records = [record({ id: "c_1", userId: "u_1", scope: "PUBLIC_WEBSITE" })];

      const { taggable, suppressed } = filterTaggableMatches(
        matches,
        records,
        "PUBLIC_WEBSITE",
        NOW,
      );

      expect(taggable.map((m) => m.userId)).toEqual(["u_1"]);
      expect(suppressed.map((s) => s.match.userId)).toEqual(["u_2", "u_3"]);
      expect(suppressed[0].reason).toBe("DEFAULT_DENY");
    });

    it("suppresses a match for someone who has explicitly opted out", () => {
      const records = [
        record({ id: "c_1", userId: "u_1", scope: "INTERNAL_GALLERY", decision: "DENIED" }),
      ];

      const { taggable, suppressed } = filterTaggableMatches(
        matches,
        records,
        "INTERNAL_GALLERY",
        NOW,
      );

      expect(taggable.map((m) => m.userId)).toEqual(["u_2", "u_3"]);
      expect(suppressed).toHaveLength(1);
      expect(suppressed[0].reason).toBe("EXPLICIT_DENIAL");
    });
  });

  describe("withdrawal", () => {
    const assets: PublishedAsset[] = [
      {
        assetId: "as_1",
        photoId: "ph_1",
        userId: "u_1",
        scope: "SOCIAL_MEDIA",
        publishedAt: "2026-03-01T00:00:00.000Z",
        location: "instagram/post/1",
      },
      {
        assetId: "as_2",
        photoId: "ph_2",
        userId: "u_1",
        scope: "INTERNAL_GALLERY",
        publishedAt: "2026-03-02T00:00:00.000Z",
        location: "gallery/2",
      },
      {
        assetId: "as_3",
        photoId: "ph_3",
        userId: "u_2",
        scope: "SOCIAL_MEDIA",
        publishedAt: "2026-03-03T00:00:00.000Z",
        location: "instagram/post/3",
      },
    ];

    it("returns the concrete assets that now need redacting", () => {
      const { redactions } = withdrawConsent(
        [record({ id: "c_1", scope: "SOCIAL_MEDIA" })],
        assets,
        {
          userId: "u_1",
          scope: "SOCIAL_MEDIA",
          withdrawnAt: NOW,
        },
      );

      expect(redactions.map((r) => r.assetId)).toEqual(["as_1"]);
      expect(redactions[0].location).toBe("instagram/post/1");
      expect(redactions[0].reason).toContain("withdrawn");
    });

    it("stamps the withdrawal onto the matching records only", () => {
      const records = [
        record({ id: "c_1", scope: "SOCIAL_MEDIA" }),
        record({ id: "c_2", scope: "INTERNAL_GALLERY" }),
      ];

      const { records: updated } = withdrawConsent(records, assets, {
        userId: "u_1",
        scope: "SOCIAL_MEDIA",
        withdrawnAt: NOW,
      });

      expect(updated.find((r) => r.id === "c_1")?.withdrawnAt).toBe(NOW);
      expect(updated.find((r) => r.id === "c_2")?.withdrawnAt).toBeUndefined();
    });

    it("makes the scope evaluate as denied immediately afterwards", () => {
      const { records: updated } = withdrawConsent(
        [record({ id: "c_1", scope: "SOCIAL_MEDIA" })],
        assets,
        { userId: "u_1", scope: "SOCIAL_MEDIA", withdrawnAt: NOW },
      );

      const evaluation = evaluateConsent(updated, {
        userId: "u_1",
        scope: "SOCIAL_MEDIA",
        now: "2026-08-12T12:00:01.000Z",
      });
      expect(evaluation.allowed).toBe(false);
      expect(evaluation.reason).toBe("WITHDRAWN");
    });
  });

  describe("retrospective review", () => {
    const asset: PublishedAsset = {
      assetId: "as_1",
      photoId: "ph_1",
      userId: "u_1",
      scope: "PRESS_MARKETING",
      publishedAt: "2026-04-01T00:00:00.000Z",
      location: "prospectus/p12",
    };

    it("confirms a publication that was covered at the time", () => {
      const records = [record({ id: "c_1", recordedAt: "2026-01-01T00:00:00.000Z" })];
      expect(wasPublicationCovered(records, asset).allowed).toBe(true);
    });

    it("does not let a later grant retroactively justify a publication", () => {
      const records = [record({ id: "c_1", recordedAt: "2026-06-01T00:00:00.000Z" })];
      const outcome = wasPublicationCovered(records, asset);

      expect(outcome.allowed).toBe(false);
      expect(outcome.reason).toBe("DEFAULT_DENY");
    });

    it("still reports a publication as covered when consent was withdrawn afterwards", () => {
      const records = [
        record({
          id: "c_1",
          recordedAt: "2026-01-01T00:00:00.000Z",
          withdrawnAt: "2026-07-01T00:00:00.000Z",
        }),
      ];

      expect(wasPublicationCovered(records, asset).allowed).toBe(true);
    });
  });
});
