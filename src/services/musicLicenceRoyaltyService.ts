/**
 * Module: Live Music Licensing Royalty Accrual
 * File: src/services/musicLicenceRoyaltyService.ts
 * Scope: Accrues per event and per society from data the platform already has,
 *        and makes the setlist return a precondition for finalising rather
 *        than paperwork that follows it (#4704).
 *
 * Somebody in the union office reconstructs a year of events from memory each
 * summer, and the numbers they produce are the numbers the institution is
 * invoiced on. The reconstruction is wrong in three consistent ways.
 *
 * There are two royalties on one performance, owed to different people. The
 * composition and the recording are separate rights under separate tariffs, so
 * an office treating "the music licence" as one number is always about half
 * right. It also cuts the other way: a live band uses no recording at all, so a
 * live event accrues on the composition and nothing on the recording, while a
 * DJ set accrues on both.
 *
 * A tariff is not a rate. It is the greater of a per-head charge and a
 * percentage of gross receipts, subject to a minimum fee, and which of the
 * three binds changes with the event.
 *
 * Free admission is not free. Charging nothing puts the event in the
 * no-admission band, which is lower. It does not put it outside the tariff.
 *
 * Money is integer cents throughout. Rounding happens once, at the point a
 * percentage becomes a figure, and half goes away from zero.
 */

export type RightKind = "COMPOSITION" | "RECORDING";

export type UsageKind = "RECORDED" | "DJ_SET" | "LIVE";

export type WorkStatus = "IN_COPYRIGHT" | "PUBLIC_DOMAIN" | "UNPUBLISHED_ORIGINAL";

export type AccrualStatus = "COVERED_BY_BLANKET" | "PENDING_RETURN" | "ACCRUED" | "ADJUSTED";

export type BindingTerm = "MINIMUM_FEE" | "PER_HEAD" | "PERCENTAGE_OF_GROSS";

export type ReturnOutcome =
  | "SUBMITTED"
  | "REFUSED_NOT_REQUIRED"
  | "REFUSED_NO_SETLIST"
  | "REFUSED_INCOMPLETE_ENTRY"
  | "REFUSED_ALREADY_SUBMITTED";

export type CorrectionOutcome = "APPLIED_BEFORE_RETURN" | "ADJUSTED" | "REFUSED_NO_CHANGE";

export interface Society {
  societyId: string;
  name: string;
  /** Which of the two rights this society administers. */
  right: RightKind;
}

export interface TariffBand {
  /** Inclusive upper bound of venue capacity. The last band should be Infinity. */
  capacityUpTo: number;
  /** Applied where admission was charged. */
  perHeadAdmissionCents: number;
  /** Applied where it was not. Lower, never nought. */
  perHeadNoAdmissionCents: number;
  /** Share of gross receipts, in basis points. */
  grossReceiptsBasisPoints: number;
  minimumFeeCents: number;
}

export interface Tariff {
  societyId: string;
  bands: TariffBand[];
}

export interface EventMusicUsage {
  eventId: string;
  clubId: string;
  usageKind: UsageKind;
  venueCapacity: number;
  attendance: number;
  admissionCharged: boolean;
  grossReceiptsCents: number;
  occurredAt: Date;
}

export interface SetlistEntry {
  entryId: string;
  workId: string;
  title: string;
  /** May be empty only for a public-domain work with no known writer. */
  writer: string;
  durationSeconds: number;
  status: WorkStatus;
}

export interface TariffEvaluation {
  societyId: string;
  right: RightKind;
  bandCapacityUpTo: number;
  /** The rate that applied, after the admission/no-admission choice. */
  perHeadCents: number;
  perHeadTotalCents: number;
  percentageTotalCents: number;
  minimumFeeCents: number;
  /** Which of the three terms bound. */
  bindingTerm: BindingTerm;
  /** Fee before the in-copyright share is applied. */
  grossFeeCents: number;
  /** Performances in copyright over performances returned. 1 where unknown. */
  inCopyrightShareNumerator: number;
  inCopyrightShareDenominator: number;
  feeCents: number;
}

export interface Adjustment {
  adjustedAt: Date;
  reason: string;
  previousTotalCents: number;
  revisedTotalCents: number;
  deltaCents: number;
  /** The revised position per society. They reconcile separately, so a single
   *  delta would have to be apportioned back out, and apportioning a rounded
   *  total is how the two statements stop agreeing. */
  perSociety: TariffEvaluation[];
}

export interface EventAccrual {
  eventId: string;
  clubId: string;
  assessedAt: Date;
  usageKind: UsageKind;
  status: AccrualStatus;
  perSociety: TariffEvaluation[];
  /** The figure the return was raised on, or the provisional one before it. */
  totalCents: number;
  adjustments: Adjustment[];
  /** Total plus every adjustment since. What the club actually owes. */
  netPayableCents: number;
  performanceCount: number;
  distinctWorkCount: number;
  returnSubmittedAt: Date | null;
}

interface FrozenReturn {
  submittedAt: Date;
  perSociety: TariffEvaluation[];
  totalCents: number;
  attendance: number;
  grossReceiptsCents: number;
}

interface UsageRecord {
  usage: EventMusicUsage;
  setlist: SetlistEntry[];
  frozen: FrozenReturn | null;
  adjustments: Adjustment[];
}

/** Half away from zero, applied once where a percentage becomes a figure. */
function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export class MusicLicenceRoyaltyService {
  private readonly societies: Map<string, Society>;
  private readonly tariffs: Map<string, Tariff>;
  private readonly usages: Map<string, UsageRecord>;

  constructor() {
    this.societies = new Map();
    this.tariffs = new Map();
    this.usages = new Map();
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  public registerSociety(society: Society): void {
    if (this.societies.has(society.societyId)) {
      throw new Error(`Society ${society.societyId} is already registered.`);
    }
    this.societies.set(society.societyId, { ...society });
  }

  public registerTariff(tariff: Tariff): void {
    if (!this.societies.has(tariff.societyId)) {
      throw new Error(`Unknown society ${tariff.societyId}.`);
    }
    if (tariff.bands.length === 0) {
      throw new Error(`Tariff for ${tariff.societyId} has no bands.`);
    }
    for (const band of tariff.bands) {
      if (band.perHeadNoAdmissionCents <= 0) {
        // Charging nothing puts an event in the lower band, not outside the
        // tariff. A no-admission rate of nought would encode the belief this
        // module exists to correct.
        throw new Error(
          `Tariff for ${tariff.societyId} rates a free event at nothing, which is not how the band works.`,
        );
      }
      if (band.perHeadNoAdmissionCents > band.perHeadAdmissionCents) {
        throw new Error(
          `Tariff for ${tariff.societyId} charges more for a free event than a ticketed one.`,
        );
      }
    }

    const sorted = [...tariff.bands].sort((a, b) => a.capacityUpTo - b.capacityUpTo);
    this.tariffs.set(tariff.societyId, { societyId: tariff.societyId, bands: sorted });
  }

  public recordUsage(usage: EventMusicUsage): void {
    if (this.usages.has(usage.eventId)) {
      throw new Error(`Usage for event ${usage.eventId} is already recorded.`);
    }
    if (usage.attendance < 0 || usage.grossReceiptsCents < 0 || usage.venueCapacity <= 0) {
      throw new Error(`Usage for event ${usage.eventId} carries impossible figures.`);
    }
    if (!usage.admissionCharged && usage.grossReceiptsCents > 0) {
      throw new Error(`Event ${usage.eventId} reports gross receipts but no admission charge.`);
    }
    this.usages.set(usage.eventId, {
      usage: { ...usage },
      setlist: [],
      frozen: null,
      adjustments: [],
    });
  }

  // ---------------------------------------------------------------------------
  // Setlists
  // ---------------------------------------------------------------------------

  public addSetlistEntry(eventId: string, entry: SetlistEntry): void {
    const record = this.requireUsage(eventId);
    if (record.frozen) {
      throw new Error(`The return for ${eventId} has been submitted and cannot take new entries.`);
    }
    record.setlist.push({ ...entry });
  }

  public setlist(eventId: string): readonly SetlistEntry[] {
    return this.requireUsage(eventId).setlist;
  }

  /**
   * Whether this usage needs a work-level return.
   *
   * Recorded background use is covered by the blanket. Anything specially
   * featured — a DJ set or a live performance — is not.
   */
  public returnRequired(eventId: string): boolean {
    return this.requireUsage(eventId).usage.usageKind !== "RECORDED";
  }

  /**
   * Which societies accrue on this usage.
   *
   * A live band plays no recording, so a live event accrues on the composition
   * and nothing on the recording. A DJ set plays recordings of compositions and
   * accrues on both. This asymmetry is the one an office reading "the music
   * licence" as a single number will never reproduce.
   */
  public accruingRights(usageKind: UsageKind): RightKind[] {
    switch (usageKind) {
      case "RECORDED":
        return [];
      case "LIVE":
        return ["COMPOSITION"];
      case "DJ_SET":
        return ["COMPOSITION", "RECORDING"];
    }
  }

  // ---------------------------------------------------------------------------
  // Tariff evaluation
  // ---------------------------------------------------------------------------

  public bandFor(societyId: string, venueCapacity: number): TariffBand {
    const tariff = this.tariffs.get(societyId);
    if (!tariff) throw new Error(`No tariff registered for ${societyId}.`);

    const band = tariff.bands.find((candidate) => venueCapacity <= candidate.capacityUpTo);
    if (!band) {
      throw new Error(
        `Tariff for ${societyId} has no band covering a capacity of ${venueCapacity}.`,
      );
    }
    return band;
  }

  /**
   * The greater of a per-head charge and a share of gross, with a floor.
   *
   * All three terms are returned alongside the answer. Which one bound is the
   * thing a treasurer disputing an invoice actually wants to know, and it is
   * not recoverable from the total.
   */
  public evaluateTariff(
    societyId: string,
    usage: EventMusicUsage,
    inCopyrightNumerator: number,
    inCopyrightDenominator: number,
  ): TariffEvaluation {
    const society = this.societies.get(societyId);
    if (!society) throw new Error(`Unknown society ${societyId}.`);

    const band = this.bandFor(societyId, usage.venueCapacity);
    const perHeadCents = usage.admissionCharged
      ? band.perHeadAdmissionCents
      : band.perHeadNoAdmissionCents;

    const perHeadTotalCents = perHeadCents * usage.attendance;
    const percentageTotalCents = roundCents(
      (usage.grossReceiptsCents * band.grossReceiptsBasisPoints) / 10_000,
    );

    const greaterOfTwo = Math.max(perHeadTotalCents, percentageTotalCents);
    const grossFeeCents = Math.max(band.minimumFeeCents, greaterOfTwo);

    let bindingTerm: BindingTerm;
    if (grossFeeCents === band.minimumFeeCents && band.minimumFeeCents > greaterOfTwo) {
      bindingTerm = "MINIMUM_FEE";
    } else if (perHeadTotalCents >= percentageTotalCents) {
      bindingTerm = "PER_HEAD";
    } else {
      bindingTerm = "PERCENTAGE_OF_GROSS";
    }

    // A society administering compositions distributes by setlist, so a set
    // half of which is out of copyright generates half the composition
    // royalty. The recording right does not care what the composition's status
    // is: a recording of a public-domain work is still somebody's recording.
    const scaled =
      society.right === "COMPOSITION"
        ? roundCents((grossFeeCents * inCopyrightNumerator) / inCopyrightDenominator)
        : grossFeeCents;

    return {
      societyId,
      right: society.right,
      bandCapacityUpTo: band.capacityUpTo,
      perHeadCents,
      perHeadTotalCents,
      percentageTotalCents,
      minimumFeeCents: band.minimumFeeCents,
      bindingTerm,
      grossFeeCents,
      inCopyrightShareNumerator: society.right === "COMPOSITION" ? inCopyrightNumerator : 1,
      inCopyrightShareDenominator: society.right === "COMPOSITION" ? inCopyrightDenominator : 1,
      feeCents: scaled,
    };
  }

  // ---------------------------------------------------------------------------
  // Accrual
  // ---------------------------------------------------------------------------

  /**
   * What the event owes, per society.
   *
   * Before the return is in, the figures are provisional and the status says
   * so. It must never read as nought: an unreported event and a genuinely free
   * event look identical in a total and are not the same thing.
   */
  public assess(eventId: string, assessedAt: Date): EventAccrual {
    const record = this.requireUsage(eventId);
    const { usage } = record;

    const performanceCount = record.setlist.length;
    const distinctWorkCount = new Set(record.setlist.map((entry) => entry.workId)).size;

    if (usage.usageKind === "RECORDED") {
      return {
        eventId,
        clubId: usage.clubId,
        assessedAt,
        usageKind: usage.usageKind,
        status: "COVERED_BY_BLANKET",
        perSociety: [],
        totalCents: 0,
        adjustments: [],
        netPayableCents: 0,
        performanceCount,
        distinctWorkCount,
        returnSubmittedAt: null,
      };
    }

    if (record.frozen) {
      const deltas = record.adjustments.reduce((sum, entry) => sum + entry.deltaCents, 0);
      return {
        eventId,
        clubId: usage.clubId,
        assessedAt,
        usageKind: usage.usageKind,
        status: record.adjustments.length > 0 ? "ADJUSTED" : "ACCRUED",
        // The submitted return is the document the invoice was raised against,
        // so it is reported as submitted and corrections arrive beside it.
        perSociety: record.frozen.perSociety.map((entry) => ({ ...entry })),
        totalCents: record.frozen.totalCents,
        adjustments: record.adjustments.map((entry) => ({ ...entry })),
        netPayableCents: record.frozen.totalCents + deltas,
        performanceCount,
        distinctWorkCount,
        returnSubmittedAt: record.frozen.submittedAt,
      };
    }

    const perSociety = this.evaluateAll(record);
    const totalCents = perSociety.reduce((sum, entry) => sum + entry.feeCents, 0);

    return {
      eventId,
      clubId: usage.clubId,
      assessedAt,
      usageKind: usage.usageKind,
      status: "PENDING_RETURN",
      perSociety,
      totalCents,
      adjustments: [],
      netPayableCents: totalCents,
      performanceCount,
      distinctWorkCount,
      returnSubmittedAt: null,
    };
  }

  /**
   * Submits the work-level return and freezes the accrual.
   *
   * An entry with no title or no duration is not a return, and an in-copyright
   * work with no writer named is a royalty the society cannot distribute. A
   * public-domain traditional may name no writer, because often there is none.
   */
  public submitReturn(eventId: string, submittedAt: Date): { outcome: ReturnOutcome } {
    const record = this.requireUsage(eventId);

    if (record.usage.usageKind === "RECORDED") return { outcome: "REFUSED_NOT_REQUIRED" };
    if (record.frozen) return { outcome: "REFUSED_ALREADY_SUBMITTED" };
    if (record.setlist.length === 0) return { outcome: "REFUSED_NO_SETLIST" };

    for (const entry of record.setlist) {
      if (entry.title.trim() === "" || entry.durationSeconds <= 0) {
        return { outcome: "REFUSED_INCOMPLETE_ENTRY" };
      }
      if (entry.status !== "PUBLIC_DOMAIN" && entry.writer.trim() === "") {
        return { outcome: "REFUSED_INCOMPLETE_ENTRY" };
      }
    }

    const perSociety = this.evaluateAll(record);
    record.frozen = {
      submittedAt,
      perSociety,
      totalCents: perSociety.reduce((sum, entry) => sum + entry.feeCents, 0),
      attendance: record.usage.attendance,
      grossReceiptsCents: record.usage.grossReceiptsCents,
    };
    return { outcome: "SUBMITTED" };
  }

  /**
   * Corrects the attendance or the gross after the fact.
   *
   * Before the return goes in this is simply the truth arriving late. After it,
   * the submitted return stands and the difference becomes an adjustment,
   * because that return is the document the invoice was raised against.
   */
  public correctFigures(
    eventId: string,
    figures: { attendance?: number; grossReceiptsCents?: number },
    at: Date,
    reason: string,
  ): { outcome: CorrectionOutcome; adjustment: Adjustment | null } {
    const record = this.requireUsage(eventId);
    const attendance = figures.attendance ?? record.usage.attendance;
    const grossReceiptsCents = figures.grossReceiptsCents ?? record.usage.grossReceiptsCents;

    if (
      attendance === record.usage.attendance &&
      grossReceiptsCents === record.usage.grossReceiptsCents
    ) {
      return { outcome: "REFUSED_NO_CHANGE", adjustment: null };
    }
    if (attendance < 0 || grossReceiptsCents < 0) {
      throw new Error(`Corrected figures for ${eventId} are impossible.`);
    }

    const previousTotalCents = record.frozen
      ? record.frozen.totalCents + record.adjustments.reduce((sum, e) => sum + e.deltaCents, 0)
      : 0;

    record.usage = { ...record.usage, attendance, grossReceiptsCents };

    if (!record.frozen) {
      return { outcome: "APPLIED_BEFORE_RETURN", adjustment: null };
    }

    const perSociety = this.evaluateAll(record);
    const revisedTotalCents = perSociety.reduce((sum, entry) => sum + entry.feeCents, 0);
    const adjustment: Adjustment = {
      adjustedAt: at,
      reason,
      previousTotalCents,
      revisedTotalCents,
      deltaCents: revisedTotalCents - previousTotalCents,
      perSociety,
    };
    record.adjustments.push(adjustment);

    return { outcome: "ADJUSTED", adjustment: { ...adjustment } };
  }

  // ---------------------------------------------------------------------------
  // Reporting
  // ---------------------------------------------------------------------------

  /**
   * Events that owe a return, worst first.
   *
   * These are the ones that will otherwise be reconstructed from memory in the
   * summer, so they are listed by what is riding on them.
   */
  public unreturnedEvents(asOf: Date): EventAccrual[] {
    return [...this.usages.keys()]
      .map((eventId) => this.assess(eventId, asOf))
      .filter((accrual) => accrual.status === "PENDING_RETURN")
      .sort((a, b) => b.totalCents - a.totalCents || a.eventId.localeCompare(b.eventId));
  }

  /**
   * What one society is owed over a period.
   *
   * Per society rather than combined, because they invoice separately and
   * reconcile separately, and a combined figure cannot be checked against
   * either statement.
   */
  public societyLiability(
    societyId: string,
    from: Date,
    to: Date,
    asOf: Date,
  ): {
    societyId: string;
    accruedCents: number;
    pendingReturnCents: number;
    eventCount: number;
  } {
    if (!this.societies.has(societyId)) throw new Error(`Unknown society ${societyId}.`);

    let accruedCents = 0;
    let pendingReturnCents = 0;
    let eventCount = 0;

    for (const record of this.usages.values()) {
      const occurred = record.usage.occurredAt.getTime();
      if (occurred < from.getTime() || occurred > to.getTime()) continue;

      const accrual = this.assess(record.usage.eventId, asOf);

      // The latest adjustment supersedes the return for what is currently
      // owed, and it carries its own per-society lines so nothing has to be
      // apportioned back out of a rounded total.
      const current =
        accrual.adjustments.length > 0
          ? accrual.adjustments[accrual.adjustments.length - 1].perSociety
          : accrual.perSociety;

      const line = current.find((entry) => entry.societyId === societyId);
      if (!line) continue;

      eventCount += 1;
      if (accrual.status === "PENDING_RETURN") {
        pendingReturnCents += line.feeCents;
      } else {
        accruedCents += line.feeCents;
      }
    }

    return { societyId, accruedCents, pendingReturnCents, eventCount };
  }

  public clubLiability(clubId: string, asOf: Date): EventAccrual[] {
    return [...this.usages.values()]
      .filter((record) => record.usage.clubId === clubId)
      .map((record) => this.assess(record.usage.eventId, asOf))
      .sort((a, b) => b.netPayableCents - a.netPayableCents || a.eventId.localeCompare(b.eventId));
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * The share of returned performances that are in copyright.
   *
   * A member's own unpublished song counts as in copyright. The club owes the
   * royalty even though the writer is standing in the room — it flows back to
   * them through the society, and treating it as free is how the writer ends up
   * paying to be performed.
   *
   * With no setlist yet the share is one. The figure is provisional anyway, and
   * assuming a set is out of copyright until proven otherwise would understate
   * every unreturned event.
   */
  private inCopyrightShare(setlist: SetlistEntry[]): { numerator: number; denominator: number } {
    if (setlist.length === 0) return { numerator: 1, denominator: 1 };

    const numerator = setlist.filter((entry) => entry.status !== "PUBLIC_DOMAIN").length;
    return { numerator, denominator: setlist.length };
  }

  private evaluateAll(record: UsageRecord): TariffEvaluation[] {
    const rights = this.accruingRights(record.usage.usageKind);
    const share = this.inCopyrightShare(record.setlist);

    return [...this.societies.values()]
      .filter((society) => rights.includes(society.right))
      .filter((society) => this.tariffs.has(society.societyId))
      .map((society) =>
        this.evaluateTariff(society.societyId, record.usage, share.numerator, share.denominator),
      )
      .sort((a, b) => a.societyId.localeCompare(b.societyId));
  }

  private requireUsage(eventId: string): UsageRecord {
    const record = this.usages.get(eventId);
    if (!record) throw new Error(`No music usage recorded for event ${eventId}.`);
    return record;
  }
}
