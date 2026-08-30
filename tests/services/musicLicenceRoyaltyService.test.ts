/**
 * Test suite: Live Music Licensing Royalty Accrual (#4704)
 * File: tests/services/musicLicenceRoyaltyService.test.ts
 *
 * The three things the summer reconstruction gets wrong are the three things
 * exercised hardest here: that one performance carries two royalties owed to
 * different people, that a tariff is a greater-of rather than a rate, and that
 * a free event is in the lower band rather than outside the tariff.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  MusicLicenceRoyaltyService,
  type EventMusicUsage,
  type SetlistEntry,
} from "../../src/services/musicLicenceRoyaltyService";

const COMPOSITION = "soc-composition";
const RECORDING = "soc-recording";

const CLUB = "club-music-society";
const EVENT = "event-summer-showcase";

const NIGHT = new Date("2027-06-12T19:00:00.000Z");
const DAY = 86_400_000;

function day(offset: number): Date {
  return new Date(NIGHT.getTime() + offset * DAY);
}

function usage(overrides: Partial<EventMusicUsage> = {}): EventMusicUsage {
  return {
    eventId: EVENT,
    clubId: CLUB,
    usageKind: "LIVE",
    venueCapacity: 500,
    attendance: 400,
    admissionCharged: true,
    grossReceiptsCents: 20_000,
    occurredAt: NIGHT,
    ...overrides,
  };
}

function work(overrides: Partial<SetlistEntry> = {}): SetlistEntry {
  return {
    entryId: "entry-1",
    workId: "work-1",
    title: "Bright Corners",
    writer: "A. Mensah",
    durationSeconds: 214,
    status: "IN_COPYRIGHT",
    ...overrides,
  };
}

function build(): MusicLicenceRoyaltyService {
  const service = new MusicLicenceRoyaltyService();

  service.registerSociety({
    societyId: COMPOSITION,
    name: "Composers' collecting society",
    right: "COMPOSITION",
  });
  service.registerSociety({
    societyId: RECORDING,
    name: "Recording rights society",
    right: "RECORDING",
  });

  service.registerTariff({
    societyId: COMPOSITION,
    bands: [
      {
        capacityUpTo: 200,
        perHeadAdmissionCents: 60,
        perHeadNoAdmissionCents: 30,
        grossReceiptsBasisPoints: 300,
        minimumFeeCents: 2_500,
      },
      {
        capacityUpTo: 1_000,
        perHeadAdmissionCents: 90,
        perHeadNoAdmissionCents: 45,
        grossReceiptsBasisPoints: 350,
        minimumFeeCents: 6_000,
      },
      {
        capacityUpTo: Infinity,
        perHeadAdmissionCents: 120,
        perHeadNoAdmissionCents: 60,
        grossReceiptsBasisPoints: 400,
        minimumFeeCents: 12_000,
      },
    ],
  });

  service.registerTariff({
    societyId: RECORDING,
    bands: [
      {
        capacityUpTo: 200,
        perHeadAdmissionCents: 40,
        perHeadNoAdmissionCents: 20,
        grossReceiptsBasisPoints: 200,
        minimumFeeCents: 2_000,
      },
      {
        capacityUpTo: 1_000,
        perHeadAdmissionCents: 60,
        perHeadNoAdmissionCents: 30,
        grossReceiptsBasisPoints: 250,
        minimumFeeCents: 5_000,
      },
      {
        capacityUpTo: Infinity,
        perHeadAdmissionCents: 80,
        perHeadNoAdmissionCents: 40,
        grossReceiptsBasisPoints: 300,
        minimumFeeCents: 10_000,
      },
    ],
  });

  return service;
}

describe("MusicLicenceRoyaltyService (#4704)", () => {
  let service: MusicLicenceRoyaltyService;

  beforeEach(() => {
    service = build();
  });

  describe("registration", () => {
    test("rejects a duplicate society and an unknown one", () => {
      expect(() =>
        service.registerSociety({ societyId: COMPOSITION, name: "Again", right: "COMPOSITION" }),
      ).toThrow(/already registered/i);

      expect(() => service.registerTariff({ societyId: "soc-none", bands: [] })).toThrow(
        /Unknown society/i,
      );
    });

    test("rejects a tariff with no bands", () => {
      service.registerSociety({ societyId: "soc-x", name: "X", right: "COMPOSITION" });
      expect(() => service.registerTariff({ societyId: "soc-x", bands: [] })).toThrow(/no bands/i);
    });

    test("rejects a band that rates a free event at nothing", () => {
      service.registerSociety({ societyId: "soc-x", name: "X", right: "COMPOSITION" });
      expect(() =>
        service.registerTariff({
          societyId: "soc-x",
          bands: [
            {
              capacityUpTo: Infinity,
              perHeadAdmissionCents: 60,
              perHeadNoAdmissionCents: 0,
              grossReceiptsBasisPoints: 300,
              minimumFeeCents: 1_000,
            },
          ],
        }),
      ).toThrow(/free event at nothing/i);
    });

    test("rejects a band that charges more for a free event than a ticketed one", () => {
      service.registerSociety({ societyId: "soc-x", name: "X", right: "COMPOSITION" });
      expect(() =>
        service.registerTariff({
          societyId: "soc-x",
          bands: [
            {
              capacityUpTo: Infinity,
              perHeadAdmissionCents: 30,
              perHeadNoAdmissionCents: 60,
              grossReceiptsBasisPoints: 300,
              minimumFeeCents: 1_000,
            },
          ],
        }),
      ).toThrow(/more for a free event/i);
    });

    test("rejects impossible usage figures", () => {
      expect(() => service.recordUsage(usage({ attendance: -1 }))).toThrow(/impossible figures/i);
      expect(() => service.recordUsage(usage({ venueCapacity: 0 }))).toThrow(/impossible figures/i);
      expect(() =>
        service.recordUsage(usage({ admissionCharged: false, grossReceiptsCents: 500 })),
      ).toThrow(/no admission charge/i);
    });

    test("rejects a duplicate usage and an unknown event", () => {
      service.recordUsage(usage());
      expect(() => service.recordUsage(usage())).toThrow(/already recorded/i);
      expect(() => service.assess("event-none", NIGHT)).toThrow(/No music usage/i);
    });
  });

  describe("bands", () => {
    beforeEach(() => service.recordUsage(usage()));

    test("capacity picks the band, inclusive at the boundary", () => {
      expect(service.bandFor(COMPOSITION, 150).capacityUpTo).toBe(200);
      expect(service.bandFor(COMPOSITION, 200).capacityUpTo).toBe(200);
      expect(service.bandFor(COMPOSITION, 201).capacityUpTo).toBe(1_000);
      expect(service.bandFor(COMPOSITION, 5_000).capacityUpTo).toBe(Infinity);
    });

    test("an unregistered tariff is an error, not a silent nought", () => {
      expect(() => service.bandFor("soc-none", 100)).toThrow(/No tariff registered/i);
    });
  });

  describe("a tariff is a greater-of, not a rate", () => {
    test("the minimum fee binds on a small ticketed event", () => {
      service.recordUsage(usage({ attendance: 20, grossReceiptsCents: 10_000 }));
      const line = service.assess(EVENT, NIGHT).perSociety[0];

      expect(line.perHeadTotalCents).toBe(1_800);
      expect(line.percentageTotalCents).toBe(350);
      expect(line.bindingTerm).toBe("MINIMUM_FEE");
      expect(line.feeCents).toBe(6_000);
    });

    test("the per-head term binds on a full house with cheap tickets", () => {
      service.recordUsage(usage({ attendance: 400, grossReceiptsCents: 20_000 }));
      const line = service.assess(EVENT, NIGHT).perSociety[0];

      expect(line.bindingTerm).toBe("PER_HEAD");
      expect(line.feeCents).toBe(36_000);
    });

    test("the percentage term binds on a small room with expensive tickets", () => {
      service.recordUsage(usage({ attendance: 100, grossReceiptsCents: 500_000 }));
      const line = service.assess(EVENT, NIGHT).perSociety[0];

      expect(line.perHeadTotalCents).toBe(9_000);
      expect(line.percentageTotalCents).toBe(17_500);
      expect(line.bindingTerm).toBe("PERCENTAGE_OF_GROSS");
      expect(line.feeCents).toBe(17_500);
    });

    test("all three terms are reported whichever one binds", () => {
      service.recordUsage(usage());
      const line = service.assess(EVENT, NIGHT).perSociety[0];

      expect(line).toMatchObject({
        perHeadCents: 90,
        perHeadTotalCents: 36_000,
        percentageTotalCents: 700,
        minimumFeeCents: 6_000,
      });
    });

    test("the percentage rounds once, half away from zero", () => {
      service.recordUsage(usage({ attendance: 0, grossReceiptsCents: 1_007 }));
      // 1007 * 350 / 10000 = 35.245
      expect(service.assess(EVENT, NIGHT).perSociety[0].percentageTotalCents).toBe(35);
    });
  });

  describe("free admission is a lower band, not an exemption", () => {
    test("a free event still attracts a fee", () => {
      service.recordUsage(
        usage({ attendance: 400, admissionCharged: false, grossReceiptsCents: 0 }),
      );
      const line = service.assess(EVENT, NIGHT).perSociety[0];

      expect(line.perHeadCents).toBe(45);
      expect(line.feeCents).toBe(18_000);
      expect(line.feeCents).toBeGreaterThan(0);
    });

    test("the free rate is lower than the ticketed one on the same attendance", () => {
      service.recordUsage(
        usage({
          eventId: "event-free",
          attendance: 400,
          admissionCharged: false,
          grossReceiptsCents: 0,
        }),
      );
      service.recordUsage(usage({ eventId: "event-paid", attendance: 400 }));

      expect(service.assess("event-free", NIGHT).totalCents).toBe(18_000);
      expect(service.assess("event-paid", NIGHT).totalCents).toBe(36_000);
    });

    test("a free event with nobody there still meets the minimum", () => {
      service.recordUsage(usage({ attendance: 0, admissionCharged: false, grossReceiptsCents: 0 }));
      const line = service.assess(EVENT, NIGHT).perSociety[0];
      expect(line.bindingTerm).toBe("MINIMUM_FEE");
      expect(line.feeCents).toBe(6_000);
    });
  });

  describe("one performance, two rights", () => {
    test("recorded background use is covered by the blanket", () => {
      service.recordUsage(usage({ usageKind: "RECORDED" }));
      const accrual = service.assess(EVENT, NIGHT);

      expect(accrual.status).toBe("COVERED_BY_BLANKET");
      expect(accrual.perSociety).toHaveLength(0);
      expect(accrual.totalCents).toBe(0);
      expect(service.returnRequired(EVENT)).toBe(false);
    });

    test("a live band plays no recording, so only the composition accrues", () => {
      service.recordUsage(usage({ usageKind: "LIVE" }));
      const accrual = service.assess(EVENT, NIGHT);

      expect(accrual.perSociety.map((line) => line.right)).toEqual(["COMPOSITION"]);
      expect(accrual.totalCents).toBe(36_000);
      expect(service.returnRequired(EVENT)).toBe(true);
    });

    test("a DJ set plays recordings of compositions, so both accrue", () => {
      service.recordUsage(usage({ usageKind: "DJ_SET" }));
      const accrual = service.assess(EVENT, NIGHT);

      expect(accrual.perSociety.map((line) => line.societyId)).toEqual([COMPOSITION, RECORDING]);
      expect(accrual.perSociety.map((line) => line.feeCents)).toEqual([36_000, 24_000]);
      expect(accrual.totalCents).toBe(60_000);
    });

    test("the two societies are never collapsed into one figure", () => {
      service.recordUsage(usage({ usageKind: "DJ_SET" }));
      const accrual = service.assess(EVENT, NIGHT);

      expect(accrual.perSociety).toHaveLength(2);
      expect(accrual.perSociety.reduce((sum, line) => sum + line.feeCents, 0)).toBe(
        accrual.totalCents,
      );
    });

    test("the accruing rights are stated directly", () => {
      expect(service.accruingRights("RECORDED")).toEqual([]);
      expect(service.accruingRights("LIVE")).toEqual(["COMPOSITION"]);
      expect(service.accruingRights("DJ_SET")).toEqual(["COMPOSITION", "RECORDING"]);
    });
  });

  describe("performances and works are different counts", () => {
    beforeEach(() => {
      service.recordUsage(usage());
      service.addSetlistEntry(EVENT, work({ entryId: "e1", workId: "work-a" }));
      service.addSetlistEntry(EVENT, work({ entryId: "e2", workId: "work-b" }));
      service.addSetlistEntry(EVENT, work({ entryId: "e3", workId: "work-a" }));
    });

    test("the same work twice is two performances and one work", () => {
      const accrual = service.assess(EVENT, NIGHT);
      expect(accrual.performanceCount).toBe(3);
      expect(accrual.distinctWorkCount).toBe(2);
    });
  });

  describe("public domain", () => {
    beforeEach(() => service.recordUsage(usage({ usageKind: "DJ_SET" })));

    test("an out-of-copyright work reduces the composition share and not the recording", () => {
      for (const index of [1, 2, 3, 4]) {
        service.addSetlistEntry(EVENT, work({ entryId: `e${index}`, workId: `work-${index}` }));
      }
      service.addSetlistEntry(
        EVENT,
        work({ entryId: "e5", workId: "work-5", writer: "", status: "PUBLIC_DOMAIN" }),
      );

      const accrual = service.assess(EVENT, NIGHT);
      const composition = accrual.perSociety.find((line) => line.right === "COMPOSITION")!;
      const recording = accrual.perSociety.find((line) => line.right === "RECORDING")!;

      expect(composition.grossFeeCents).toBe(36_000);
      expect(composition.inCopyrightShareNumerator).toBe(4);
      expect(composition.inCopyrightShareDenominator).toBe(5);
      expect(composition.feeCents).toBe(28_800);

      // A recording of a public-domain work is still somebody's recording.
      expect(recording.feeCents).toBe(24_000);
    });

    test("an entirely public-domain set accrues no composition royalty at all", () => {
      service.addSetlistEntry(
        EVENT,
        work({ entryId: "e1", workId: "work-1", writer: "", status: "PUBLIC_DOMAIN" }),
      );

      const composition = service
        .assess(EVENT, NIGHT)
        .perSociety.find((line) => line.right === "COMPOSITION")!;
      expect(composition.feeCents).toBe(0);
      expect(composition.grossFeeCents).toBe(36_000);
    });

    test("a member's own unpublished song is in copyright and the club owes on it", () => {
      service.addSetlistEntry(
        EVENT,
        work({ entryId: "e1", workId: "work-own", status: "UNPUBLISHED_ORIGINAL" }),
      );

      const composition = service
        .assess(EVENT, NIGHT)
        .perSociety.find((line) => line.right === "COMPOSITION")!;
      expect(composition.inCopyrightShareNumerator).toBe(1);
      expect(composition.feeCents).toBe(36_000);
    });

    test("with no setlist yet the share is assumed whole rather than nought", () => {
      const composition = service
        .assess(EVENT, NIGHT)
        .perSociety.find((line) => line.right === "COMPOSITION")!;
      expect(composition.feeCents).toBe(36_000);
    });
  });

  describe("an unreturned event does not read as a free one", () => {
    test("before the return the accrual is pending and carries the figures", () => {
      service.recordUsage(usage());
      const accrual = service.assess(EVENT, NIGHT);

      expect(accrual.status).toBe("PENDING_RETURN");
      expect(accrual.totalCents).toBe(36_000);
      expect(accrual.returnSubmittedAt).toBeNull();
    });

    test("the unreturned list is ordered by what is riding on it", () => {
      service.recordUsage(
        usage({
          eventId: "event-small",
          attendance: 20,
          grossReceiptsCents: 0,
          admissionCharged: false,
        }),
      );
      service.recordUsage(usage({ eventId: "event-big", attendance: 400 }));
      service.recordUsage(usage({ eventId: "event-blanket", usageKind: "RECORDED" }));

      const pending = service.unreturnedEvents(NIGHT);
      expect(pending.map((entry) => entry.eventId)).toEqual(["event-big", "event-small"]);
    });

    test("a submitted return leaves the unreturned list", () => {
      service.recordUsage(usage());
      service.addSetlistEntry(EVENT, work());
      service.submitReturn(EVENT, day(2));

      expect(service.unreturnedEvents(day(3))).toEqual([]);
    });
  });

  describe("submitting the return", () => {
    beforeEach(() => service.recordUsage(usage()));

    test("a return is refused where none is required", () => {
      service.recordUsage(usage({ eventId: "event-blanket", usageKind: "RECORDED" }));
      expect(service.submitReturn("event-blanket", day(1)).outcome).toBe("REFUSED_NOT_REQUIRED");
    });

    test("an empty setlist is refused", () => {
      expect(service.submitReturn(EVENT, day(1)).outcome).toBe("REFUSED_NO_SETLIST");
    });

    test("an entry with no title or no duration is refused", () => {
      service.addSetlistEntry(EVENT, work({ title: "  " }));
      expect(service.submitReturn(EVENT, day(1)).outcome).toBe("REFUSED_INCOMPLETE_ENTRY");
    });

    test("an in-copyright work with no writer is a royalty nobody can distribute", () => {
      service.addSetlistEntry(EVENT, work({ writer: "" }));
      expect(service.submitReturn(EVENT, day(1)).outcome).toBe("REFUSED_INCOMPLETE_ENTRY");
    });

    test("a public-domain traditional may name no writer, because often there is none", () => {
      service.addSetlistEntry(EVENT, work({ writer: "", status: "PUBLIC_DOMAIN" }));
      expect(service.submitReturn(EVENT, day(1)).outcome).toBe("SUBMITTED");
    });

    test("a complete return freezes the accrual", () => {
      service.addSetlistEntry(EVENT, work());
      expect(service.submitReturn(EVENT, day(1)).outcome).toBe("SUBMITTED");

      const accrual = service.assess(EVENT, day(5));
      expect(accrual.status).toBe("ACCRUED");
      expect(accrual.returnSubmittedAt).toEqual(day(1));
      expect(accrual.totalCents).toBe(36_000);
    });

    test("submitting twice is refused and the setlist is closed", () => {
      service.addSetlistEntry(EVENT, work());
      service.submitReturn(EVENT, day(1));

      expect(service.submitReturn(EVENT, day(2)).outcome).toBe("REFUSED_ALREADY_SUBMITTED");
      expect(() => service.addSetlistEntry(EVENT, work({ entryId: "e2" }))).toThrow(
        /cannot take new entries/i,
      );
    });
  });

  describe("corrections", () => {
    beforeEach(() => {
      service.recordUsage(usage());
      service.addSetlistEntry(EVENT, work());
    });

    test("a correction before the return is just the truth arriving late", () => {
      const result = service.correctFigures(EVENT, { attendance: 300 }, day(1), "Door count");

      expect(result.outcome).toBe("APPLIED_BEFORE_RETURN");
      expect(result.adjustment).toBeNull();
      expect(service.assess(EVENT, day(1)).totalCents).toBe(27_000);
    });

    test("a correction after the return leaves the return standing", () => {
      service.submitReturn(EVENT, day(1));
      const result = service.correctFigures(EVENT, { attendance: 300 }, day(20), "Door count");

      expect(result.outcome).toBe("ADJUSTED");
      expect(result.adjustment).toMatchObject({
        previousTotalCents: 36_000,
        revisedTotalCents: 27_000,
        deltaCents: -9_000,
      });

      const accrual = service.assess(EVENT, day(21));
      expect(accrual.status).toBe("ADJUSTED");
      // The submitted return is the document the invoice was raised against.
      expect(accrual.totalCents).toBe(36_000);
      expect(accrual.netPayableCents).toBe(27_000);
      expect(accrual.adjustments).toHaveLength(1);
    });

    test("adjustments accumulate against the running position", () => {
      service.submitReturn(EVENT, day(1));
      service.correctFigures(EVENT, { attendance: 300 }, day(20), "Door count");
      service.correctFigures(EVENT, { attendance: 350 }, day(30), "Recount");

      const accrual = service.assess(EVENT, day(31));
      expect(accrual.adjustments.map((entry) => entry.deltaCents)).toEqual([-9_000, 4_500]);
      expect(accrual.netPayableCents).toBe(31_500);
    });

    test("a correction that changes nothing is refused", () => {
      expect(service.correctFigures(EVENT, { attendance: 400 }, day(1), "None").outcome).toBe(
        "REFUSED_NO_CHANGE",
      );
      expect(service.correctFigures(EVENT, {}, day(1), "None").outcome).toBe("REFUSED_NO_CHANGE");
    });

    test("an impossible correction throws", () => {
      expect(() => service.correctFigures(EVENT, { attendance: -5 }, day(1), "Typo")).toThrow(
        /impossible/i,
      );
    });

    test("an adjustment carries its own per-society lines", () => {
      service.recordUsage(usage({ eventId: "event-dj", usageKind: "DJ_SET" }));
      service.addSetlistEntry("event-dj", work());
      service.submitReturn("event-dj", day(1));

      const result = service.correctFigures("event-dj", { attendance: 200 }, day(20), "Recount");
      expect(result.adjustment!.perSociety.map((line) => line.feeCents)).toEqual([18_000, 12_000]);
    });
  });

  describe("reporting", () => {
    beforeEach(() => {
      service.recordUsage(usage({ eventId: "event-live", usageKind: "LIVE" }));
      service.recordUsage(usage({ eventId: "event-dj", usageKind: "DJ_SET", occurredAt: day(30) }));
      service.addSetlistEntry("event-live", work());
      service.submitReturn("event-live", day(2));
    });

    test("a society is reported on separately, split by whether the return is in", () => {
      const composition = service.societyLiability(COMPOSITION, day(-10), day(60), day(61));
      expect(composition).toEqual({
        societyId: COMPOSITION,
        accruedCents: 36_000,
        pendingReturnCents: 36_000,
        eventCount: 2,
      });

      const recording = service.societyLiability(RECORDING, day(-10), day(60), day(61));
      // The live event never touches the recording society at all.
      expect(recording).toEqual({
        societyId: RECORDING,
        accruedCents: 0,
        pendingReturnCents: 24_000,
        eventCount: 1,
      });
    });

    test("the period is respected at both ends", () => {
      expect(service.societyLiability(COMPOSITION, day(-10), day(10), day(61)).eventCount).toBe(1);
      expect(service.societyLiability(COMPOSITION, day(40), day(60), day(61)).eventCount).toBe(0);
    });

    test("an adjustment supersedes the return for what is currently owed", () => {
      service.correctFigures("event-live", { attendance: 200 }, day(20), "Recount");
      expect(service.societyLiability(COMPOSITION, day(-10), day(60), day(61)).accruedCents).toBe(
        18_000,
      );
    });

    test("an unknown society is an error", () => {
      expect(() => service.societyLiability("soc-none", day(-10), day(60), day(61))).toThrow(
        /Unknown society/i,
      );
    });

    test("a club sees what it owes, heaviest first", () => {
      const liability = service.clubLiability(CLUB, day(61));
      expect(liability.map((entry) => entry.eventId)).toEqual(["event-dj", "event-live"]);
      expect(liability[0].netPayableCents).toBe(60_000);
    });

    test("a club with no events owes nothing", () => {
      expect(service.clubLiability("club-none", day(61))).toEqual([]);
    });
  });
});
