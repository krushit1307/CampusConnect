/**
 * Module: Prize Draw Compliance
 * File: src/services/prizeDrawComplianceService.ts
 * Scope: Freezes the entrant set before the draw, selects from that frozen set
 *        by a recorded reproducible method, and measures the exemption limits
 *        against prize market value rather than cash spent (#4925).
 *
 * A raffle is a lottery, and a small lottery is only exempt from licensing
 * while it stays inside limits the people running it have never read. Three of
 * those limits are quantitative and every one of them is measured against a
 * number the committee is not tracking.
 *
 * The prize cap is on what the prize is *worth*, not on what it cost. A £600
 * prize donated by a local business costs the society nothing and still counts
 * at market value. Committees track cash out, so a donated prize registers as
 * zero and the cap is breached by an amount nobody can see. Rolling an undrawn
 * prize forward compounds it, because last week's prize arrives on top of this
 * week's rather than instead of it.
 *
 * The exemption for an incidental lottery also depends on *where* the tickets
 * were sold. Selling online for a week before the ball feels like good
 * marketing and is the thing that ends the exemption.
 *
 * And the draw itself is the part that cannot be reconstructed. Somebody pulls
 * a ticket, announces a number, and the only record is the announcement. If a
 * losing entrant asks whether the winning ticket was in the bucket there is no
 * answer; if the winner is the treasurer's housemate there is no way to show it
 * was fair, and no way to show it was not. So the entrant set is frozen into a
 * digest before anything is drawn, and the winner is selected from that frozen
 * set by a seeded function that an auditor can run again.
 *
 * Money is integer pence throughout, and a split pot divides banked revenue
 * rather than tickets issued. Unsold and comped tickets are not revenue, and
 * dividing a float in half gives a winner £0.005 more than the society.
 */

export type DrawType = "INCIDENTAL" | "PRIVATE_SOCIETY" | "SPLIT_POT";

export type DrawStatus = "OPEN" | "DRAWN" | "CLOSED";

export type PrizeOutcome = "ADDED" | "REFUSED_EXCEEDS_CAP" | "REFUSED_DRAW_NOT_OPEN";

export type EntryOutcome =
  | "ACCEPTED"
  | "REFUSED_UNKNOWN_DRAW"
  | "REFUSED_UNKNOWN_ENTRANT"
  | "REFUSED_DRAW_NOT_OPEN"
  | "REFUSED_SALES_NOT_STARTED"
  | "REFUSED_SALES_CLOSED"
  | "REFUSED_NOT_AT_EVENT"
  | "REFUSED_UNDER_AGE"
  | "REFUSED_OPERATOR";

export type DrawOutcome =
  | "DRAWN"
  | "REFUSED_UNKNOWN_DRAW"
  | "REFUSED_NO_ENTRIES"
  | "REFUSED_TOO_EARLY"
  | "REFUSED_ALREADY_DRAWN"
  | "REFUSED_EXCEEDS_CAP";

export type RedrawOutcome =
  | "REDRAWN"
  | "REFUSED_NOT_DRAWN"
  | "REFUSED_CLAIM_WINDOW_OPEN"
  | "REFUSED_ALREADY_CLAIMED"
  | "REFUSED_NO_REMAINING_ENTRIES";

export interface Entrant {
  entrantId: string;
  name: string;
  bornOn: Date;
}

export interface PrizeDraw {
  drawId: string;
  societyId: string;
  type: DrawType;
  label: string;
  /** Integer pence. Comped tickets are recorded at zero, not omitted. */
  ticketPricePence: number;
  salesOpenAt: Date;
  salesCloseAt: Date;
  drawAt: Date;
  /** How long a winner has to come forward before a redraw becomes possible. */
  claimWindowMs: number;
  /** The person operating the draw, who cannot be in it. */
  operatorId: string;
  /** For an incidental draw: the event the lottery is incidental to. */
  hostEventId: string | null;
  status: DrawStatus;
}

export interface DrawPrize {
  prizeId: string;
  drawId: string;
  description: string;
  /**
   * What the prize is worth, not what it cost. A donated prize costs nothing
   * and counts here at full value, because the cap is on value.
   */
  marketValuePence: number;
  donated: boolean;
  /** Set when this prize arrived from a previous draw that went undrawn. */
  rolledOverFromDrawId: string | null;
}

export interface DrawEntry {
  entryId: string;
  drawId: string;
  entrantId: string;
  pricePaidPence: number;
  /** False for a comped ticket or one whose cash never reached the account. */
  banked: boolean;
  purchasedAt: Date;
}

/**
 * The entrant set as it stood at the draw instant. Immutable by construction:
 * nothing mutates a snapshot, and a later entry cannot be folded into one.
 */
export interface DrawSnapshot {
  drawId: string;
  takenAt: Date;
  /** Lexicographically sorted, so the ordering does not depend on insertion. */
  entryIds: string[];
  digest: string;
}

export interface DrawResult {
  drawId: string;
  /** 1 for the original draw; 2 and up for each redraw. */
  round: number;
  winningEntryId: string;
  winnerEntrantId: string;
  /** Stored with the result so an auditor can reproduce the selection. */
  seed: string;
  snapshotDigest: string;
  drawnAt: Date;
  claimDeadline: Date;
  claimedAt: Date | null;
  /** Set when a later redraw superseded this result. */
  supersededByRound: number | null;
  /** Split-pot only. Integer pence. */
  winnerSharePence: number | null;
  societySharePence: number | null;
}

export interface PrizeResult {
  outcome: PrizeOutcome;
  prize: DrawPrize | null;
  totalValuePence: number;
  capPence: number | null;
  /** How far over the cap the pool would land. Zero when within it. */
  overCapPence: number;
  detail: string;
}

export interface EntryResult {
  outcome: EntryOutcome;
  entry: DrawEntry | null;
  detail: string;
}

export interface DrawExecutionResult {
  outcome: DrawOutcome;
  result: DrawResult | null;
  snapshot: DrawSnapshot | null;
  detail: string;
}

export interface RedrawResult {
  outcome: RedrawOutcome;
  result: DrawResult | null;
  detail: string;
}

/**
 * A lottery incidental to an event loses its exemption once deductions for
 * prizes pass this figure. Private society draws and split pots are not capped
 * the same way, so the cap is looked up per draw type rather than assumed.
 */
export const INCIDENTAL_PRIZE_CAP_PENCE = 50_000;

/** Nobody below this age may enter a lottery, however small. */
export const MINIMUM_ENTRY_AGE_YEARS = 16;

function formatPounds(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * FNV-1a over the entrant list. Not a cryptographic commitment — it is a
 * fingerprint that changes if the list changes, which is what lets an auditor
 * see that the set drawn from is the set that was frozen.
 */
function digestOf(values: string[]): string {
  let hash = 0x811c9dc5;
  for (const value of values) {
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= 0x1f;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Deterministic index from a seed. Same inputs, same winner, every time. */
function indexFrom(seed: string, digest: string, round: number, size: number): number {
  const value = digestOf([seed, digest, String(round)]);
  return parseInt(value, 16) % size;
}

function yearsBetween(from: Date, to: Date): number {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const monthDelta = to.getUTCMonth() - from.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && to.getUTCDate() < from.getUTCDate())) {
    years -= 1;
  }
  return years;
}

export class PrizeDrawComplianceService {
  private readonly entrants = new Map<string, Entrant>();
  private readonly draws = new Map<string, PrizeDraw>();
  private readonly prizes = new Map<string, DrawPrize>();
  private readonly entries = new Map<string, DrawEntry>();
  private readonly snapshots = new Map<string, DrawSnapshot>();
  private readonly results = new Map<string, DrawResult[]>();
  /** Attendance at the host event, which is what makes a draw incidental. */
  private readonly attendance = new Map<string, Set<string>>();

  private entrySequence = 0;

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  registerEntrant(entrant: Entrant): void {
    this.entrants.set(entrant.entrantId, { ...entrant });
  }

  recordAttendance(eventId: string, entrantId: string): void {
    const present = this.attendance.get(eventId) ?? new Set<string>();
    present.add(entrantId);
    this.attendance.set(eventId, present);
  }

  openDraw(input: Omit<PrizeDraw, "status">): PrizeDraw {
    if (input.salesCloseAt.getTime() <= input.salesOpenAt.getTime()) {
      throw new Error(`Draw ${input.drawId} closes sales at or before it opens them`);
    }
    if (input.drawAt.getTime() < input.salesCloseAt.getTime()) {
      throw new Error(`Draw ${input.drawId} is drawn before its sales close`);
    }
    if (input.claimWindowMs <= 0) {
      throw new Error(`Draw ${input.drawId} has a non-positive claim window`);
    }
    if (input.type === "INCIDENTAL" && !input.hostEventId) {
      throw new Error(`Incidental draw ${input.drawId} names no host event`);
    }

    const draw: PrizeDraw = { ...input, status: "OPEN" };
    this.draws.set(draw.drawId, draw);
    return { ...draw };
  }

  getDraw(drawId: string): PrizeDraw | null {
    const draw = this.draws.get(drawId);
    return draw ? { ...draw } : null;
  }

  getSnapshot(drawId: string): DrawSnapshot | null {
    const snapshot = this.snapshots.get(drawId);
    return snapshot ? { ...snapshot, entryIds: [...snapshot.entryIds] } : null;
  }

  getResults(drawId: string): DrawResult[] {
    return (this.results.get(drawId) ?? []).map((result) => ({ ...result }));
  }

  /** The result that currently stands: the latest round that nothing superseded. */
  currentResult(drawId: string): DrawResult | null {
    const rounds = this.results.get(drawId) ?? [];
    for (let i = rounds.length - 1; i >= 0; i -= 1) {
      if (rounds[i].supersededByRound === null) return { ...rounds[i] };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // The prize pool
  // ---------------------------------------------------------------------------

  /** The cap that applies to a draw type, or null where none does. */
  capFor(type: DrawType): number | null {
    return type === "INCIDENTAL" ? INCIDENTAL_PRIZE_CAP_PENCE : null;
  }

  /**
   * Total market value of the pool, counting donated prizes at full value and
   * including anything rolled over from a previous undrawn draw.
   */
  prizePoolValue(drawId: string): number {
    let total = 0;
    for (const prize of this.prizes.values()) {
      if (prize.drawId !== drawId) continue;
      total += prize.marketValuePence;
    }
    return total;
  }

  prizesFor(drawId: string): DrawPrize[] {
    return [...this.prizes.values()]
      .filter((prize) => prize.drawId === drawId)
      .map((prize) => ({ ...prize }));
  }

  addPrize(prize: DrawPrize): PrizeResult {
    const draw = this.draws.get(prize.drawId);
    if (!draw || draw.status !== "OPEN") {
      return {
        outcome: "REFUSED_DRAW_NOT_OPEN",
        prize: null,
        totalValuePence: draw ? this.prizePoolValue(prize.drawId) : 0,
        capPence: draw ? this.capFor(draw.type) : null,
        overCapPence: 0,
        detail: draw ? `Draw ${prize.drawId} is ${draw.status}` : `Draw ${prize.drawId} is unknown`,
      };
    }
    if (prize.marketValuePence < 0) {
      throw new Error(`Prize ${prize.prizeId} has a negative market value`);
    }

    const cap = this.capFor(draw.type);
    const total = this.prizePoolValue(prize.drawId) + prize.marketValuePence;

    if (cap !== null && total > cap) {
      return {
        outcome: "REFUSED_EXCEEDS_CAP",
        prize: null,
        totalValuePence: total,
        capPence: cap,
        overCapPence: total - cap,
        detail:
          `Adding ${prize.description} takes the prize pool to ${formatPounds(total)}, ` +
          `${formatPounds(total - cap)} over the ${formatPounds(cap)} incidental lottery cap` +
          (prize.donated ? " (donated prizes count at market value)" : ""),
      };
    }

    this.prizes.set(prize.prizeId, { ...prize });

    return {
      outcome: "ADDED",
      prize: { ...prize },
      totalValuePence: total,
      capPence: cap,
      overCapPence: 0,
      detail: `${prize.description} added at ${formatPounds(prize.marketValuePence)}`,
    };
  }

  /**
   * Carry an undrawn draw's prize forward. The rolled prize lands on top of the
   * receiving draw's own pool rather than instead of it, which is exactly how a
   * cap gets breached without anybody spending anything.
   */
  rollOverPrize(prizeId: string, toDrawId: string, newPrizeId: string): PrizeResult {
    const prize = this.prizes.get(prizeId);
    if (!prize) {
      throw new Error(`Prize ${prizeId} does not exist`);
    }
    return this.addPrize({
      prizeId: newPrizeId,
      drawId: toDrawId,
      description: `${prize.description} (rolled over)`,
      marketValuePence: prize.marketValuePence,
      donated: prize.donated,
      rolledOverFromDrawId: prize.drawId,
    });
  }

  /**
   * Correct a prize's market value. This never refuses, because a valuation is
   * a fact rather than a choice: the signed shirt turns out to be worth £700
   * whatever that does to the pool. The breach surfaces at the draw instead,
   * where the society can still withdraw a prize rather than run an unlicensed
   * lottery.
   */
  revaluePrize(prizeId: string, marketValuePence: number): number {
    const prize = this.prizes.get(prizeId);
    if (!prize) {
      throw new Error(`Prize ${prizeId} does not exist`);
    }
    if (marketValuePence < 0) {
      throw new Error(`Prize ${prizeId} cannot be revalued below zero`);
    }
    prize.marketValuePence = marketValuePence;
    return this.prizePoolValue(prize.drawId);
  }

  /** Take a prize back out of the pool, usually to bring it under the cap. */
  withdrawPrize(prizeId: string): boolean {
    const prize = this.prizes.get(prizeId);
    if (!prize) return false;
    const draw = this.draws.get(prize.drawId);
    if (!draw || draw.status !== "OPEN") return false;
    this.prizes.delete(prizeId);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Entry
  // ---------------------------------------------------------------------------

  /** Whether an entrant may enter at an instant, and why not when they may not. */
  enterDraw(drawId: string, entrantId: string, at: Date, banked = true): EntryResult {
    const draw = this.draws.get(drawId);
    if (!draw) {
      return { outcome: "REFUSED_UNKNOWN_DRAW", entry: null, detail: `Draw ${drawId} is unknown` };
    }
    if (draw.status !== "OPEN") {
      return {
        outcome: "REFUSED_DRAW_NOT_OPEN",
        entry: null,
        detail: `Draw ${drawId} is ${draw.status.toLowerCase()}`,
      };
    }

    const entrant = this.entrants.get(entrantId);
    if (!entrant) {
      return {
        outcome: "REFUSED_UNKNOWN_ENTRANT",
        entry: null,
        detail: `${entrantId} is not a registered entrant`,
      };
    }

    if (at.getTime() < draw.salesOpenAt.getTime()) {
      return {
        outcome: "REFUSED_SALES_NOT_STARTED",
        entry: null,
        detail: `Sales for ${draw.label} open at ${draw.salesOpenAt.toISOString()}`,
      };
    }
    if (at.getTime() >= draw.salesCloseAt.getTime()) {
      return {
        outcome: "REFUSED_SALES_CLOSED",
        entry: null,
        detail: `Sales for ${draw.label} closed at ${draw.salesCloseAt.toISOString()}`,
      };
    }

    if (entrantId === draw.operatorId) {
      return {
        outcome: "REFUSED_OPERATOR",
        entry: null,
        detail: `${entrant.name} is operating the draw and cannot enter it`,
      };
    }

    if (yearsBetween(entrant.bornOn, at) < MINIMUM_ENTRY_AGE_YEARS) {
      return {
        outcome: "REFUSED_UNDER_AGE",
        entry: null,
        detail: `${entrant.name} is under ${MINIMUM_ENTRY_AGE_YEARS} and cannot enter a lottery`,
      };
    }

    // An incidental lottery is incidental to something. Selling to people who
    // are not at the event is the step that ends the exemption.
    if (draw.type === "INCIDENTAL") {
      const present = this.attendance.get(draw.hostEventId as string);
      if (!present || !present.has(entrantId)) {
        return {
          outcome: "REFUSED_NOT_AT_EVENT",
          entry: null,
          detail:
            `${entrant.name} is not recorded at the host event; selling to people who are not ` +
            `there ends the incidental lottery exemption`,
        };
      }
    }

    this.entrySequence += 1;
    const entry: DrawEntry = {
      entryId: `entry-${String(this.entrySequence).padStart(4, "0")}`,
      drawId,
      entrantId,
      pricePaidPence: banked ? draw.ticketPricePence : 0,
      banked,
      purchasedAt: at,
    };
    this.entries.set(entry.entryId, entry);

    return { outcome: "ACCEPTED", entry: { ...entry }, detail: `${entrant.name} entered` };
  }

  entriesFor(drawId: string): DrawEntry[] {
    return [...this.entries.values()]
      .filter((entry) => entry.drawId === drawId)
      .map((entry) => ({ ...entry }));
  }

  /** Cash that actually reached the account. Tickets issued are not revenue. */
  bankedRevenue(drawId: string): number {
    let total = 0;
    for (const entry of this.entries.values()) {
      if (entry.drawId !== drawId) continue;
      if (!entry.banked) continue;
      total += entry.pricePaidPence;
    }
    return total;
  }

  // ---------------------------------------------------------------------------
  // The draw
  // ---------------------------------------------------------------------------

  /**
   * Freeze the entrant set and select a winner from it.
   *
   * The snapshot is taken first and everything after it reads only from the
   * snapshot, so an entry created a second later cannot win and cannot be
   * folded in by running the draw again.
   */
  runDraw(drawId: string, seed: string, at: Date): DrawExecutionResult {
    const draw = this.draws.get(drawId);
    if (!draw) {
      return {
        outcome: "REFUSED_UNKNOWN_DRAW",
        result: null,
        snapshot: null,
        detail: `Draw ${drawId} is unknown`,
      };
    }
    if (draw.status !== "OPEN") {
      return {
        outcome: "REFUSED_ALREADY_DRAWN",
        result: null,
        snapshot: this.getSnapshot(drawId),
        detail: `Draw ${drawId} has already been drawn`,
      };
    }
    if (at.getTime() < draw.drawAt.getTime()) {
      return {
        outcome: "REFUSED_TOO_EARLY",
        result: null,
        snapshot: null,
        detail: `${draw.label} is not drawn until ${draw.drawAt.toISOString()}`,
      };
    }

    const cap = this.capFor(draw.type);
    const poolValue = this.prizePoolValue(drawId);
    if (cap !== null && poolValue > cap) {
      return {
        outcome: "REFUSED_EXCEEDS_CAP",
        result: null,
        snapshot: null,
        detail:
          `The prize pool is ${formatPounds(poolValue)}, ${formatPounds(poolValue - cap)} over ` +
          `the ${formatPounds(cap)} incidental lottery cap`,
      };
    }

    const entryIds = this.entriesFor(drawId)
      .map((entry) => entry.entryId)
      .sort();

    if (entryIds.length === 0) {
      return {
        outcome: "REFUSED_NO_ENTRIES",
        result: null,
        snapshot: null,
        detail: `${draw.label} has no entries to draw from`,
      };
    }

    const snapshot: DrawSnapshot = {
      drawId,
      takenAt: at,
      entryIds,
      digest: digestOf(entryIds),
    };
    this.snapshots.set(drawId, snapshot);

    const winningEntryId = entryIds[indexFrom(seed, snapshot.digest, 1, entryIds.length)];
    const winner = this.entries.get(winningEntryId) as DrawEntry;

    const shares = this.splitFor(draw);

    const result: DrawResult = {
      drawId,
      round: 1,
      winningEntryId,
      winnerEntrantId: winner.entrantId,
      seed,
      snapshotDigest: snapshot.digest,
      drawnAt: at,
      claimDeadline: new Date(at.getTime() + draw.claimWindowMs),
      claimedAt: null,
      supersededByRound: null,
      winnerSharePence: shares.winner,
      societySharePence: shares.society,
    };

    this.results.set(drawId, [result]);
    draw.status = "DRAWN";

    return {
      outcome: "DRAWN",
      result: { ...result },
      snapshot: { ...snapshot, entryIds: [...entryIds] },
      detail: `${draw.label} drawn from ${entryIds.length} entries (digest ${snapshot.digest})`,
    };
  }

  /**
   * A split pot divides what was banked, not what was issued. Odd pennies go to
   * the society rather than the winner, so the two shares always reconstruct
   * the total exactly.
   */
  private splitFor(draw: PrizeDraw): { winner: number | null; society: number | null } {
    if (draw.type !== "SPLIT_POT") return { winner: null, society: null };
    const revenue = this.bankedRevenue(draw.drawId);
    const winner = Math.floor(revenue / 2);
    return { winner, society: revenue - winner };
  }

  claimPrize(drawId: string, entrantId: string, at: Date): boolean {
    const current = this.rawCurrentResult(drawId);
    if (!current) return false;
    if (current.claimedAt) return false;
    if (current.winnerEntrantId !== entrantId) return false;
    if (at.getTime() >= current.claimDeadline.getTime()) return false;
    current.claimedAt = at;
    return true;
  }

  /**
   * Draw again from the same frozen set with every previous winner excluded.
   *
   * Only possible once the claim window has closed. Recorded as a new round
   * rather than overwriting the first result, because the first result is the
   * evidence that the original winner was given their chance.
   */
  redraw(drawId: string, seed: string, at: Date): RedrawResult {
    const rounds = this.results.get(drawId);
    const current = this.rawCurrentResult(drawId);
    if (!rounds || !current) {
      return {
        outcome: "REFUSED_NOT_DRAWN",
        result: null,
        detail: `Draw ${drawId} has not been drawn`,
      };
    }
    if (current.claimedAt) {
      return {
        outcome: "REFUSED_ALREADY_CLAIMED",
        result: null,
        detail: `The prize was claimed at ${current.claimedAt.toISOString()}`,
      };
    }
    if (at.getTime() < current.claimDeadline.getTime()) {
      return {
        outcome: "REFUSED_CLAIM_WINDOW_OPEN",
        result: null,
        detail: `The winner has until ${current.claimDeadline.toISOString()} to come forward`,
      };
    }

    const snapshot = this.snapshots.get(drawId) as DrawSnapshot;
    const excluded = new Set(rounds.map((round) => round.winningEntryId));
    const pool = snapshot.entryIds.filter((entryId) => !excluded.has(entryId));

    if (pool.length === 0) {
      return {
        outcome: "REFUSED_NO_REMAINING_ENTRIES",
        result: null,
        detail: `Every entry in the frozen set has already been drawn`,
      };
    }

    const round = current.round + 1;
    const winningEntryId = pool[indexFrom(seed, snapshot.digest, round, pool.length)];
    const winner = this.entries.get(winningEntryId) as DrawEntry;
    const draw = this.draws.get(drawId) as PrizeDraw;

    current.supersededByRound = round;

    const result: DrawResult = {
      drawId,
      round,
      winningEntryId,
      winnerEntrantId: winner.entrantId,
      seed,
      // The same digest: a redraw is drawn from the set that was frozen, not
      // from whoever has entered since.
      snapshotDigest: snapshot.digest,
      drawnAt: at,
      claimDeadline: new Date(at.getTime() + draw.claimWindowMs),
      claimedAt: null,
      supersededByRound: null,
      winnerSharePence: current.winnerSharePence,
      societySharePence: current.societySharePence,
    };

    rounds.push(result);

    return {
      outcome: "REDRAWN",
      result: { ...result },
      detail: `Round ${round} drawn from the original frozen set of ${snapshot.entryIds.length}`,
    };
  }

  /**
   * Re-run a recorded selection from the stored snapshot and seed. An auditor
   * with the published digest and seed reaches the same entry, or the record is
   * not what it says it is.
   */
  reproduce(drawId: string, round: number): string | null {
    const snapshot = this.snapshots.get(drawId);
    const rounds = this.results.get(drawId);
    if (!snapshot || !rounds) return null;

    const result = rounds.find((candidate) => candidate.round === round);
    if (!result) return null;

    const excluded = new Set(
      rounds.filter((candidate) => candidate.round < round).map((r) => r.winningEntryId),
    );
    const pool = snapshot.entryIds.filter((entryId) => !excluded.has(entryId));
    if (pool.length === 0) return null;

    return pool[indexFrom(result.seed, snapshot.digest, round, pool.length)];
  }

  closeDraw(drawId: string): boolean {
    const draw = this.draws.get(drawId);
    if (!draw || draw.status === "CLOSED") return false;
    draw.status = "CLOSED";
    return true;
  }

  // ---------------------------------------------------------------------------

  private rawCurrentResult(drawId: string): DrawResult | null {
    const rounds = this.results.get(drawId) ?? [];
    for (let i = rounds.length - 1; i >= 0; i -= 1) {
      if (rounds[i].supersededByRound === null) return rounds[i];
    }
    return null;
  }
}
