/**
 * Test suite: Prize Draw Compliance (#4925)
 * File: tests/services/prizeDrawComplianceService.test.ts
 *
 * The cases that matter are the ones where the committee's own arithmetic says
 * everything is fine: a donated prize that cost nothing and counts at £600, a
 * rollover that lands on top of this week's pool rather than instead of it, a
 * ticket sold to somebody who was not at the event, and a redraw run before the
 * first winner had a chance to come forward.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  PrizeDrawComplianceService,
  INCIDENTAL_PRIZE_CAP_PENCE,
  MINIMUM_ENTRY_AGE_YEARS,
} from "../../src/services/prizeDrawComplianceService";

const SOCIETY = "soc-rugby-club";
const HOST_EVENT = "event-home-game-vs-city";

const ADULT_A = "user-alex";
const ADULT_B = "user-bea";
const ADULT_C = "user-chris";
const ADULT_D = "user-dev";
const MINOR = "user-sam-fifteen";
const JUST_SIXTEEN = "user-noor-sixteen";
const OPERATOR = "user-treasurer";
const ABSENTEE = "user-remote-alum";

const RAFFLE = "draw-strip-raffle";
const SOCIAL = "draw-members-only";
const POT = "draw-fifty-fifty";

const DRAW_AT = new Date("2027-11-06T16:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 86_400_000;

const CLAIM_WINDOW_MS = 7 * DAY;

function hour(offset: number): Date {
  return new Date(DRAW_AT.getTime() + offset * HOUR);
}

function day(offset: number): Date {
  return new Date(DRAW_AT.getTime() + offset * DAY);
}

/** Born exactly `years` before the moment tickets go on sale at hour(-2). */
function bornYearsBeforeSale(years: number, dayShift = 0): Date {
  const sale = hour(-2);
  return new Date(
    Date.UTC(
      sale.getUTCFullYear() - years,
      sale.getUTCMonth(),
      sale.getUTCDate() + dayShift,
      sale.getUTCHours(),
      sale.getUTCMinutes(),
    ),
  );
}

function build(): PrizeDrawComplianceService {
  const service = new PrizeDrawComplianceService();

  service.registerEntrant({ entrantId: ADULT_A, name: "Alex", bornOn: bornYearsBeforeSale(22) });
  service.registerEntrant({ entrantId: ADULT_B, name: "Bea", bornOn: bornYearsBeforeSale(21) });
  service.registerEntrant({ entrantId: ADULT_C, name: "Chris", bornOn: bornYearsBeforeSale(24) });
  service.registerEntrant({ entrantId: ADULT_D, name: "Dev", bornOn: bornYearsBeforeSale(20) });
  service.registerEntrant({ entrantId: MINOR, name: "Sam", bornOn: bornYearsBeforeSale(15) });
  // Sixteen to the hour on the day tickets go on sale.
  service.registerEntrant({
    entrantId: JUST_SIXTEEN,
    name: "Noor",
    bornOn: bornYearsBeforeSale(MINIMUM_ENTRY_AGE_YEARS),
  });
  service.registerEntrant({ entrantId: OPERATOR, name: "Robin", bornOn: bornYearsBeforeSale(23) });
  service.registerEntrant({ entrantId: ABSENTEE, name: "Pat", bornOn: bornYearsBeforeSale(30) });

  for (const entrantId of [ADULT_A, ADULT_B, ADULT_C, ADULT_D, MINOR, JUST_SIXTEEN, OPERATOR]) {
    service.recordAttendance(HOST_EVENT, entrantId);
  }

  service.openDraw({
    drawId: RAFFLE,
    societyId: SOCIETY,
    type: "INCIDENTAL",
    label: "Half-time strip raffle",
    ticketPricePence: 200,
    salesOpenAt: hour(-4),
    salesCloseAt: hour(0),
    drawAt: hour(0),
    claimWindowMs: CLAIM_WINDOW_MS,
    operatorId: OPERATOR,
    hostEventId: HOST_EVENT,
  });

  return service;
}

function openSocialDraw(service: PrizeDrawComplianceService): void {
  service.openDraw({
    drawId: SOCIAL,
    societyId: SOCIETY,
    type: "PRIVATE_SOCIETY",
    label: "Members-only draw",
    ticketPricePence: 500,
    salesOpenAt: hour(-4),
    salesCloseAt: hour(0),
    drawAt: hour(0),
    claimWindowMs: CLAIM_WINDOW_MS,
    operatorId: OPERATOR,
    hostEventId: null,
  });
}

function openSplitPot(service: PrizeDrawComplianceService, ticketPricePence: number): void {
  service.openDraw({
    drawId: POT,
    societyId: SOCIETY,
    type: "SPLIT_POT",
    label: "Fifty-fifty",
    ticketPricePence,
    salesOpenAt: hour(-4),
    salesCloseAt: hour(0),
    drawAt: hour(0),
    claimWindowMs: CLAIM_WINDOW_MS,
    operatorId: OPERATOR,
    hostEventId: null,
  });
}

function enterAll(service: PrizeDrawComplianceService, drawId: string, entrantIds: string[]): void {
  for (const entrantId of entrantIds) {
    service.enterDraw(drawId, entrantId, hour(-2));
  }
}

describe("PrizeDrawComplianceService — the prize pool is valued, not costed", () => {
  let service: PrizeDrawComplianceService;

  beforeEach(() => {
    service = build();
  });

  test("accepts a prize inside the cap", () => {
    const result = service.addPrize({
      prizeId: "prize-shirt",
      drawId: RAFFLE,
      description: "Signed shirt",
      marketValuePence: 20_000,
      donated: false,
      rolledOverFromDrawId: null,
    });

    expect(result.outcome).toBe("ADDED");
    expect(result.totalValuePence).toBe(20_000);
    expect(result.capPence).toBe(INCIDENTAL_PRIZE_CAP_PENCE);
  });

  test("a donated prize counts at market value even though it cost nothing", () => {
    service.addPrize({
      prizeId: "prize-shirt",
      drawId: RAFFLE,
      description: "Signed shirt",
      marketValuePence: 20_000,
      donated: false,
      rolledOverFromDrawId: null,
    });

    const donated = service.addPrize({
      prizeId: "prize-weekend",
      drawId: RAFFLE,
      description: "Weekend in a cottage",
      marketValuePence: 40_000,
      donated: true,
      rolledOverFromDrawId: null,
    });

    expect(donated.outcome).toBe("REFUSED_EXCEEDS_CAP");
    expect(donated.overCapPence).toBe(10_000);
    expect(donated.detail).toContain("donated prizes count at market value");
  });

  test("the breach is reported as an amount rather than a boolean", () => {
    const result = service.addPrize({
      prizeId: "prize-huge",
      drawId: RAFFLE,
      description: "Season tickets",
      marketValuePence: 75_000,
      donated: false,
      rolledOverFromDrawId: null,
    });

    expect(result.overCapPence).toBe(25_000);
    expect(result.detail).toContain("£250.00 over");
  });

  test("a refused prize is not added to the pool", () => {
    service.addPrize({
      prizeId: "prize-huge",
      drawId: RAFFLE,
      description: "Season tickets",
      marketValuePence: 75_000,
      donated: false,
      rolledOverFromDrawId: null,
    });

    expect(service.prizePoolValue(RAFFLE)).toBe(0);
    expect(service.prizesFor(RAFFLE)).toHaveLength(0);
  });

  test("a rolled-over prize lands on top of this week's pool, not instead of it", () => {
    service.openDraw({
      drawId: "draw-last-week",
      societyId: SOCIETY,
      type: "INCIDENTAL",
      label: "Last week's raffle",
      ticketPricePence: 200,
      salesOpenAt: day(-8),
      salesCloseAt: day(-7),
      drawAt: day(-7),
      claimWindowMs: CLAIM_WINDOW_MS,
      operatorId: OPERATOR,
      hostEventId: HOST_EVENT,
    });
    service.addPrize({
      prizeId: "prize-last-week",
      drawId: "draw-last-week",
      description: "Hamper",
      marketValuePence: 15_000,
      donated: true,
      rolledOverFromDrawId: null,
    });
    service.addPrize({
      prizeId: "prize-this-week",
      drawId: RAFFLE,
      description: "Signed shirt",
      marketValuePence: 20_000,
      donated: false,
      rolledOverFromDrawId: null,
    });

    const rolled = service.rollOverPrize("prize-last-week", RAFFLE, "prize-rolled");

    expect(rolled.outcome).toBe("ADDED");
    expect(service.prizePoolValue(RAFFLE)).toBe(35_000);
    expect(rolled.prize?.rolledOverFromDrawId).toBe("draw-last-week");
  });

  test("a rollover can breach the cap without anybody spending a penny", () => {
    service.openDraw({
      drawId: "draw-last-week",
      societyId: SOCIETY,
      type: "INCIDENTAL",
      label: "Last week's raffle",
      ticketPricePence: 200,
      salesOpenAt: day(-8),
      salesCloseAt: day(-7),
      drawAt: day(-7),
      claimWindowMs: CLAIM_WINDOW_MS,
      operatorId: OPERATOR,
      hostEventId: HOST_EVENT,
    });
    service.addPrize({
      prizeId: "prize-last-week",
      drawId: "draw-last-week",
      description: "Hamper",
      marketValuePence: 30_000,
      donated: true,
      rolledOverFromDrawId: null,
    });
    service.addPrize({
      prizeId: "prize-this-week",
      drawId: RAFFLE,
      description: "Signed shirt",
      marketValuePence: 30_000,
      donated: true,
      rolledOverFromDrawId: null,
    });

    const rolled = service.rollOverPrize("prize-last-week", RAFFLE, "prize-rolled");

    expect(rolled.outcome).toBe("REFUSED_EXCEEDS_CAP");
    expect(rolled.overCapPence).toBe(10_000);
  });

  test("a private society draw is not capped the same way", () => {
    openSocialDraw(service);

    const result = service.addPrize({
      prizeId: "prize-big",
      drawId: SOCIAL,
      description: "Ski trip",
      marketValuePence: 250_000,
      donated: true,
      rolledOverFromDrawId: null,
    });

    expect(result.outcome).toBe("ADDED");
    expect(result.capPence).toBeNull();
    expect(service.capFor("PRIVATE_SOCIETY")).toBeNull();
  });

  test("refuses a prize on a draw that has already been drawn", () => {
    enterAll(service, RAFFLE, [ADULT_A]);
    service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(
      service.addPrize({
        prizeId: "prize-late",
        drawId: RAFFLE,
        description: "Late addition",
        marketValuePence: 1_000,
        donated: false,
        rolledOverFromDrawId: null,
      }).outcome,
    ).toBe("REFUSED_DRAW_NOT_OPEN");
  });

  test("refuses a prize on a draw that does not exist", () => {
    expect(
      service.addPrize({
        prizeId: "prize-orphan",
        drawId: "draw-imaginary",
        description: "Nothing",
        marketValuePence: 100,
        donated: false,
        rolledOverFromDrawId: null,
      }).outcome,
    ).toBe("REFUSED_DRAW_NOT_OPEN");
  });

  test("rejects a prize with a negative market value", () => {
    expect(() =>
      service.addPrize({
        prizeId: "prize-negative",
        drawId: RAFFLE,
        description: "Owed money",
        marketValuePence: -1,
        donated: false,
        rolledOverFromDrawId: null,
      }),
    ).toThrow(/negative market value/);
  });

  test("rolling over a prize that does not exist throws", () => {
    expect(() => service.rollOverPrize("prize-imaginary", RAFFLE, "prize-new")).toThrow(
      /does not exist/,
    );
  });
});

describe("PrizeDrawComplianceService — revaluation surfaces at the draw", () => {
  let service: PrizeDrawComplianceService;

  beforeEach(() => {
    service = build();
    service.addPrize({
      prizeId: "prize-shirt",
      drawId: RAFFLE,
      description: "Signed shirt",
      marketValuePence: 20_000,
      donated: true,
      rolledOverFromDrawId: null,
    });
    enterAll(service, RAFFLE, [ADULT_A, ADULT_B]);
  });

  test("a valuation is a fact, so revaluing never refuses", () => {
    expect(service.revaluePrize("prize-shirt", 70_000)).toBe(70_000);
  });

  test("but the draw refuses to run an over-cap pool", () => {
    service.revaluePrize("prize-shirt", 70_000);

    const result = service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(result.outcome).toBe("REFUSED_EXCEEDS_CAP");
    expect(result.detail).toContain("£200.00 over");
  });

  test("withdrawing the prize brings the pool back under the cap", () => {
    service.revaluePrize("prize-shirt", 70_000);
    expect(service.runDraw(RAFFLE, "seed-1", DRAW_AT).outcome).toBe("REFUSED_EXCEEDS_CAP");

    expect(service.withdrawPrize("prize-shirt")).toBe(true);

    expect(service.runDraw(RAFFLE, "seed-1", DRAW_AT).outcome).toBe("DRAWN");
  });

  test("a refused draw leaves the draw open rather than half-run", () => {
    service.revaluePrize("prize-shirt", 70_000);
    service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(service.getDraw(RAFFLE)?.status).toBe("OPEN");
    expect(service.getSnapshot(RAFFLE)).toBeNull();
  });

  test("a prize cannot be withdrawn once the draw has run", () => {
    service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(service.withdrawPrize("prize-shirt")).toBe(false);
  });

  test("revaluing below zero throws", () => {
    expect(() => service.revaluePrize("prize-shirt", -1)).toThrow(/below zero/);
  });

  test("revaluing a prize that does not exist throws", () => {
    expect(() => service.revaluePrize("prize-imaginary", 100)).toThrow(/does not exist/);
  });

  test("withdrawing a prize that does not exist reports no change", () => {
    expect(service.withdrawPrize("prize-imaginary")).toBe(false);
  });
});

describe("PrizeDrawComplianceService — who may enter, and when", () => {
  let service: PrizeDrawComplianceService;

  beforeEach(() => {
    service = build();
  });

  test("accepts an entrant who is present, of age, and not running the draw", () => {
    const result = service.enterDraw(RAFFLE, ADULT_A, hour(-2));

    expect(result.outcome).toBe("ACCEPTED");
    expect(result.entry?.pricePaidPence).toBe(200);
    expect(result.entry?.banked).toBe(true);
  });

  test("refuses a sale before the window opens", () => {
    expect(service.enterDraw(RAFFLE, ADULT_A, hour(-5)).outcome).toBe("REFUSED_SALES_NOT_STARTED");
  });

  test("refuses a sale at the instant the window closes", () => {
    expect(service.enterDraw(RAFFLE, ADULT_A, hour(0)).outcome).toBe("REFUSED_SALES_CLOSED");
  });

  test("refuses a sale after the window closes", () => {
    expect(service.enterDraw(RAFFLE, ADULT_A, hour(1)).outcome).toBe("REFUSED_SALES_CLOSED");
  });

  test("refuses the person operating the draw", () => {
    const result = service.enterDraw(RAFFLE, OPERATOR, hour(-2));

    expect(result.outcome).toBe("REFUSED_OPERATOR");
    expect(result.detail).toContain("operating the draw");
  });

  test("refuses an entrant below the minimum age", () => {
    const result = service.enterDraw(RAFFLE, MINOR, hour(-2));

    expect(result.outcome).toBe("REFUSED_UNDER_AGE");
    expect(result.detail).toContain(String(MINIMUM_ENTRY_AGE_YEARS));
  });

  test("accepts an entrant who reaches the minimum age on the day", () => {
    expect(service.enterDraw(RAFFLE, JUST_SIXTEEN, hour(-2)).outcome).toBe("ACCEPTED");
  });

  test("refuses the same entrant a day before their birthday", () => {
    service.registerEntrant({
      entrantId: "user-day-short",
      name: "Kit",
      bornOn: bornYearsBeforeSale(MINIMUM_ENTRY_AGE_YEARS, 1),
    });
    service.recordAttendance(HOST_EVENT, "user-day-short");

    expect(service.enterDraw(RAFFLE, "user-day-short", hour(-2)).outcome).toBe("REFUSED_UNDER_AGE");
  });

  test("refuses somebody who is not at the event an incidental draw is incidental to", () => {
    const result = service.enterDraw(RAFFLE, ABSENTEE, hour(-2));

    expect(result.outcome).toBe("REFUSED_NOT_AT_EVENT");
    expect(result.detail).toContain("incidental lottery exemption");
  });

  test("a private society draw does not depend on attendance", () => {
    openSocialDraw(service);

    expect(service.enterDraw(SOCIAL, ABSENTEE, hour(-2)).outcome).toBe("ACCEPTED");
  });

  test("refuses an entrant nobody has registered", () => {
    expect(service.enterDraw(RAFFLE, "user-ghost", hour(-2)).outcome).toBe(
      "REFUSED_UNKNOWN_ENTRANT",
    );
  });

  test("refuses entry to a draw that does not exist", () => {
    expect(service.enterDraw("draw-imaginary", ADULT_A, hour(-2)).outcome).toBe(
      "REFUSED_UNKNOWN_DRAW",
    );
  });

  test("refuses entry once the draw has been run", () => {
    enterAll(service, RAFFLE, [ADULT_A]);
    service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(service.enterDraw(RAFFLE, ADULT_B, hour(-2)).outcome).toBe("REFUSED_DRAW_NOT_OPEN");
  });

  test("a comped ticket is recorded at zero and is not banked", () => {
    const result = service.enterDraw(RAFFLE, ADULT_A, hour(-2), false);

    expect(result.entry?.pricePaidPence).toBe(0);
    expect(result.entry?.banked).toBe(false);
  });

  test("banked revenue counts only tickets whose cash arrived", () => {
    service.enterDraw(RAFFLE, ADULT_A, hour(-2));
    service.enterDraw(RAFFLE, ADULT_B, hour(-2));
    service.enterDraw(RAFFLE, ADULT_C, hour(-2), false);

    expect(service.entriesFor(RAFFLE)).toHaveLength(3);
    expect(service.bankedRevenue(RAFFLE)).toBe(400);
  });
});

describe("PrizeDrawComplianceService — freezing the entrant set", () => {
  let service: PrizeDrawComplianceService;

  beforeEach(() => {
    service = build();
  });

  test("refuses to draw before the draw instant", () => {
    enterAll(service, RAFFLE, [ADULT_A]);

    expect(service.runDraw(RAFFLE, "seed-1", hour(-1)).outcome).toBe("REFUSED_TOO_EARLY");
  });

  test("refuses to draw with nothing in the bucket", () => {
    expect(service.runDraw(RAFFLE, "seed-1", DRAW_AT).outcome).toBe("REFUSED_NO_ENTRIES");
  });

  test("refuses to draw a draw that does not exist", () => {
    expect(service.runDraw("draw-imaginary", "seed-1", DRAW_AT).outcome).toBe(
      "REFUSED_UNKNOWN_DRAW",
    );
  });

  test("takes a snapshot of exactly the entries that existed", () => {
    enterAll(service, RAFFLE, [ADULT_A, ADULT_B, ADULT_C]);

    const result = service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(result.snapshot?.entryIds).toHaveLength(3);
    expect(result.snapshot?.takenAt).toEqual(DRAW_AT);
  });

  test("the snapshot is ordered independently of insertion order", () => {
    enterAll(service, RAFFLE, [ADULT_C, ADULT_A, ADULT_B]);

    const entryIds = service.runDraw(RAFFLE, "seed-1", DRAW_AT).snapshot?.entryIds as string[];

    expect(entryIds).toEqual([...entryIds].sort());
  });

  test("the digest changes when the entrant set changes", () => {
    const smaller = build();
    enterAll(smaller, RAFFLE, [ADULT_A, ADULT_B]);
    const larger = build();
    enterAll(larger, RAFFLE, [ADULT_A, ADULT_B, ADULT_C]);

    expect(smaller.runDraw(RAFFLE, "seed-1", DRAW_AT).snapshot?.digest).not.toBe(
      larger.runDraw(RAFFLE, "seed-1", DRAW_AT).snapshot?.digest,
    );
  });

  test("the winner comes from the frozen set", () => {
    enterAll(service, RAFFLE, [ADULT_A, ADULT_B, ADULT_C]);

    const result = service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(result.snapshot?.entryIds).toContain(result.result?.winningEntryId);
  });

  test("refuses to run the same draw twice", () => {
    enterAll(service, RAFFLE, [ADULT_A]);
    service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(service.runDraw(RAFFLE, "seed-2", DRAW_AT).outcome).toBe("REFUSED_ALREADY_DRAWN");
  });

  test("the result records the seed and the digest it was drawn against", () => {
    enterAll(service, RAFFLE, [ADULT_A, ADULT_B]);

    const result = service.runDraw(RAFFLE, "seed-committee-2027", DRAW_AT);

    expect(result.result?.seed).toBe("seed-committee-2027");
    expect(result.result?.snapshotDigest).toBe(result.snapshot?.digest);
  });

  test("the same snapshot and seed always produce the same winner", () => {
    const first = build();
    enterAll(first, RAFFLE, [ADULT_A, ADULT_B, ADULT_C, ADULT_D]);
    const second = build();
    enterAll(second, RAFFLE, [ADULT_A, ADULT_B, ADULT_C, ADULT_D]);

    expect(first.runDraw(RAFFLE, "seed-1", DRAW_AT).result?.winningEntryId).toBe(
      second.runDraw(RAFFLE, "seed-1", DRAW_AT).result?.winningEntryId,
    );
  });

  test("the seed actually moves the selection", () => {
    const winners = new Set<string>();
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const attempt = build();
      enterAll(attempt, RAFFLE, [ADULT_A, ADULT_B, ADULT_C, ADULT_D]);
      winners.add(attempt.runDraw(RAFFLE, seed, DRAW_AT).result?.winningEntryId as string);
    }

    expect(winners.size).toBeGreaterThan(1);
  });

  test("an auditor with the stored seed and snapshot reaches the same entry", () => {
    enterAll(service, RAFFLE, [ADULT_A, ADULT_B, ADULT_C, ADULT_D]);
    const result = service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(service.reproduce(RAFFLE, 1)).toBe(result.result?.winningEntryId);
  });

  test("reproduce returns null for a round that was never run", () => {
    enterAll(service, RAFFLE, [ADULT_A]);
    service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(service.reproduce(RAFFLE, 2)).toBeNull();
    expect(service.reproduce("draw-imaginary", 1)).toBeNull();
  });

  test("getSnapshot hands back a copy rather than the frozen set", () => {
    enterAll(service, RAFFLE, [ADULT_A, ADULT_B]);
    service.runDraw(RAFFLE, "seed-1", DRAW_AT);

    service.getSnapshot(RAFFLE)?.entryIds.pop();

    expect(service.getSnapshot(RAFFLE)?.entryIds).toHaveLength(2);
  });
});

describe("PrizeDrawComplianceService — a split pot divides what was banked", () => {
  let service: PrizeDrawComplianceService;

  beforeEach(() => {
    service = build();
  });

  test("splits banked revenue down the middle", () => {
    openSplitPot(service, 500);
    enterAll(service, POT, [ADULT_A, ADULT_B, ADULT_C, ADULT_D]);

    const result = service.runDraw(POT, "seed-1", DRAW_AT).result;

    expect(result?.winnerSharePence).toBe(1_000);
    expect(result?.societySharePence).toBe(1_000);
  });

  test("an odd penny goes to the society, and the shares reconstruct the total", () => {
    openSplitPot(service, 25);
    enterAll(service, POT, [ADULT_A, ADULT_B, ADULT_C]);

    const result = service.runDraw(POT, "seed-1", DRAW_AT).result;

    expect(result?.winnerSharePence).toBe(37);
    expect(result?.societySharePence).toBe(38);
    expect((result?.winnerSharePence as number) + (result?.societySharePence as number)).toBe(
      service.bankedRevenue(POT),
    );
  });

  test("comped tickets are entries but not revenue", () => {
    openSplitPot(service, 500);
    enterAll(service, POT, [ADULT_A, ADULT_B]);
    service.enterDraw(POT, ADULT_C, hour(-2), false);

    const result = service.runDraw(POT, "seed-1", DRAW_AT);

    expect(result.snapshot?.entryIds).toHaveLength(3);
    expect(result.result?.winnerSharePence).toBe(500);
  });

  test("a draw that is not a split pot carries no shares", () => {
    enterAll(service, RAFFLE, [ADULT_A]);

    const result = service.runDraw(RAFFLE, "seed-1", DRAW_AT).result;

    expect(result?.winnerSharePence).toBeNull();
    expect(result?.societySharePence).toBeNull();
  });
});

describe("PrizeDrawComplianceService — claiming and redrawing", () => {
  let service: PrizeDrawComplianceService;
  let winnerEntrantId: string;

  beforeEach(() => {
    service = build();
    enterAll(service, RAFFLE, [ADULT_A, ADULT_B, ADULT_C, ADULT_D]);
    winnerEntrantId = service.runDraw(RAFFLE, "seed-1", DRAW_AT).result?.winnerEntrantId as string;
  });

  test("the winner can claim inside the window", () => {
    expect(service.claimPrize(RAFFLE, winnerEntrantId, day(1))).toBe(true);
    expect(service.currentResult(RAFFLE)?.claimedAt).toEqual(day(1));
  });

  test("somebody who did not win cannot claim", () => {
    const loser = [ADULT_A, ADULT_B, ADULT_C, ADULT_D].find((id) => id !== winnerEntrantId);

    expect(service.claimPrize(RAFFLE, loser as string, day(1))).toBe(false);
  });

  test("a claim after the deadline fails", () => {
    expect(service.claimPrize(RAFFLE, winnerEntrantId, day(8))).toBe(false);
  });

  test("a claim at the deadline instant fails", () => {
    expect(service.claimPrize(RAFFLE, winnerEntrantId, day(7))).toBe(false);
  });

  test("claiming twice fails", () => {
    service.claimPrize(RAFFLE, winnerEntrantId, day(1));

    expect(service.claimPrize(RAFFLE, winnerEntrantId, day(2))).toBe(false);
  });

  test("refuses a redraw while the winner still has time to come forward", () => {
    const result = service.redraw(RAFFLE, "seed-2", day(3));

    expect(result.outcome).toBe("REFUSED_CLAIM_WINDOW_OPEN");
    expect(result.detail).toContain(day(7).toISOString());
  });

  test("refuses a redraw once the prize has been claimed", () => {
    service.claimPrize(RAFFLE, winnerEntrantId, day(1));

    expect(service.redraw(RAFFLE, "seed-2", day(8)).outcome).toBe("REFUSED_ALREADY_CLAIMED");
  });

  test("redraws once the claim window has closed", () => {
    const result = service.redraw(RAFFLE, "seed-2", day(8));

    expect(result.outcome).toBe("REDRAWN");
    expect(result.result?.round).toBe(2);
  });

  test("the redraw excludes the entry that already won", () => {
    const original = service.currentResult(RAFFLE)?.winningEntryId;

    const result = service.redraw(RAFFLE, "seed-2", day(8));

    expect(result.result?.winningEntryId).not.toBe(original);
  });

  test("the redraw comes from the set frozen at the original draw", () => {
    const digest = service.getSnapshot(RAFFLE)?.digest;

    expect(service.redraw(RAFFLE, "seed-2", day(8)).result?.snapshotDigest).toBe(digest);
  });

  test("the original result is superseded rather than overwritten", () => {
    service.redraw(RAFFLE, "seed-2", day(8));
    const rounds = service.getResults(RAFFLE);

    expect(rounds).toHaveLength(2);
    expect(rounds[0].supersededByRound).toBe(2);
    expect(rounds[0].winnerEntrantId).toBe(winnerEntrantId);
  });

  test("currentResult is the latest round nothing has superseded", () => {
    service.redraw(RAFFLE, "seed-2", day(8));

    expect(service.currentResult(RAFFLE)?.round).toBe(2);
  });

  test("a third round excludes both previous winners", () => {
    const first = service.currentResult(RAFFLE)?.winningEntryId;
    service.redraw(RAFFLE, "seed-2", day(8));
    const second = service.currentResult(RAFFLE)?.winningEntryId;

    const third = service.redraw(RAFFLE, "seed-3", day(16));

    expect(third.outcome).toBe("REDRAWN");
    expect(third.result?.winningEntryId).not.toBe(first);
    expect(third.result?.winningEntryId).not.toBe(second);
  });

  test("a redraw is reproducible from its own recorded seed", () => {
    const result = service.redraw(RAFFLE, "seed-2", day(8));

    expect(service.reproduce(RAFFLE, 2)).toBe(result.result?.winningEntryId);
  });

  test("refuses a redraw when every frozen entry has been drawn", () => {
    const single = build();
    single.enterDraw(RAFFLE, ADULT_A, hour(-2));
    single.runDraw(RAFFLE, "seed-1", DRAW_AT);

    expect(single.redraw(RAFFLE, "seed-2", day(8)).outcome).toBe("REFUSED_NO_REMAINING_ENTRIES");
  });

  test("refuses a redraw on a draw that has never been drawn", () => {
    const untouched = build();

    expect(untouched.redraw(RAFFLE, "seed-2", day(8)).outcome).toBe("REFUSED_NOT_DRAWN");
  });

  test("claiming against a draw that was never drawn fails", () => {
    const untouched = build();

    expect(untouched.claimPrize(RAFFLE, ADULT_A, day(1))).toBe(false);
  });
});

describe("PrizeDrawComplianceService — opening guards", () => {
  let service: PrizeDrawComplianceService;

  beforeEach(() => {
    service = build();
  });

  function openWith(overrides: Record<string, unknown>): void {
    service.openDraw({
      drawId: "draw-guard",
      societyId: SOCIETY,
      type: "PRIVATE_SOCIETY",
      label: "Guard",
      ticketPricePence: 100,
      salesOpenAt: hour(-4),
      salesCloseAt: hour(0),
      drawAt: hour(0),
      claimWindowMs: CLAIM_WINDOW_MS,
      operatorId: OPERATOR,
      hostEventId: null,
      ...overrides,
    } as Parameters<PrizeDrawComplianceService["openDraw"]>[0]);
  }

  test("rejects sales closing at or before they open", () => {
    expect(() => openWith({ salesCloseAt: hour(-4) })).toThrow(/closes sales at or before/);
  });

  test("rejects a draw instant before its sales close", () => {
    expect(() => openWith({ drawAt: hour(-1) })).toThrow(/drawn before its sales close/);
  });

  test("rejects a non-positive claim window", () => {
    expect(() => openWith({ claimWindowMs: 0 })).toThrow(/non-positive claim window/);
  });

  test("rejects an incidental draw with no host event", () => {
    expect(() => openWith({ type: "INCIDENTAL", hostEventId: null })).toThrow(
      /names no host event/,
    );
  });

  test("a draw opens in the open state", () => {
    openWith({});

    expect(service.getDraw("draw-guard")?.status).toBe("OPEN");
  });

  test("closing a draw stops further entry", () => {
    expect(service.closeDraw(RAFFLE)).toBe(true);
    expect(service.enterDraw(RAFFLE, ADULT_A, hour(-2)).outcome).toBe("REFUSED_DRAW_NOT_OPEN");
  });

  test("closing twice reports no second change", () => {
    service.closeDraw(RAFFLE);

    expect(service.closeDraw(RAFFLE)).toBe(false);
  });

  test("getters return nothing for records that were never created", () => {
    expect(service.getDraw("draw-imaginary")).toBeNull();
    expect(service.getSnapshot("draw-imaginary")).toBeNull();
    expect(service.getResults("draw-imaginary")).toEqual([]);
    expect(service.currentResult("draw-imaginary")).toBeNull();
  });
});
