/**
 * Module: Physical Key & Access Card Custody Chain
 * File: src/services/keyCustodyChainService.ts
 * Scope: Keeps an unbroken record of who holds every club key and access card,
 *        and prices the exposure of one that never comes back (#4557).
 *
 * Keys change hands in car parks and group chats. When an officer graduates
 * without returning one, nobody notices until the next person needs it, and by
 * then nobody can say who had it last, what it opens, or what it would cost to
 * make the room secure again.
 *
 * That last question has a real answer, and this is the layer that can compute
 * it. A card is a credential you can switch off: losing one costs a
 * replacement. A key is not. An unreturned key to a door on a shared keyway
 * means every lock on that keyway is compromised, and putting it right means
 * recutting every other key issued against it. Treating those two as the same
 * kind of outstanding item is precisely why the second one gets chased and the
 * first one does not.
 *
 * Custody is a fold over an append-only log, never a mutable holder column. A
 * column would absorb a transfer from somebody who was not holding the thing;
 * the fold rejects it, which is the break the whole module exists to catch.
 */

export type CredentialType = "PHYSICAL_KEY" | "ACCESS_CARD";

export type CustodyEventType =
  | "ISSUED"
  | "TRANSFER_INITIATED"
  | "TRANSFER_ACKNOWLEDGED"
  | "TRANSFER_DECLINED"
  | "RETURNED"
  | "REVOKED";

export type CredentialStanding = "IN_STORE" | "HELD" | "IN_TRANSFER" | "DELINQUENT" | "RETIRED";

export type IssueOutcome = "ISSUED" | "REFUSED_NOT_IN_STORE" | "REFUSED_RETIRED";

export type TransferOutcome =
  | "TRANSFER_INITIATED"
  | "REFUSED_BROKEN_CHAIN"
  | "REFUSED_TRANSFER_PENDING"
  | "REFUSED_NOT_HELD"
  | "REFUSED_SELF_TRANSFER"
  | "REFUSED_RETIRED";

export type AcknowledgementOutcome =
  "ACKNOWLEDGED" | "DECLINED" | "REFUSED_NO_PENDING_TRANSFER" | "REFUSED_NOT_THE_RECIPIENT";

export type ReturnOutcome =
  "RETURNED" | "REFUSED_NOT_THE_HOLDER" | "REFUSED_TRANSFER_PENDING" | "REFUSED_NOT_HELD";

export type RevocationOutcome =
  "REVOKED" | "REFUSED_PHYSICAL_KEY" | "REFUSED_NOT_HELD" | "REFUSED_ALREADY_RETIRED";

export interface DoorSpec {
  doorId: string;
  label: string;
  /** What it costs to rekey this one lock. */
  rekeyCostCents: number;
}

export interface Keyway {
  keywayId: string;
  buildingId: string;
  doors: DoorSpec[];
  /** What it costs to cut one replacement key against this keyway. */
  keyCutCostCents: number;
}

export interface Credential {
  credentialId: string;
  clubId: string;
  type: CredentialType;
  label: string;
  /** Physical keys only. A card belongs to no keyway. */
  keywayId: string | null;
  /** Access cards only: what a replacement costs. */
  replacementCostCents: number;
  /** Held while the credential is out. */
  depositCents: number;
}

export interface CustodyEvent {
  sequence: number;
  credentialId: string;
  type: CustodyEventType;
  fromUserId: string | null;
  toUserId: string | null;
  occurredAt: Date;
  memo: string;
}

export interface CustodyState {
  credentialId: string;
  asOf: Date;
  /** Null means the credential is in the store, not that nobody knows. */
  holderUserId: string | null;
  pendingTransferToUserId: string | null;
  retired: boolean;
}

export interface ExposureBreakdown {
  credentialId: string;
  type: CredentialType;
  totalCents: number;
  /** Physical keys: the locks that have to change. */
  doorsAffected: number;
  doorRekeyCents: number;
  /** Physical keys: the other keys on the keyway that have to be recut. */
  keysToRecut: number;
  keyRecutCents: number;
  /** Cards: the replacement. */
  replacementCents: number;
}

export interface ReturnDemand {
  credentialId: string;
  raisedAt: Date;
  dueBy: Date;
  reason: string;
}

export interface CredentialAssessment {
  credentialId: string;
  assessedAt: Date;
  standing: CredentialStanding;
  holderUserId: string | null;
  pendingTransferToUserId: string | null;
  returnDemand: ReturnDemand | null;
  delinquent: boolean;
  exposureCents: number;
}

export interface DepositSettlement {
  credentialId: string;
  heldCents: number;
  refundedCents: number;
  forfeitedCents: number;
  /** Exposure the deposit could not cover. A real figure the club needs. */
  unrecoveredShortfallCents: number;
}

export class KeyCustodyChainService {
  private readonly keyways: Map<string, Keyway>;
  private readonly credentials: Map<string, Credential>;
  private readonly events: CustodyEvent[];
  private readonly demands: Map<string, ReturnDemand>;
  private sequence: number;

  constructor() {
    this.keyways = new Map();
    this.credentials = new Map();
    this.events = [];
    this.demands = new Map();
    this.sequence = 0;
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  public registerKeyway(keyway: Keyway): void {
    if (this.keyways.has(keyway.keywayId)) {
      throw new Error(`Keyway ${keyway.keywayId} is already registered.`);
    }
    if (keyway.doors.length === 0) {
      throw new Error(`Keyway ${keyway.keywayId} must open at least one door.`);
    }
    this.keyways.set(keyway.keywayId, { ...keyway, doors: [...keyway.doors] });
  }

  public registerCredential(credential: Credential): void {
    if (this.credentials.has(credential.credentialId)) {
      throw new Error(`Credential ${credential.credentialId} is already registered.`);
    }
    if (credential.type === "PHYSICAL_KEY") {
      if (!credential.keywayId) {
        throw new Error(`Physical key ${credential.credentialId} must name a keyway.`);
      }
      if (!this.keyways.has(credential.keywayId)) {
        throw new Error(`Unknown keyway ${credential.keywayId}.`);
      }
    } else if (credential.keywayId) {
      // A card has no keyway, and letting one carry a keyway id would make the
      // exposure calculation quietly wrong for the cheap case.
      throw new Error(`Access card ${credential.credentialId} cannot belong to a keyway.`);
    }
    this.credentials.set(credential.credentialId, { ...credential });
  }

  // ---------------------------------------------------------------------------
  // Custody
  // ---------------------------------------------------------------------------

  public issue(
    credentialId: string,
    toUserId: string,
    at: Date,
    memo = "Issued from the key store",
  ): { outcome: IssueOutcome } {
    this.requireCredential(credentialId);
    const state = this.holderAt(credentialId, at);

    if (state.retired) return { outcome: "REFUSED_RETIRED" };
    if (state.holderUserId !== null || state.pendingTransferToUserId !== null) {
      return { outcome: "REFUSED_NOT_IN_STORE" };
    }

    this.append(credentialId, "ISSUED", null, toUserId, at, memo);
    return { outcome: "ISSUED" };
  }

  /**
   * Opens a transfer between two people.
   *
   * The from-holder is checked against the fold, not taken on trust. A transfer
   * claiming to come from somebody who was not holding the credential is the
   * break this module exists to catch, and a mutable holder column would have
   * absorbed it without comment.
   */
  public initiateTransfer(
    credentialId: string,
    fromUserId: string,
    toUserId: string,
    at: Date,
    memo = "Committee handover",
  ): { outcome: TransferOutcome } {
    this.requireCredential(credentialId);
    const state = this.holderAt(credentialId, at);

    if (state.retired) return { outcome: "REFUSED_RETIRED" };
    if (state.pendingTransferToUserId !== null) return { outcome: "REFUSED_TRANSFER_PENDING" };
    if (state.holderUserId === null) return { outcome: "REFUSED_NOT_HELD" };
    if (state.holderUserId !== fromUserId) return { outcome: "REFUSED_BROKEN_CHAIN" };
    if (fromUserId === toUserId) return { outcome: "REFUSED_SELF_TRANSFER" };

    this.append(credentialId, "TRANSFER_INITIATED", fromUserId, toUserId, at, memo);
    return { outcome: "TRANSFER_INITIATED" };
  }

  /**
   * Completes a transfer.
   *
   * A transfer is two-sided on purpose. Until the receiver acknowledges it,
   * custody stays with the sender rather than sitting between two people who
   * each believe the other has it — which is the state every one of these keys
   * is currently in.
   */
  public acknowledgeTransfer(
    credentialId: string,
    byUserId: string,
    at: Date,
  ): { outcome: AcknowledgementOutcome } {
    return this.resolveTransfer(credentialId, byUserId, at, "TRANSFER_ACKNOWLEDGED");
  }

  public declineTransfer(
    credentialId: string,
    byUserId: string,
    at: Date,
  ): { outcome: AcknowledgementOutcome } {
    return this.resolveTransfer(credentialId, byUserId, at, "TRANSFER_DECLINED");
  }

  public returnToStore(
    credentialId: string,
    byUserId: string,
    at: Date,
    memo = "Returned to the key store",
  ): { outcome: ReturnOutcome } {
    this.requireCredential(credentialId);
    const state = this.holderAt(credentialId, at);

    if (state.holderUserId === null) return { outcome: "REFUSED_NOT_HELD" };
    if (state.pendingTransferToUserId !== null) return { outcome: "REFUSED_TRANSFER_PENDING" };
    if (state.holderUserId !== byUserId) return { outcome: "REFUSED_NOT_THE_HOLDER" };

    this.append(credentialId, "RETURNED", byUserId, null, at, memo);
    this.demands.delete(credentialId);
    return { outcome: "RETURNED" };
  }

  /**
   * Switches off an access card.
   *
   * Refused for a physical key, and the refusal is the useful part. There is no
   * software action that makes a brass key stop opening a door, so recording
   * one would leave an open door looking closed. The honest response to a lost
   * key is `rekeyExposure`, which says what it will cost.
   */
  public revoke(credentialId: string, at: Date, reason: string): { outcome: RevocationOutcome } {
    const credential = this.requireCredential(credentialId);
    const state = this.holderAt(credentialId, at);

    if (state.retired) return { outcome: "REFUSED_ALREADY_RETIRED" };
    if (credential.type === "PHYSICAL_KEY") return { outcome: "REFUSED_PHYSICAL_KEY" };
    if (state.holderUserId === null) return { outcome: "REFUSED_NOT_HELD" };

    this.append(credentialId, "REVOKED", state.holderUserId, null, at, reason);
    this.demands.delete(credentialId);
    return { outcome: "REVOKED" };
  }

  /**
   * Who held the credential at a given instant, folded from the log.
   *
   * There is no stored holder to read. Every question about custody goes
   * through this fold, which is what makes a broken chain detectable rather
   * than merely regrettable.
   */
  public holderAt(credentialId: string, asOf: Date): CustodyState {
    const cutoff = asOf.getTime();
    let holderUserId: string | null = null;
    let pendingTransferToUserId: string | null = null;
    let retired = false;

    for (const event of this.events) {
      if (event.credentialId !== credentialId) continue;
      if (event.occurredAt.getTime() > cutoff) continue;

      switch (event.type) {
        case "ISSUED":
          holderUserId = event.toUserId;
          break;
        case "TRANSFER_INITIATED":
          pendingTransferToUserId = event.toUserId;
          break;
        case "TRANSFER_ACKNOWLEDGED":
          holderUserId = event.toUserId;
          pendingTransferToUserId = null;
          break;
        case "TRANSFER_DECLINED":
          // Custody never moved, so there is nothing to put back.
          pendingTransferToUserId = null;
          break;
        case "RETURNED":
          holderUserId = null;
          pendingTransferToUserId = null;
          break;
        case "REVOKED":
          holderUserId = null;
          pendingTransferToUserId = null;
          retired = true;
          break;
      }
    }

    return { credentialId, asOf, holderUserId, pendingTransferToUserId, retired };
  }

  public custodyLog(credentialId: string): readonly CustodyEvent[] {
    return this.events.filter((event) => event.credentialId === credentialId);
  }

  // ---------------------------------------------------------------------------
  // Exposure
  // ---------------------------------------------------------------------------

  /**
   * What an unreturned credential would cost to make good.
   *
   * The asymmetry between the two types is the reason this function exists.
   * A card is a row: replace it. A key on a shared keyway compromises every
   * lock that keyway opens, and every other key cut against it has to be
   * recut once those locks change. A club with one outstanding lab key and a
   * hundred-pound card sitting in the same "outstanding" list is being told
   * something false about which one to chase.
   */
  public rekeyExposure(credentialId: string, asOf: Date): ExposureBreakdown {
    const credential = this.requireCredential(credentialId);

    if (credential.type === "ACCESS_CARD") {
      return {
        credentialId,
        type: "ACCESS_CARD",
        totalCents: credential.replacementCostCents,
        doorsAffected: 0,
        doorRekeyCents: 0,
        keysToRecut: 0,
        keyRecutCents: 0,
        replacementCents: credential.replacementCostCents,
      };
    }

    const keyway = this.keyways.get(credential.keywayId!)!;
    const doorRekeyCents = keyway.doors.reduce((sum, door) => sum + door.rekeyCostCents, 0);

    // Every other key against this keyway that is currently out or in the store
    // has to be recut once the locks change. The lost key itself is not recut —
    // it is the reason for the work.
    const keysToRecut = [...this.credentials.values()].filter(
      (other) =>
        other.type === "PHYSICAL_KEY" &&
        other.keywayId === credential.keywayId &&
        other.credentialId !== credentialId &&
        !this.holderAt(other.credentialId, asOf).retired,
    ).length;

    const keyRecutCents = keysToRecut * keyway.keyCutCostCents;

    return {
      credentialId,
      type: "PHYSICAL_KEY",
      totalCents: doorRekeyCents + keyRecutCents,
      doorsAffected: keyway.doors.length,
      doorRekeyCents,
      keysToRecut,
      keyRecutCents,
      replacementCents: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Return demands, delinquency and deposits
  // ---------------------------------------------------------------------------

  /**
   * Raised when the role that justified the credential ends — graduation, a
   * handover, an impeachment.
   */
  public raiseReturnDemand(
    credentialId: string,
    raisedAt: Date,
    dueBy: Date,
    reason: string,
  ): void {
    this.requireCredential(credentialId);
    if (dueBy.getTime() <= raisedAt.getTime()) {
      throw new Error(`A return demand on ${credentialId} must allow time to comply.`);
    }
    this.demands.set(credentialId, { credentialId, raisedAt, dueBy, reason });
  }

  public assess(credentialId: string, assessedAt: Date): CredentialAssessment {
    this.requireCredential(credentialId);
    const state = this.holderAt(credentialId, assessedAt);
    const demand = this.demands.get(credentialId) ?? null;

    const delinquent =
      demand !== null &&
      state.holderUserId !== null &&
      assessedAt.getTime() > demand.dueBy.getTime();

    let standing: CredentialStanding;
    if (state.retired) {
      standing = "RETIRED";
    } else if (delinquent) {
      standing = "DELINQUENT";
    } else if (state.pendingTransferToUserId !== null) {
      standing = "IN_TRANSFER";
    } else if (state.holderUserId !== null) {
      standing = "HELD";
    } else {
      standing = "IN_STORE";
    }

    return {
      credentialId,
      assessedAt,
      standing,
      holderUserId: state.holderUserId,
      pendingTransferToUserId: state.pendingTransferToUserId,
      returnDemand: demand,
      delinquent,
      // Exposure is what it would cost if this one never came back, quoted
      // whatever its standing, so a club can see the risk before it is realised.
      exposureCents: this.rekeyExposure(credentialId, assessedAt).totalCents,
    };
  }

  /**
   * Settles the deposit on a credential.
   *
   * Forfeit is capped at the exposure rather than at the deposit. A deposit
   * larger than the cost of putting things right is not a windfall, and keeping
   * the difference would make the deposit a fine. Where the exposure is the
   * larger of the two, the uncovered remainder is reported rather than
   * disappearing into a negative refund.
   */
  public settleDeposit(credentialId: string, at: Date): DepositSettlement {
    const credential = this.requireCredential(credentialId);
    const assessment = this.assess(credentialId, at);
    const held = credential.depositCents;

    if (!assessment.delinquent) {
      return {
        credentialId,
        heldCents: held,
        refundedCents: held,
        forfeitedCents: 0,
        unrecoveredShortfallCents: 0,
      };
    }

    const exposure = assessment.exposureCents;
    const forfeited = Math.min(held, exposure);

    return {
      credentialId,
      heldCents: held,
      refundedCents: held - forfeited,
      forfeitedCents: forfeited,
      unrecoveredShortfallCents: Math.max(0, exposure - held),
    };
  }

  /** Everything a club has out, delinquent first, with the total at risk. */
  public clubExposure(
    clubId: string,
    assessedAt: Date,
  ): { assessments: CredentialAssessment[]; delinquentExposureCents: number } {
    const assessments = [...this.credentials.values()]
      .filter((credential) => credential.clubId === clubId)
      .map((credential) => this.assess(credential.credentialId, assessedAt))
      .sort(
        (a, b) =>
          Number(b.delinquent) - Number(a.delinquent) ||
          b.exposureCents - a.exposureCents ||
          a.credentialId.localeCompare(b.credentialId),
      );

    const delinquentExposureCents = assessments
      .filter((assessment) => assessment.delinquent)
      .reduce((sum, assessment) => sum + assessment.exposureCents, 0);

    return { assessments, delinquentExposureCents };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private resolveTransfer(
    credentialId: string,
    byUserId: string,
    at: Date,
    type: "TRANSFER_ACKNOWLEDGED" | "TRANSFER_DECLINED",
  ): { outcome: AcknowledgementOutcome } {
    this.requireCredential(credentialId);
    const state = this.holderAt(credentialId, at);

    if (state.pendingTransferToUserId === null) {
      return { outcome: "REFUSED_NO_PENDING_TRANSFER" };
    }
    if (state.pendingTransferToUserId !== byUserId) {
      return { outcome: "REFUSED_NOT_THE_RECIPIENT" };
    }

    this.append(
      credentialId,
      type,
      state.holderUserId,
      byUserId,
      at,
      type === "TRANSFER_ACKNOWLEDGED" ? "Receipt acknowledged" : "Receipt declined",
    );
    return { outcome: type === "TRANSFER_ACKNOWLEDGED" ? "ACKNOWLEDGED" : "DECLINED" };
  }

  private append(
    credentialId: string,
    type: CustodyEventType,
    fromUserId: string | null,
    toUserId: string | null,
    occurredAt: Date,
    memo: string,
  ): void {
    this.sequence += 1;
    this.events.push({
      sequence: this.sequence,
      credentialId,
      type,
      fromUserId,
      toUserId,
      occurredAt,
      memo,
    });
  }

  private requireCredential(credentialId: string): Credential {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      throw new Error(`Unknown credential ${credentialId}.`);
    }
    return credential;
  }
}
