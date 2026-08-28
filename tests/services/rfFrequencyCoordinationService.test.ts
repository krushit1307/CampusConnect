/**
 * Test suite: Radio Mic Frequency Coordination (#4922)
 * File: tests/services/rfFrequencyCoordinationService.test.ts
 *
 * The cases worth writing down are the ones where a plan that looks right on a
 * spreadsheet is wrong in the room: three evenly spaced channels that generate
 * a product on top of the third, two committees whose separately valid plans
 * collide in one venue, and a licence that lapses between the plan being drawn
 * up and the doors opening.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  RfFrequencyCoordinationService,
  DEFAULT_MIN_SPACING_KHZ,
  DEFAULT_INTERMOD_GUARD_KHZ,
} from "../../src/services/rfFrequencyCoordinationService";

const ARTS = "venue-arts-centre";
const SPORTS = "venue-sports-hall";

const BAND_UHF = "band-uhf-licensed";
const BAND_EXEMPT = "band-ch70-exempt";
const BAND_NARROW = "band-narrow-exempt";

const HANDHELD = "tx-handheld-1";
const HANDHELD_2 = "tx-handheld-2";
const HANDHELD_3 = "tx-handheld-3";
const HANDHELD_4 = "tx-handheld-4";
const LAPEL = "tx-lapel-1";
const NARROW_A = "tx-narrow-a";
const NARROW_B = "tx-narrow-b";

const PLAN = "plan-winter-showcase";
const OTHER_PLAN = "plan-careers-fair";

const DOORS = new Date("2027-03-12T19:00:00.000Z");
const DAY = 86_400_000;
const HOUR = 3_600_000;

function day(offset: number): Date {
  return new Date(DOORS.getTime() + offset * DAY);
}

function hour(offset: number): Date {
  return new Date(DOORS.getTime() + offset * HOUR);
}

function build(): RfFrequencyCoordinationService {
  const service = new RfFrequencyCoordinationService();

  // A slice of UHF shared with terrestrial television: usable only under a
  // venue licence for a named date window.
  service.registerBand({
    bandId: BAND_UHF,
    label: "UHF Channel 38",
    kind: "LICENSED",
    startKhz: 606_000,
    endKhz: 614_000,
    stepKhz: 25,
  });

  // Licence-exempt spectrum, open to anybody, and correspondingly crowded.
  service.registerBand({
    bandId: BAND_EXEMPT,
    label: "Channel 70",
    kind: "EXEMPT",
    startKhz: 863_000,
    endKhz: 865_000,
    stepKhz: 25,
  });

  // A deliberately tiny band, used to exhaust the spectrum in a few channels.
  service.registerBand({
    bandId: BAND_NARROW,
    label: "Narrow test band",
    kind: "EXEMPT",
    startKhz: 800_000,
    endKhz: 800_200,
    stepKhz: 100,
  });

  service.registerLicence({
    licenceId: "lic-arts-ch38",
    venueId: ARTS,
    bandId: BAND_UHF,
    validFrom: day(-30),
    validUntil: day(30),
  });

  for (const id of [HANDHELD, HANDHELD_2, HANDHELD_3, HANDHELD_4]) {
    service.registerTransmitter({
      transmitterId: id,
      label: `Handheld ${id.slice(-1)}`,
      tuningStartKhz: 606_000,
      tuningEndKhz: 614_000,
    });
  }

  service.registerTransmitter({
    transmitterId: LAPEL,
    label: "Lapel pack",
    tuningStartKhz: 863_000,
    tuningEndKhz: 865_000,
  });

  for (const id of [NARROW_A, NARROW_B]) {
    service.registerTransmitter({
      transmitterId: id,
      label: `Narrow pack ${id.slice(-1)}`,
      tuningStartKhz: 800_000,
      tuningEndKhz: 800_200,
    });
  }

  service.createPlan({
    planId: PLAN,
    venueId: ARTS,
    label: "Winter showcase",
    windowStart: hour(-2),
    windowEnd: hour(4),
  });

  return service;
}

describe("RfFrequencyCoordinationService — bands and the tuning grid", () => {
  let service: RfFrequencyCoordinationService;

  beforeEach(() => {
    service = build();
  });

  test("assigns a frequency that sits in a licensed band under a valid licence", () => {
    const result = service.assign(PLAN, HANDHELD, 606_000, DOORS);

    expect(result.outcome).toBe("ASSIGNED");
    expect(result.frequencyKhz).toBe(606_000);
    expect(result.bandId).toBe(BAND_UHF);
  });

  test("the tuning range is checked before the band, so an unreachable frequency says so", () => {
    const result = service.assign(PLAN, HANDHELD, 807_000, DOORS);

    expect(result.outcome).toBe("REFUSED_OUT_OF_TUNING_RANGE");
  });

  test("refuses a frequency inside the tuning range but outside every band", () => {
    service.registerTransmitter({
      transmitterId: "tx-wide",
      label: "Wideband receiver",
      tuningStartKhz: 500_000,
      tuningEndKhz: 900_000,
    });

    const result = service.assign(PLAN, "tx-wide", 700_000, DOORS);

    expect(result.outcome).toBe("REFUSED_OUTSIDE_ANY_BAND");
    expect(result.bandId).toBeNull();
  });

  test("refuses a frequency off the tuning grid", () => {
    const result = service.assign(PLAN, HANDHELD, 606_010, DOORS);

    expect(result.outcome).toBe("REFUSED_OFF_STEP");
  });

  test("names the band when refusing an off-grid frequency", () => {
    const result = service.assign(PLAN, HANDHELD, 606_010, DOORS);

    expect(result.bandId).toBe(BAND_UHF);
    expect(result.detail).toContain("25 kHz");
  });

  test("accepts a frequency on the grid at the very bottom of a band", () => {
    const result = service.assign(PLAN, LAPEL, 863_000, DOORS);

    expect(result.outcome).toBe("ASSIGNED");
    expect(result.bandId).toBe(BAND_EXEMPT);
  });

  test("accepts a frequency on the grid at the very top of a band", () => {
    const result = service.assign(PLAN, LAPEL, 865_000, DOORS);

    expect(result.outcome).toBe("ASSIGNED");
  });

  test("bandFor resolves a frequency to its containing band", () => {
    expect(service.bandFor(610_000)?.bandId).toBe(BAND_UHF);
    expect(service.bandFor(864_000)?.bandId).toBe(BAND_EXEMPT);
    expect(service.bandFor(700_000)).toBeNull();
  });
});

describe("RfFrequencyCoordinationService — transmitter tuning range", () => {
  let service: RfFrequencyCoordinationService;

  beforeEach(() => {
    service = build();
  });

  test("refuses a frequency below what the pack can tune to", () => {
    const result = service.assign(PLAN, LAPEL, 610_000, DOORS);

    expect(result.outcome).toBe("REFUSED_OUT_OF_TUNING_RANGE");
    expect(result.detail).toContain("863.000");
  });

  test("refuses a frequency above what the pack can tune to", () => {
    const result = service.assign(PLAN, HANDHELD, 864_000, DOORS);

    expect(result.outcome).toBe("REFUSED_OUT_OF_TUNING_RANGE");
  });

  test("a clean, legal, untunable frequency is still refused", () => {
    // 864.000 is exempt spectrum on the grid with nothing else on it. The only
    // thing wrong with it is that this particular pack cannot reach it.
    expect(service.isBandUsable(BAND_EXEMPT, ARTS, DOORS)).toBe(true);
    expect(service.assign(PLAN, HANDHELD, 864_000, DOORS).outcome).toBe(
      "REFUSED_OUT_OF_TUNING_RANGE",
    );
  });

  test("refuses an unknown transmitter", () => {
    const result = service.assign(PLAN, "tx-borrowed-from-the-av-store", 606_000, DOORS);

    expect(result.outcome).toBe("REFUSED_UNKNOWN_TRANSMITTER");
  });

  test("refuses a second frequency for a transmitter that already holds one", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);

    const result = service.assign(PLAN, HANDHELD, 612_000, DOORS);

    expect(result.outcome).toBe("REFUSED_TRANSMITTER_ALREADY_ASSIGNED");
    expect(service.getPlan(PLAN)?.assignments).toHaveLength(1);
  });
});

describe("RfFrequencyCoordinationService — licensing", () => {
  let service: RfFrequencyCoordinationService;

  beforeEach(() => {
    service = build();
  });

  test("an exempt band never needs a licence", () => {
    expect(service.isBandUsable(BAND_EXEMPT, SPORTS, day(9_000))).toBe(true);
  });

  test("a licensed band is usable while the venue licence is valid", () => {
    expect(service.isBandUsable(BAND_UHF, ARTS, DOORS)).toBe(true);
  });

  test("a licensed band is closed before the licence starts", () => {
    expect(service.isBandUsable(BAND_UHF, ARTS, day(-31))).toBe(false);
  });

  test("a licensed band is closed once the licence has expired", () => {
    expect(service.isBandUsable(BAND_UHF, ARTS, day(31))).toBe(false);
  });

  test("a licence held by another venue does not open the band here", () => {
    expect(service.isBandUsable(BAND_UHF, SPORTS, DOORS)).toBe(false);
  });

  test("a licence for another band does not open this one", () => {
    service.registerBand({
      bandId: "band-other-licensed",
      label: "UHF Channel 51",
      kind: "LICENSED",
      startKhz: 694_000,
      endKhz: 702_000,
      stepKhz: 25,
    });

    expect(service.isBandUsable("band-other-licensed", ARTS, DOORS)).toBe(false);
  });

  test("refuses an assignment in a licensed band with no covering licence", () => {
    service.createPlan({
      planId: "plan-sports-hall",
      venueId: SPORTS,
      label: "Varsity final",
      windowStart: hour(-2),
      windowEnd: hour(4),
    });

    const result = service.assign("plan-sports-hall", HANDHELD, 606_000, DOORS);

    expect(result.outcome).toBe("REFUSED_UNLICENSED_BAND");
    expect(result.bandId).toBe(BAND_UHF);
  });

  test("the same assignment succeeds before the licence lapses and fails after", () => {
    const before = service.assign(PLAN, HANDHELD, 606_000, day(29));
    expect(before.outcome).toBe("ASSIGNED");

    const after = service.assign(PLAN, HANDHELD_2, 612_000, day(31));
    expect(after.outcome).toBe("REFUSED_UNLICENSED_BAND");
  });

  test("an expired licence removes the capacity rather than flagging it", () => {
    const result = service.assign(PLAN, HANDHELD, 606_000, day(31));

    expect(result.outcome).toBe("REFUSED_UNLICENSED_BAND");
    expect(result.frequencyKhz).toBeNull();
    expect(service.getPlan(PLAN)?.assignments).toHaveLength(0);
  });
});

describe("RfFrequencyCoordinationService — spacing within one plan", () => {
  let service: RfFrequencyCoordinationService;

  beforeEach(() => {
    service = build();
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
  });

  test("refuses a co-channel assignment and names the holder", () => {
    const result = service.assign(PLAN, HANDHELD_2, 606_000, DOORS);

    expect(result.outcome).toBe("REFUSED_CO_CHANNEL");
    expect(result.spacing?.transmitterId).toBe(HANDHELD);
    expect(result.spacing?.separationKhz).toBe(0);
  });

  test("refuses an adjacent channel inside the minimum spacing", () => {
    const result = service.assign(PLAN, HANDHELD_2, 606_100, DOORS);

    expect(result.outcome).toBe("REFUSED_ADJACENT_CHANNEL");
    expect(result.spacing?.separationKhz).toBe(100);
  });

  test("accepts a channel at exactly the minimum spacing", () => {
    const result = service.assign(PLAN, HANDHELD_2, 606_000 + DEFAULT_MIN_SPACING_KHZ, DOORS);

    expect(result.outcome).toBe("ASSIGNED");
  });

  test("refuses a channel one grid step inside the minimum spacing", () => {
    const result = service.assign(PLAN, HANDHELD_2, 606_000 + DEFAULT_MIN_SPACING_KHZ - 25, DOORS);

    expect(result.outcome).toBe("REFUSED_ADJACENT_CHANNEL");
  });

  test("spacing is symmetric below the existing channel", () => {
    service.assign(PLAN, HANDHELD_2, 610_000, DOORS);

    const result = service.assign(PLAN, HANDHELD_3, 609_900, DOORS);

    expect(result.outcome).toBe("REFUSED_ADJACENT_CHANNEL");
  });
});

describe("RfFrequencyCoordinationService — intermodulation", () => {
  let service: RfFrequencyCoordinationService;

  beforeEach(() => {
    service = build();
  });

  test("the evenly spaced three-channel plan is refused on its third channel", () => {
    expect(service.assign(PLAN, HANDHELD, 606_000, DOORS).outcome).toBe("ASSIGNED");
    expect(service.assign(PLAN, HANDHELD_2, 608_000, DOORS).outcome).toBe("ASSIGNED");

    const third = service.assign(PLAN, HANDHELD_3, 610_000, DOORS);

    expect(third.outcome).toBe("REFUSED_INTERMODULATION");
  });

  test("the refusal names the pair that produced the product", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.assign(PLAN, HANDHELD_2, 608_000, DOORS);

    const third = service.assign(PLAN, HANDHELD_3, 610_000, DOORS);

    expect(third.intermodulation).not.toBeNull();
    expect([third.intermodulation?.sourceAKhz, third.intermodulation?.sourceBKhz].sort()).toEqual([
      606_000, 608_000,
    ]);
    expect(third.intermodulation?.victimKhz).toBe(610_000);
    expect(third.detail).toContain("606.000");
    expect(third.detail).toContain("608.000");
  });

  test("an exact hit reports a zero offset", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.assign(PLAN, HANDHELD_2, 608_000, DOORS);

    const third = service.assign(PLAN, HANDHELD_3, 610_000, DOORS);

    expect(third.intermodulation?.productKhz).toBe(610_000);
    expect(third.intermodulation?.offsetKhz).toBe(0);
  });

  test("two channels on their own never trip an intermodulation refusal", () => {
    expect(service.assign(PLAN, HANDHELD, 606_000, DOORS).outcome).toBe("ASSIGNED");
    expect(service.assign(PLAN, HANDHELD_2, 608_000, DOORS).outcome).toBe("ASSIGNED");
    expect(service.findIntermodulation([606_000, 608_000])).toBeNull();
  });

  test("an unevenly spaced third channel is accepted", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.assign(PLAN, HANDHELD_2, 608_000, DOORS);

    const third = service.assign(PLAN, HANDHELD_3, 611_000, DOORS);

    expect(third.outcome).toBe("ASSIGNED");
  });

  test("checks products in both directions", () => {
    // 2·f2 − f1 places the product above the pair rather than below it.
    expect(service.findIntermodulation([500_000, 502_000, 504_000])).not.toBeNull();
    // 2·f1 − f2 places it below.
    expect(service.findIntermodulation([500_000, 502_000, 498_000])).not.toBeNull();
  });

  test("a product landing just inside the guard band is a collision", () => {
    const collision = service.findIntermodulation([
      500_000,
      502_000,
      504_000 + DEFAULT_INTERMOD_GUARD_KHZ - 1,
    ]);

    expect(collision).not.toBeNull();
    expect(collision?.offsetKhz).toBe(DEFAULT_INTERMOD_GUARD_KHZ - 1);
  });

  test("a product landing exactly on the edge of the guard band is not a collision", () => {
    expect(
      service.findIntermodulation([500_000, 502_000, 504_000 + DEFAULT_INTERMOD_GUARD_KHZ]),
    ).toBeNull();
  });

  test("a set with fewer than two frequencies has no pairs and no products", () => {
    expect(service.findIntermodulation([])).toBeNull();
    expect(service.findIntermodulation([606_000])).toBeNull();
  });

  test("a product from a fourth channel against an existing pair is caught", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.assign(PLAN, HANDHELD_2, 611_000, DOORS);
    service.assign(PLAN, HANDHELD_3, 613_000, DOORS);

    // 2·611.000 − 613.000 = 609.000, which is where the fourth mic wants to go.
    const fourth = service.assign(PLAN, HANDHELD_4, 609_000, DOORS);

    expect(fourth.outcome).toBe("REFUSED_INTERMODULATION");
    expect(fourth.intermodulation?.victimKhz).toBe(609_000);
  });

  test("a refused assignment leaves the plan untouched", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.assign(PLAN, HANDHELD_2, 608_000, DOORS);
    service.assign(PLAN, HANDHELD_3, 610_000, DOORS);

    expect(service.getPlan(PLAN)?.assignments).toHaveLength(2);
  });
});

describe("RfFrequencyCoordinationService — contention between plans", () => {
  let service: RfFrequencyCoordinationService;

  function otherPlanIn(venueId: string, windowStart: Date, windowEnd: Date): void {
    service.createPlan({
      planId: OTHER_PLAN,
      venueId,
      label: "Careers fair",
      windowStart,
      windowEnd,
    });
  }

  beforeEach(() => {
    service = build();
  });

  test("a signed-off plan in the same venue and window blocks its channels", () => {
    otherPlanIn(ARTS, hour(-2), hour(4));
    service.assign(OTHER_PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(OTHER_PLAN, "operator-jo", DOORS);

    const result = service.assign(PLAN, HANDHELD_2, 606_000, DOORS);

    expect(result.outcome).toBe("REFUSED_CO_CHANNEL");
    expect(result.spacing?.planId).toBe(OTHER_PLAN);
  });

  test("a plan in a different venue does not block anything", () => {
    otherPlanIn(SPORTS, hour(-2), hour(4));
    service.assign(OTHER_PLAN, LAPEL, 863_000, DOORS);
    service.signOff(OTHER_PLAN, "operator-jo", DOORS);

    const result = service.assign(PLAN, LAPEL, 863_000, DOORS);

    expect(result.outcome).toBe("ASSIGNED");
  });

  test("a plan whose window does not overlap does not block anything", () => {
    otherPlanIn(ARTS, hour(10), hour(14));
    service.assign(OTHER_PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(OTHER_PLAN, "operator-jo", DOORS);

    const result = service.assign(PLAN, HANDHELD_2, 606_000, DOORS);

    expect(result.outcome).toBe("ASSIGNED");
  });

  test("windows that touch at an endpoint do not overlap", () => {
    otherPlanIn(ARTS, hour(4), hour(8));
    service.assign(OTHER_PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(OTHER_PLAN, "operator-jo", DOORS);

    expect(service.assign(PLAN, HANDHELD_2, 606_000, DOORS).outcome).toBe("ASSIGNED");
  });

  test("a draft plan reserves nothing", () => {
    otherPlanIn(ARTS, hour(-2), hour(4));
    service.assign(OTHER_PLAN, HANDHELD, 606_000, DOORS);

    const result = service.assign(PLAN, HANDHELD_2, 606_000, DOORS);

    expect(result.outcome).toBe("ASSIGNED");
  });

  test("a voided plan stops reserving its channels", () => {
    otherPlanIn(ARTS, hour(-2), hour(4));
    service.assign(OTHER_PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(OTHER_PLAN, "operator-jo", DOORS);
    service.voidPlan(OTHER_PLAN);

    expect(service.assign(PLAN, HANDHELD_2, 606_000, DOORS).outcome).toBe("ASSIGNED");
  });

  test("two separately valid plans still intermodulate in a shared venue", () => {
    otherPlanIn(ARTS, hour(-2), hour(4));
    service.assign(OTHER_PLAN, HANDHELD, 606_000, DOORS);
    service.assign(OTHER_PLAN, HANDHELD_2, 608_000, DOORS);
    service.signOff(OTHER_PLAN, "operator-jo", DOORS);

    const result = service.assign(PLAN, HANDHELD_3, 610_000, DOORS);

    expect(result.outcome).toBe("REFUSED_INTERMODULATION");
  });

  test("occupiedChannels reports the plan each channel belongs to", () => {
    otherPlanIn(ARTS, hour(-2), hour(4));
    service.assign(OTHER_PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(OTHER_PLAN, "operator-jo", DOORS);
    service.assign(PLAN, HANDHELD_2, 611_000, DOORS);

    const occupied = service.occupiedChannels(PLAN);

    expect(occupied).toHaveLength(2);
    expect(occupied.find((c) => c.frequencyKhz === 606_000)?.planId).toBe(OTHER_PLAN);
    expect(occupied.find((c) => c.frequencyKhz === 611_000)?.planId).toBe(PLAN);
  });

  test("occupiedChannels is empty for an unknown plan", () => {
    expect(service.occupiedChannels("plan-that-was-never-created")).toEqual([]);
  });
});

describe("RfFrequencyCoordinationService — suggestion", () => {
  let service: RfFrequencyCoordinationService;

  beforeEach(() => {
    service = build();
  });

  test("suggests the lowest clean frequency the pack can reach", () => {
    expect(service.suggest(PLAN, HANDHELD, DOORS)).toBe(606_000);
  });

  test("a suggested frequency is actually assignable", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.assign(PLAN, HANDHELD_2, 608_000, DOORS);

    const suggested = service.suggest(PLAN, HANDHELD_3, DOORS);

    expect(suggested).not.toBeNull();
    expect(service.assign(PLAN, HANDHELD_3, suggested as number, DOORS).outcome).toBe("ASSIGNED");
  });

  test("a suggestion never lands on the intermodulation trap", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.assign(PLAN, HANDHELD_2, 608_000, DOORS);

    expect(service.suggest(PLAN, HANDHELD_3, DOORS)).not.toBe(610_000);
  });

  test("a suggestion stays inside the pack's tuning range", () => {
    const suggested = service.suggest(PLAN, LAPEL, DOORS);

    expect(suggested).not.toBeNull();
    expect(suggested as number).toBeGreaterThanOrEqual(863_000);
    expect(suggested as number).toBeLessThanOrEqual(865_000);
  });

  test("a suggestion skips a licensed band with no covering licence", () => {
    service.createPlan({
      planId: "plan-sports-hall",
      venueId: SPORTS,
      label: "Varsity final",
      windowStart: hour(-2),
      windowEnd: hour(4),
    });

    // The handheld can only tune to the licensed band, and this venue has no
    // licence, so there is nothing to suggest at all.
    expect(service.suggest("plan-sports-hall", HANDHELD, DOORS)).toBeNull();
  });

  test("returns null when the band has run out of clean spectrum", () => {
    service.assign(PLAN, NARROW_A, 800_000, DOORS);

    expect(service.suggest(PLAN, NARROW_B, DOORS)).toBeNull();
  });

  test("returns null for a signed-off plan", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(PLAN, "operator-jo", DOORS);

    expect(service.suggest(PLAN, HANDHELD_2, DOORS)).toBeNull();
  });

  test("returns null for an unknown transmitter", () => {
    expect(service.suggest(PLAN, "tx-nonexistent", DOORS)).toBeNull();
  });
});

describe("RfFrequencyCoordinationService — sign-off and freezing", () => {
  let service: RfFrequencyCoordinationService;

  beforeEach(() => {
    service = build();
  });

  test("signs off a plan that has assignments", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);

    const result = service.signOff(PLAN, "operator-jo", DOORS);

    expect(result.outcome).toBe("SIGNED_OFF");
    expect(service.getPlan(PLAN)?.status).toBe("SIGNED_OFF");
    expect(service.getPlan(PLAN)?.signedOffBy).toBe("operator-jo");
  });

  test("refuses to sign off an empty plan", () => {
    expect(service.signOff(PLAN, "operator-jo", DOORS).outcome).toBe("REFUSED_NO_ASSIGNMENTS");
  });

  test("refuses to sign off the same plan twice", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(PLAN, "operator-jo", DOORS);

    expect(service.signOff(PLAN, "operator-sam", DOORS).outcome).toBe("REFUSED_ALREADY_SIGNED_OFF");
    expect(service.getPlan(PLAN)?.signedOffBy).toBe("operator-jo");
  });

  test("refuses sign-off when the licence lapses part-way through the window", () => {
    service.registerLicence({
      licenceId: "lic-arts-ch38",
      venueId: ARTS,
      bandId: BAND_UHF,
      validFrom: day(-30),
      validUntil: hour(1),
    });
    service.assign(PLAN, HANDHELD, 606_000, DOORS);

    const result = service.signOff(PLAN, "operator-jo", DOORS);

    expect(result.outcome).toBe("REFUSED_LICENCE_LAPSED");
    expect(result.lapsedBandIds).toEqual([BAND_UHF]);
  });

  test("refuses sign-off when the licence only starts part-way through the window", () => {
    service.registerLicence({
      licenceId: "lic-arts-ch38",
      venueId: ARTS,
      bandId: BAND_UHF,
      validFrom: hour(-1),
      validUntil: day(30),
    });
    service.assign(PLAN, HANDHELD, 606_000, DOORS);

    expect(service.signOff(PLAN, "operator-jo", DOORS).outcome).toBe("REFUSED_LICENCE_LAPSED");
  });

  test("a plan entirely in exempt spectrum signs off with no licence at all", () => {
    service.createPlan({
      planId: "plan-sports-hall",
      venueId: SPORTS,
      label: "Varsity final",
      windowStart: hour(-2),
      windowEnd: hour(4),
    });
    service.assign("plan-sports-hall", LAPEL, 863_000, DOORS);

    expect(service.signOff("plan-sports-hall", "operator-jo", DOORS).outcome).toBe("SIGNED_OFF");
  });

  test("refuses an assignment once the plan is signed off", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(PLAN, "operator-jo", DOORS);

    expect(service.assign(PLAN, HANDHELD_2, 611_000, DOORS).outcome).toBe("REFUSED_PLAN_NOT_DRAFT");
  });

  test("refuses a release once the plan is signed off", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(PLAN, "operator-jo", DOORS);

    expect(service.release(PLAN, HANDHELD)).toBe(false);
    expect(service.getPlan(PLAN)?.assignments).toHaveLength(1);
  });

  test("reopening returns the plan to draft and clears the signature", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(PLAN, "operator-jo", DOORS);

    expect(service.reopen(PLAN)).toBe(true);
    expect(service.getPlan(PLAN)?.status).toBe("DRAFT");
    expect(service.getPlan(PLAN)?.signedOffBy).toBeNull();
    expect(service.getPlan(PLAN)?.signedOffAt).toBeNull();
  });

  test("a reopened plan stops reserving spectrum for other plans", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.signOff(PLAN, "operator-jo", DOORS);
    service.createPlan({
      planId: OTHER_PLAN,
      venueId: ARTS,
      label: "Careers fair",
      windowStart: hour(-2),
      windowEnd: hour(4),
    });

    expect(service.assign(OTHER_PLAN, HANDHELD_2, 606_000, DOORS).outcome).toBe(
      "REFUSED_CO_CHANNEL",
    );

    service.reopen(PLAN);

    expect(service.assign(OTHER_PLAN, HANDHELD_2, 606_000, DOORS).outcome).toBe("ASSIGNED");
  });

  test("reopening a draft plan does nothing", () => {
    expect(service.reopen(PLAN)).toBe(false);
  });

  test("a voided plan cannot be edited", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    service.voidPlan(PLAN);

    expect(service.assign(PLAN, HANDHELD_2, 611_000, DOORS).outcome).toBe("REFUSED_PLAN_NOT_DRAFT");
  });

  test("voiding twice reports no second change", () => {
    service.voidPlan(PLAN);

    expect(service.voidPlan(PLAN)).toBe(false);
  });

  test("assignments cannot be made against a plan that does not exist", () => {
    expect(service.assign("plan-imaginary", HANDHELD, 606_000, DOORS).outcome).toBe(
      "REFUSED_PLAN_NOT_DRAFT",
    );
  });
});

describe("RfFrequencyCoordinationService — release", () => {
  let service: RfFrequencyCoordinationService;

  beforeEach(() => {
    service = build();
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
  });

  test("releasing a channel frees it for another transmitter", () => {
    expect(service.release(PLAN, HANDHELD)).toBe(true);
    expect(service.assign(PLAN, HANDHELD_2, 606_000, DOORS).outcome).toBe("ASSIGNED");
  });

  test("releasing a transmitter that holds nothing reports no change", () => {
    expect(service.release(PLAN, HANDHELD_2)).toBe(false);
  });

  test("releasing frees the transmitter to be reassigned elsewhere", () => {
    service.release(PLAN, HANDHELD);

    expect(service.assign(PLAN, HANDHELD, 612_000, DOORS).outcome).toBe("ASSIGNED");
  });
});

describe("RfFrequencyCoordinationService — registration guards", () => {
  let service: RfFrequencyCoordinationService;

  beforeEach(() => {
    service = build();
  });

  test("rejects a band that ends at or before it starts", () => {
    expect(() =>
      service.registerBand({
        bandId: "band-broken",
        label: "Inverted",
        kind: "EXEMPT",
        startKhz: 700_000,
        endKhz: 700_000,
        stepKhz: 25,
      }),
    ).toThrow(/ends at or before/);
  });

  test("rejects a band with a non-positive tuning step", () => {
    expect(() =>
      service.registerBand({
        bandId: "band-stepless",
        label: "Stepless",
        kind: "EXEMPT",
        startKhz: 700_000,
        endKhz: 701_000,
        stepKhz: 0,
      }),
    ).toThrow(/tuning step/);
  });

  test("rejects a licence for a band that does not exist", () => {
    expect(() =>
      service.registerLicence({
        licenceId: "lic-ghost",
        venueId: ARTS,
        bandId: "band-that-is-not-registered",
        validFrom: day(-1),
        validUntil: day(1),
      }),
    ).toThrow(/unknown band/);
  });

  test("rejects a licence that expires at or before it starts", () => {
    expect(() =>
      service.registerLicence({
        licenceId: "lic-instant",
        venueId: ARTS,
        bandId: BAND_UHF,
        validFrom: day(1),
        validUntil: day(1),
      }),
    ).toThrow(/expires at or before/);
  });

  test("rejects a transmitter with an inverted tuning range", () => {
    expect(() =>
      service.registerTransmitter({
        transmitterId: "tx-inverted",
        label: "Inverted",
        tuningStartKhz: 614_000,
        tuningEndKhz: 606_000,
      }),
    ).toThrow(/inverted tuning range/);
  });

  test("rejects a plan whose window ends at or before it starts", () => {
    expect(() =>
      service.createPlan({
        planId: "plan-instant",
        venueId: ARTS,
        label: "Instant",
        windowStart: hour(4),
        windowEnd: hour(4),
      }),
    ).toThrow(/ends at or before/);
  });

  test("getPlan returns null for a plan that was never created", () => {
    expect(service.getPlan("plan-imaginary")).toBeNull();
  });

  test("getPlan hands back a copy rather than the live plan", () => {
    service.assign(PLAN, HANDHELD, 606_000, DOORS);
    const snapshot = service.getPlan(PLAN);
    snapshot?.assignments.pop();

    expect(service.getPlan(PLAN)?.assignments).toHaveLength(1);
  });
});

describe("RfFrequencyCoordinationService — configurable margins", () => {
  test("a wider minimum spacing refuses a channel the default would accept", () => {
    const service = new RfFrequencyCoordinationService({ minSpacingKhz: 1_000 });
    service.registerBand({
      bandId: BAND_UHF,
      label: "UHF Channel 38",
      kind: "EXEMPT",
      startKhz: 606_000,
      endKhz: 614_000,
      stepKhz: 25,
    });
    service.registerTransmitter({
      transmitterId: HANDHELD,
      label: "Handheld 1",
      tuningStartKhz: 606_000,
      tuningEndKhz: 614_000,
    });
    service.registerTransmitter({
      transmitterId: HANDHELD_2,
      label: "Handheld 2",
      tuningStartKhz: 606_000,
      tuningEndKhz: 614_000,
    });
    service.createPlan({
      planId: PLAN,
      venueId: ARTS,
      label: "Winter showcase",
      windowStart: hour(-2),
      windowEnd: hour(4),
    });

    service.assign(PLAN, HANDHELD, 606_000, DOORS);

    expect(service.assign(PLAN, HANDHELD_2, 606_500, DOORS).outcome).toBe(
      "REFUSED_ADJACENT_CHANNEL",
    );
  });

  test("a narrower intermodulation guard lets a near-miss product through", () => {
    const tight = new RfFrequencyCoordinationService({ intermodGuardKhz: 10 });

    expect(tight.findIntermodulation([500_000, 502_000, 504_050])).toBeNull();
    expect(tight.findIntermodulation([500_000, 502_000, 504_005])).not.toBeNull();
  });
});
