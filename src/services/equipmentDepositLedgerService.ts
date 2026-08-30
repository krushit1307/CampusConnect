/**
 * Module: Equipment Security Deposit Hold & Damage Settlement Ledger
 * File: src/services/equipmentDepositLedgerService.ts
 * Scope: Treats a club equipment deposit as a held balance with an explicit
 *        lifecycle — held on check-out, itemised against assessed damage on
 *        return, released with a statement both sides can read (#4389).
 *
 * Money is integer minor units throughout. There is no floating point anywhere
 * on the currency path, because a deposit that fails to balance to the last
 * paisa is a deposit two students will argue about.
 *
 * The invariant that governs settlement is:
 *
 *     releasedMinor + forfeitedMinor === heldMinor
 *     forfeitedMinor === min(sum(deductions), heldMinor)
 *
 * Damage beyond the deposit does not produce a negative release. It is reported
 * separately as an unrecovered shortfall, which is a real number the club needs
 * for its own budget and which quietly disappears if you let the arithmetic go
 * negative instead.
 */

export type DepositStatus = "HELD" | "UNDER_ASSESSMENT" | "SETTLED" | "FORFEITED";

/**
 * Transitions the lifecycle actually permits.
 *
 * HELD lists itself because a clean return leaves the hold HELD while it waits
 * for release. The terminal states list nothing at all, including themselves,
 * so settling or forfeiting twice is rejected rather than silently rewriting a
 * statement the borrower has already been given.
 */
const ALLOWED_TRANSITIONS: Record<DepositStatus, readonly DepositStatus[]> = {
  HELD: ["HELD", "UNDER_ASSESSMENT", "SETTLED", "FORFEITED"],
  UNDER_ASSESSMENT: ["UNDER_ASSESSMENT", "SETTLED", "FORFEITED"],
  SETTLED: [],
  FORFEITED: [],
};

/** A hold sitting past this many days after a clean return is overdue. */
export const RELEASE_WINDOW_DAYS = 14;

export interface DepositHold {
  holdId: string;
  assetTag: string;
  clubId: string;
  borrowerUserId: string;
  /** Amount held, in integer minor units. */
  heldMinor: number;
  currency: string;
  status: DepositStatus;
  heldAt: Date;
  dueBackAt: Date;
  returnedAt: Date | null;
  /** Set on return when the kit came back with no assessed damage. */
  returnedUndamaged: boolean;
}

export interface Deduction {
  reason: string;
  amountMinor: number;
  assessedBy: string;
  assessedAt: Date;
}

export interface Settlement {
  holdId: string;
  heldMinor: number;
  /** Sum of the itemised deductions, before the deposit cap is applied. */
  assessedDamageMinor: number;
  /** What the club actually keeps. Never exceeds the held amount. */
  forfeitedMinor: number;
  /** What goes back to the borrower. Never negative. */
  releasedMinor: number;
  /** Damage the deposit could not cover. Reportable, not swallowed. */
  unrecoveredShortfallMinor: number;
  deductions: Deduction[];
  settledAt: Date;
  settledBy: string;
  currency: string;
}

export interface OverdueRelease {
  holdId: string;
  assetTag: string;
  borrowerUserId: string;
  heldMinor: number;
  currency: string;
  returnedAt: Date;
  daysOverdue: number;
}

export interface OpenHoldRequest {
  holdId: string;
  assetTag: string;
  clubId: string;
  borrowerUserId: string;
  heldMinor: number;
  currency: string;
  heldAt: Date;
  dueBackAt: Date;
}

export class EquipmentDepositLedgerService {
  private readonly holds: Map<string, DepositHold>;
  private readonly deductions: Map<string, Deduction[]>;
  private readonly settlements: Map<string, Settlement>;

  constructor() {
    this.holds = new Map();
    this.deductions = new Map();
    this.settlements = new Map();
  }

  // ---------------------------------------------------------------------------
  // Holds
  // ---------------------------------------------------------------------------

  public openHold(request: OpenHoldRequest): DepositHold {
    if (!request.holdId || !request.holdId.trim()) {
      throw new Error("A deposit hold requires an id.");
    }
    if (this.holds.has(request.holdId)) {
      throw new Error(`A deposit hold '${request.holdId}' already exists.`);
    }
    if (!request.borrowerUserId) {
      throw new Error("A deposit hold requires a borrower.");
    }
    this.assertMinorUnits(request.heldMinor, "Held deposit");
    if (request.heldMinor === 0) {
      throw new Error("A deposit hold of zero is not a hold; do not open one.");
    }
    if (!/^[A-Z]{3}$/.test(request.currency)) {
      throw new Error("Currency must be a three-letter ISO code.");
    }
    if (request.dueBackAt.getTime() <= request.heldAt.getTime()) {
      throw new Error("The return date must fall after the check-out date.");
    }

    const hold: DepositHold = {
      holdId: request.holdId,
      assetTag: request.assetTag,
      clubId: request.clubId,
      borrowerUserId: request.borrowerUserId,
      heldMinor: request.heldMinor,
      currency: request.currency,
      status: "HELD",
      heldAt: request.heldAt,
      dueBackAt: request.dueBackAt,
      returnedAt: null,
      returnedUndamaged: false,
    };

    this.holds.set(hold.holdId, hold);
    this.deductions.set(hold.holdId, []);

    return { ...hold };
  }

  public getHold(holdId: string): DepositHold | undefined {
    const hold = this.holds.get(holdId);
    return hold ? { ...hold } : undefined;
  }

  public listHolds(clubId: string): DepositHold[] {
    return Array.from(this.holds.values())
      .filter((hold) => hold.clubId === clubId)
      .map((hold) => ({ ...hold }));
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Records that the kit came back.
   *
   * A clean return moves straight to the release obligation; anything the
   * checker wants to query moves to UNDER_ASSESSMENT, which is the state that
   * makes "we are still looking at it" visible rather than leaving a hold
   * apparently untouched.
   */
  public recordReturn(holdId: string, returnedAt: Date, undamaged: boolean): DepositHold {
    const hold = this.requireHold(holdId);
    this.assertTransition(hold.status, undamaged ? "HELD" : "UNDER_ASSESSMENT", holdId);

    const nextStatus: DepositStatus = undamaged ? "HELD" : "UNDER_ASSESSMENT";
    const updated: DepositHold = {
      ...hold,
      status: nextStatus,
      returnedAt,
      returnedUndamaged: undamaged,
    };

    this.holds.set(holdId, updated);
    return { ...updated };
  }

  /**
   * Adds an itemised deduction. Each carries a reason, because "we kept 800 of
   * your 2000" with no breakdown is the exact dispute this ledger exists to
   * prevent.
   */
  public addDeduction(holdId: string, deduction: Deduction): void {
    const hold = this.requireHold(holdId);

    if (hold.status === "SETTLED" || hold.status === "FORFEITED") {
      throw new Error(`Hold ${holdId} is ${hold.status} and can no longer be assessed.`);
    }
    if (!deduction.reason || deduction.reason.trim().length < 4) {
      throw new Error("A deduction requires a stated reason.");
    }
    if (!deduction.assessedBy) {
      throw new Error("A deduction requires the assessor's identity.");
    }
    this.assertMinorUnits(deduction.amountMinor, "Deduction");
    if (deduction.amountMinor === 0) {
      throw new Error("A deduction of zero is not a deduction; omit it.");
    }

    const existing = this.deductions.get(holdId) ?? [];
    existing.push({ ...deduction, reason: deduction.reason.trim() });
    this.deductions.set(holdId, existing);

    // Adding damage to a hold that was marked clean moves it into assessment,
    // so the two facts cannot contradict each other.
    if (hold.status === "HELD") {
      this.holds.set(holdId, { ...hold, status: "UNDER_ASSESSMENT", returnedUndamaged: false });
    }
  }

  public getDeductions(holdId: string): Deduction[] {
    return [...(this.deductions.get(holdId) ?? [])].map((deduction) => ({ ...deduction }));
  }

  public assessedDamageMinor(holdId: string): number {
    return this.getDeductions(holdId).reduce((sum, deduction) => sum + deduction.amountMinor, 0);
  }

  // ---------------------------------------------------------------------------
  // Settlement
  // ---------------------------------------------------------------------------

  /**
   * Closes a hold and produces the statement.
   *
   * Deductions are capped at the deposit. A 3000 repair against a 2000 deposit
   * forfeits 2000 and reports a 1000 shortfall; it does not release minus 1000
   * to the borrower.
   */
  public settle(holdId: string, settledBy: string, settledAt: Date): Settlement {
    const hold = this.requireHold(holdId);
    this.assertTransition(hold.status, "SETTLED", holdId);

    if (!settledBy) {
      throw new Error("A settlement requires the settling officer's identity.");
    }
    if (hold.returnedAt === null) {
      throw new Error(`Hold ${holdId} has not been returned. Forfeit it instead of settling it.`);
    }

    const deductions = this.getDeductions(holdId);
    const assessedDamageMinor = this.assessedDamageMinor(holdId);
    const forfeitedMinor = Math.min(assessedDamageMinor, hold.heldMinor);
    const releasedMinor = hold.heldMinor - forfeitedMinor;
    const unrecoveredShortfallMinor = Math.max(0, assessedDamageMinor - hold.heldMinor);

    const settlement: Settlement = {
      holdId,
      heldMinor: hold.heldMinor,
      assessedDamageMinor,
      forfeitedMinor,
      releasedMinor,
      unrecoveredShortfallMinor,
      deductions,
      settledAt,
      settledBy,
      currency: hold.currency,
    };

    this.assertBalances(settlement);

    this.settlements.set(holdId, settlement);
    this.holds.set(holdId, { ...hold, status: "SETTLED" });

    return { ...settlement };
  }

  /**
   * Forfeits the whole deposit for kit that never came back. Distinct from a
   * settlement at zero release: the asset is still missing, and conflating the
   * two loses that fact.
   */
  public forfeit(
    holdId: string,
    reason: string,
    forfeitedBy: string,
    forfeitedAt: Date,
  ): Settlement {
    const hold = this.requireHold(holdId);
    this.assertTransition(hold.status, "FORFEITED", holdId);

    if (!reason || reason.trim().length < 4) {
      throw new Error("A forfeit requires a stated reason.");
    }
    if (hold.returnedAt !== null) {
      throw new Error(
        `Hold ${holdId} was returned on ${hold.returnedAt.toISOString()}. Settle it instead of forfeiting it.`,
      );
    }

    const deduction: Deduction = {
      reason: reason.trim(),
      amountMinor: hold.heldMinor,
      assessedBy: forfeitedBy,
      assessedAt: forfeitedAt,
    };

    const settlement: Settlement = {
      holdId,
      heldMinor: hold.heldMinor,
      assessedDamageMinor: hold.heldMinor,
      forfeitedMinor: hold.heldMinor,
      releasedMinor: 0,
      unrecoveredShortfallMinor: 0,
      deductions: [deduction],
      settledAt: forfeitedAt,
      settledBy: forfeitedBy,
      currency: hold.currency,
    };

    this.assertBalances(settlement);

    this.settlements.set(holdId, settlement);
    this.holds.set(holdId, { ...hold, status: "FORFEITED" });

    return { ...settlement };
  }

  public getSettlement(holdId: string): Settlement | undefined {
    const settlement = this.settlements.get(holdId);
    return settlement ? { ...settlement } : undefined;
  }

  // ---------------------------------------------------------------------------
  // Release obligation
  // ---------------------------------------------------------------------------

  /**
   * Holds that should have been released by now.
   *
   * This is the whole reason a student is still chasing a deposit in June for
   * a camera they returned in March: nothing in the system was ever obliged to
   * hand it back, so nobody noticed.
   */
  public findOverdueReleases(clubId: string, evaluatedAt: Date): OverdueRelease[] {
    const windowMs = RELEASE_WINDOW_DAYS * 86_400_000;

    return Array.from(this.holds.values())
      .filter(
        (hold) =>
          hold.clubId === clubId &&
          hold.status === "HELD" &&
          hold.returnedUndamaged &&
          hold.returnedAt !== null &&
          evaluatedAt.getTime() - hold.returnedAt.getTime() > windowMs,
      )
      .map((hold) => {
        const returnedAt = hold.returnedAt as Date;
        return {
          holdId: hold.holdId,
          assetTag: hold.assetTag,
          borrowerUserId: hold.borrowerUserId,
          heldMinor: hold.heldMinor,
          currency: hold.currency,
          returnedAt,
          daysOverdue: Math.floor(
            (evaluatedAt.getTime() - returnedAt.getTime() - windowMs) / 86_400_000,
          ),
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  /** Total the club is currently sitting on for a given club. */
  public outstandingHeldMinor(clubId: string): number {
    return Array.from(this.holds.values())
      .filter(
        (hold) =>
          hold.clubId === clubId && (hold.status === "HELD" || hold.status === "UNDER_ASSESSMENT"),
      )
      .reduce((sum, hold) => sum + hold.heldMinor, 0);
  }

  // ---------------------------------------------------------------------------
  // Statement
  // ---------------------------------------------------------------------------

  /**
   * The statement the borrower actually reads. It shows the arithmetic rather
   * than only the result, because a number with no working behind it is what
   * turns a settlement into an argument.
   */
  public buildStatement(holdId: string): string[] {
    const settlement = this.settlements.get(holdId);
    if (!settlement) {
      throw new Error(`Hold '${holdId}' has not been settled.`);
    }

    const format = (minor: number): string => `${settlement.currency} ${(minor / 100).toFixed(2)}`;

    const lines: string[] = [`Deposit held: ${format(settlement.heldMinor)}`];

    if (settlement.deductions.length === 0) {
      lines.push("No damage was assessed.");
    } else {
      lines.push("Deductions:");
      for (const deduction of settlement.deductions) {
        lines.push(`  - ${deduction.reason}: ${format(deduction.amountMinor)}`);
      }
      lines.push(`Total assessed damage: ${format(settlement.assessedDamageMinor)}`);
    }

    if (settlement.unrecoveredShortfallMinor > 0) {
      lines.push(
        `Assessed damage exceeded the deposit. Withheld ${format(settlement.forfeitedMinor)}, ` +
          `the deposit's full value. ${format(settlement.unrecoveredShortfallMinor)} remains unrecovered.`,
      );
    }

    lines.push(`Withheld: ${format(settlement.forfeitedMinor)}`);
    lines.push(`Returned to you: ${format(settlement.releasedMinor)}`);

    return lines;
  }

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------

  private requireHold(holdId: string): DepositHold {
    const hold = this.holds.get(holdId);
    if (!hold) {
      throw new Error(`Unknown deposit hold '${holdId}'.`);
    }
    return hold;
  }

  private assertTransition(from: DepositStatus, to: DepositStatus, holdId: string): void {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new Error(
        `Hold ${holdId} cannot move from ${from} to ${to}. A closed deposit stays closed.`,
      );
    }
  }

  /**
   * The one invariant worth crashing over. If a settlement does not balance,
   * somebody's money has gone missing and continuing is worse than failing.
   */
  private assertBalances(settlement: Settlement): void {
    if (settlement.releasedMinor + settlement.forfeitedMinor !== settlement.heldMinor) {
      throw new Error(
        `Settlement for ${settlement.holdId} does not balance: ` +
          `${settlement.releasedMinor} released + ${settlement.forfeitedMinor} forfeited ` +
          `!= ${settlement.heldMinor} held.`,
      );
    }
    if (settlement.releasedMinor < 0 || settlement.forfeitedMinor < 0) {
      throw new Error(`Settlement for ${settlement.holdId} produced a negative amount.`);
    }
    if (settlement.forfeitedMinor > settlement.heldMinor) {
      throw new Error(`Settlement for ${settlement.holdId} withheld more than was ever held.`);
    }
  }

  private assertMinorUnits(value: number, label: string): void {
    if (!Number.isInteger(value)) {
      throw new Error(`${label} must be an integer number of minor units.`);
    }
    if (value < 0) {
      throw new Error(`${label} cannot be negative.`);
    }
  }
}

export const equipmentDepositLedgerService = new EquipmentDepositLedgerService();
