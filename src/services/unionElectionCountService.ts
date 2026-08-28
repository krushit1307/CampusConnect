/**
 * Module: Student Union Election Count (Single Transferable Vote)
 * File: src/services/unionElectionCountService.ts
 * Scope: Validates ballots against a register frozen at close of nominations,
 *        runs a Droop-quota STV count with fractional surplus transfers,
 *        resolves ties by countback before any draw, and emits a replayable
 *        stage-by-stage record rather than a winner (#5013).
 *
 * Counting the first preferences and declaring the largest pile the winner
 * produces a different result from a transferable count in exactly the close
 * races that get disputed. There is no shortcut available: the count is
 * iterative, the transfers depend on the eliminations, and the eliminations
 * depend on the transfers.
 *
 * The quota is not half. It is a Droop quota over the *valid* poll, and the
 * valid poll is not the number of ballots cast, because spoiled ballots never
 * enter the count and exhausted ones leave it at different stages. The quota is
 * computed once from the valid poll and then held: recomputing it as ballots
 * exhaust would move the target underneath candidates who have already reached
 * it.
 *
 * Surplus transfer is fractional and inclusive. A candidate elected with more
 * votes than the quota transfers the excess, and every ballot in the pile moves
 * at a reduced value rather than some arbitrary subset moving whole. Getting
 * this wrong is not a rounding difference — it reorders the eliminations
 * underneath it, which changes who is elected. All arithmetic here is in scaled
 * integers for that reason; floating point drift across a hundred transfers is
 * indistinguishable from a real difference at the point it decides a seat.
 *
 * An exhausted ballot is not a spoiled one. A voter who ranks two candidates
 * out of nine has cast a perfectly valid ballot that stops transferring once
 * both are dealt with, and it leaves the count without reducing a quota that
 * has already been computed.
 *
 * Ties are the part everyone skips, and "pick one" is how a result gets
 * overturned. A tie is broken by countback to the earliest stage at which the
 * tied candidates differed, and only where no stage separates them by a
 * recorded draw — with the rule that fired forming part of the result.
 *
 * Eligibility is a fact about a moment. A candidate who was a registered
 * student on nomination day and has since withdrawn from their course was
 * validly nominated; a voter who joined after the register closed does not vote
 * in this election; a candidate disqualified during the campaign is not deleted,
 * because their ballots still exist and still have to transfer onward.
 *
 * And the output that matters is not the winner. It is the stage-by-stage
 * record that lets a losing candidate follow the arithmetic and arrive at the
 * same place.
 */

/** Ballot weights are integers in millionths of a vote. */
export const WEIGHT_SCALE = 1_000_000;

export type BallotRejectionReason =
  | "NO_PREFERENCES"
  | "DUPLICATE_PREFERENCE"
  | "NON_SEQUENTIAL_PREFERENCES"
  | "UNKNOWN_CANDIDATE"
  | "VOTER_NOT_ON_REGISTER"
  | "DUPLICATE_BALLOT_FROM_VOTER";

export type StageAction =
  "FIRST_PREFERENCES" | "SURPLUS_TRANSFER" | "ELIMINATION" | "FILL_REMAINING_SEATS";

export type TieBreakRule = "COUNTBACK" | "RANDOM_DRAW";

export type CandidateExclusion =
  "NOT_VALIDLY_NOMINATED" | "INELIGIBLE_ON_NOMINATION_DAY" | "DISQUALIFIED";

export interface Election {
  electionId: string;
  position: string;
  seats: number;
  /** Voters who joined after this do not vote in this election. */
  registerClosesAt: Date;
  nominationClosesAt: Date;
}

export interface Candidate {
  candidateId: string;
  name: string;
  /** Re-opening nominations is a candidate. It can reach the quota and take a seat. */
  isReopenNominations: boolean;
  nominatedAt: Date;
  /** Evaluated on nomination day, not now. Withdrawing from a course later does not undo it. */
  eligibleOnNominationDay: boolean;
  disqualifiedAt: Date | null;
}

export interface BallotPreference {
  rank: number;
  candidateId: string;
}

export interface Ballot {
  ballotId: string;
  voterId: string;
  castAt: Date;
  preferences: BallotPreference[];
}

export interface RegisteredVoter {
  voterId: string;
  joinedAt: Date;
}

export interface RejectedBallot {
  ballotId: string;
  reason: BallotRejectionReason;
  detail: string;
}

export interface TieBreakRecord {
  tied: string[];
  rule: TieBreakRule;
  /** The stage countback separated them at, where countback did. */
  separatedAtStage: number | null;
  chosen: string;
}

export interface CountStage {
  stageNumber: number;
  action: StageAction;
  /** Totals for every candidate still capable of holding votes, in scaled units. */
  totalsScaled: Record<string, number>;
  /** The same totals in votes, for anyone reading the record rather than testing it. */
  totals: Record<string, number>;
  electedAtThisStage: string[];
  eliminatedAtThisStage: string | null;
  /** Which candidate's surplus moved, where one did. */
  transferredFrom: string | null;
  /** The fraction applied to every ballot in that pile, in scaled units. */
  transferValueScaled: number | null;
  exhaustedThisStageScaled: number;
  cumulativeExhaustedScaled: number;
  tieBreak: TieBreakRecord | null;
  note: string;
}

export interface ElectionResult {
  electionId: string;
  seats: number;
  quotaScaled: number;
  quota: number;
  ballotsCast: number;
  validPoll: number;
  rejected: RejectedBallot[];
  excludedCandidates: Record<string, CandidateExclusion>;
  stages: CountStage[];
  /** Candidate ids in the order they were elected. */
  elected: string[];
  /** Seats actually filled by a person. */
  seatsFilled: number;
  /** Seats that RON took, which means the position is re-run. */
  seatsReopened: number;
  /** Seats nobody stood for. Not the same thing as the line above. */
  seatsUnfilled: number;
  exhaustedScaled: number;
}

interface LiveBallot {
  ballotId: string;
  ordered: string[];
  weightScaled: number;
  /** Index in `ordered` of the candidate currently holding it, or -1 when exhausted. */
  position: number;
  holder: string | null;
}

/** Deterministic fallback so a draw is reproducible when nobody supplies one. */
function defaultDraw(tied: string[]): string {
  return [...tied].sort()[0];
}

export class UnionElectionCountService {
  private readonly candidates = new Map<string, Candidate>();
  private readonly voters = new Map<string, RegisteredVoter>();
  private readonly ballots: Ballot[] = [];

  constructor(
    private readonly election: Election,
    private readonly drawResolver: (tied: string[]) => string = defaultDraw,
  ) {}

  addCandidate(candidate: Candidate): void {
    this.candidates.set(candidate.candidateId, { ...candidate });
  }

  registerVoter(voter: RegisteredVoter): void {
    this.voters.set(voter.voterId, { ...voter });
  }

  castBallot(ballot: Ballot): void {
    this.ballots.push({
      ...ballot,
      preferences: ballot.preferences.map((preference) => ({ ...preference })),
    });
  }

  /** Why a candidate cannot hold votes, or null where they can. */
  exclusionFor(candidate: Candidate, countAt: Date): CandidateExclusion | null {
    if (candidate.nominatedAt.getTime() > this.election.nominationClosesAt.getTime()) {
      return "NOT_VALIDLY_NOMINATED";
    }
    if (!candidate.eligibleOnNominationDay) return "INELIGIBLE_ON_NOMINATION_DAY";
    if (candidate.disqualifiedAt && candidate.disqualifiedAt.getTime() <= countAt.getTime()) {
      return "DISQUALIFIED";
    }
    return null;
  }

  /**
   * Reject before counting, and say why. A spoiled ballot and a ballot that
   * merely runs out of preferences later are different objects, and only the
   * first is rejected here.
   */
  validateBallots(): { valid: Ballot[]; rejected: RejectedBallot[] } {
    const valid: Ballot[] = [];
    const rejected: RejectedBallot[] = [];
    const seenVoters = new Set<string>();

    for (const ballot of this.ballots) {
      const voter = this.voters.get(ballot.voterId);
      if (!voter || voter.joinedAt.getTime() > this.election.registerClosesAt.getTime()) {
        rejected.push({
          ballotId: ballot.ballotId,
          reason: "VOTER_NOT_ON_REGISTER",
          detail: voter ? "Joined after the register closed." : "Not on the register.",
        });
        continue;
      }

      if (seenVoters.has(ballot.voterId)) {
        rejected.push({
          ballotId: ballot.ballotId,
          reason: "DUPLICATE_BALLOT_FROM_VOTER",
          detail: "A ballot from this voter was already accepted.",
        });
        continue;
      }

      if (ballot.preferences.length === 0) {
        rejected.push({
          ballotId: ballot.ballotId,
          reason: "NO_PREFERENCES",
          detail: "Blank ballot.",
        });
        continue;
      }

      const ranks = ballot.preferences.map((preference) => preference.rank).sort((a, b) => a - b);
      const contiguous = ranks.every((rank, index) => rank === index + 1);
      if (!contiguous) {
        rejected.push({
          ballotId: ballot.ballotId,
          reason: "NON_SEQUENTIAL_PREFERENCES",
          detail: `Ranks ${ranks.join(", ")} do not run from 1 without a gap.`,
        });
        continue;
      }

      const ids = ballot.preferences.map((preference) => preference.candidateId);
      if (new Set(ids).size !== ids.length) {
        rejected.push({
          ballotId: ballot.ballotId,
          reason: "DUPLICATE_PREFERENCE",
          detail: "The same candidate is ranked twice.",
        });
        continue;
      }

      const unknown = ids.find((candidateId) => !this.candidates.has(candidateId));
      if (unknown) {
        rejected.push({
          ballotId: ballot.ballotId,
          reason: "UNKNOWN_CANDIDATE",
          detail: `No candidate ${unknown} in this election.`,
        });
        continue;
      }

      seenVoters.add(ballot.voterId);
      valid.push(ballot);
    }

    return { valid, rejected };
  }

  private orderedPreferences(ballot: Ballot): string[] {
    return [...ballot.preferences]
      .sort((a, b) => a.rank - b.rank)
      .map((preference) => preference.candidateId);
  }

  /**
   * Move a ballot to its next preference that is still capable of receiving
   * votes. Candidates already elected or eliminated are skipped, as are those
   * excluded before the count began — a disqualified candidate's ballots
   * transfer onward rather than disappearing with them.
   */
  private advance(ballot: LiveBallot, available: (candidateId: string) => boolean): void {
    for (let index = ballot.position + 1; index < ballot.ordered.length; index += 1) {
      if (available(ballot.ordered[index])) {
        ballot.position = index;
        ballot.holder = ballot.ordered[index];
        return;
      }
    }
    ballot.position = -1;
    ballot.holder = null;
  }

  /**
   * Countback: the earliest stage at which the tied candidates were not level
   * decides it. Only where no stage separates them does a draw happen, and the
   * record says which one it was.
   */
  private breakTie(tied: string[], stages: CountStage[], preferLowest: boolean): TieBreakRecord {
    for (const stage of stages) {
      const totals = tied.map((candidateId) => stage.totalsScaled[candidateId] ?? 0);
      const allEqual = totals.every((total) => total === totals[0]);
      if (allEqual) continue;

      const target = preferLowest ? Math.min(...totals) : Math.max(...totals);
      const matching = tied.filter((_candidateId, index) => totals[index] === target);
      if (matching.length === 1) {
        return {
          tied: [...tied],
          rule: "COUNTBACK",
          separatedAtStage: stage.stageNumber,
          chosen: matching[0],
        };
      }
    }

    return {
      tied: [...tied],
      rule: "RANDOM_DRAW",
      separatedAtStage: null,
      chosen: this.drawResolver(tied),
    };
  }

  /**
   * Run the count. The return value is the record, not the answer; the answer
   * is one field of it.
   */
  count(countAt: Date): ElectionResult {
    const { valid, rejected } = this.validateBallots();

    const excludedCandidates: Record<string, CandidateExclusion> = {};
    for (const candidate of this.candidates.values()) {
      const exclusion = this.exclusionFor(candidate, countAt);
      if (exclusion) excludedCandidates[candidate.candidateId] = exclusion;
    }

    const continuing = new Set(
      [...this.candidates.keys()].filter((candidateId) => !excludedCandidates[candidateId]),
    );
    const elected: string[] = [];
    const eliminated = new Set<string>();
    const retainedScaled = new Map<string, number>();
    const surplusPending = new Map<string, number>();

    const available = (candidateId: string): boolean => continuing.has(candidateId);

    const live: LiveBallot[] = valid.map((ballot) => {
      const ordered = this.orderedPreferences(ballot);
      const entry: LiveBallot = {
        ballotId: ballot.ballotId,
        ordered,
        weightScaled: WEIGHT_SCALE,
        position: -1,
        holder: null,
      };
      this.advance(entry, available);
      return entry;
    });

    const validPoll = valid.length;
    // Droop. Computed once from the valid poll and then held, because a target
    // that moves as ballots exhaust moves underneath candidates who reached it.
    const quotaScaled =
      validPoll === 0 ? 0 : Math.floor((validPoll * WEIGHT_SCALE) / (this.election.seats + 1)) + 1;

    const stages: CountStage[] = [];
    let cumulativeExhaustedScaled = 0;

    const totalsFor = (): Record<string, number> => {
      const totals: Record<string, number> = {};
      for (const candidateId of continuing) totals[candidateId] = 0;
      for (const candidateId of elected) {
        totals[candidateId] = retainedScaled.get(candidateId) ?? 0;
      }
      for (const ballot of live) {
        // An elected candidate shows the quota they retain, not the quota plus
        // the pile still sitting with them waiting to be distributed.
        if (!ballot.holder || retainedScaled.has(ballot.holder)) continue;
        totals[ballot.holder] = (totals[ballot.holder] ?? 0) + ballot.weightScaled;
      }
      return totals;
    };

    const pushStage = (
      action: StageAction,
      partial: Partial<CountStage> & { note: string },
      exhaustedThisStage: number,
    ): CountStage => {
      cumulativeExhaustedScaled += exhaustedThisStage;
      const totalsScaled = totalsFor();
      const stage: CountStage = {
        stageNumber: stages.length + 1,
        action,
        totalsScaled,
        totals: Object.fromEntries(
          Object.entries(totalsScaled).map(([key, value]) => [key, value / WEIGHT_SCALE]),
        ),
        electedAtThisStage: [],
        eliminatedAtThisStage: null,
        transferredFrom: null,
        transferValueScaled: null,
        exhaustedThisStageScaled: exhaustedThisStage,
        cumulativeExhaustedScaled,
        tieBreak: null,
        ...partial,
      };
      stages.push(stage);
      return stage;
    };

    /** Elect everyone at or above quota, highest first, and record the surplus. */
    const electReachers = (stage: CountStage): void => {
      const seatsLeft = this.election.seats - elected.length;
      if (seatsLeft <= 0) return;

      const reachers = [...continuing]
        .map((candidateId) => ({ candidateId, total: stage.totalsScaled[candidateId] ?? 0 }))
        .filter((entry) => entry.total >= quotaScaled)
        .sort((a, b) => b.total - a.total || a.candidateId.localeCompare(b.candidateId));

      for (const reacher of reachers) {
        if (elected.length >= this.election.seats) break;
        continuing.delete(reacher.candidateId);
        elected.push(reacher.candidateId);
        retainedScaled.set(reacher.candidateId, quotaScaled);
        const surplus = reacher.total - quotaScaled;
        if (surplus > 0) surplusPending.set(reacher.candidateId, surplus);
        stage.electedAtThisStage.push(reacher.candidateId);
      }

      // The stage keeps the totals that reached the quota rather than the
      // retained quota, because the record has to show why the seat was won.
    };

    const firstStage = pushStage("FIRST_PREFERENCES", { note: "First preferences." }, 0);
    electReachers(firstStage);

    const maxStages = this.candidates.size * 4 + 10;

    while (elected.length < this.election.seats && stages.length < maxStages) {
      // Where only as many candidates remain as there are seats, they are
      // elected without reaching a quota. Continuing to eliminate here would
      // empty the count.
      if (continuing.size > 0 && continuing.size <= this.election.seats - elected.length) {
        const filling = [...continuing].sort();
        for (const candidateId of filling) {
          continuing.delete(candidateId);
          elected.push(candidateId);
        }
        const stage = pushStage(
          "FILL_REMAINING_SEATS",
          { note: "Continuing candidates equal the remaining seats; elected without a quota." },
          0,
        );
        stage.electedAtThisStage = filling;
        break;
      }

      if (continuing.size === 0) break;

      const pending = [...surplusPending.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );

      if (pending.length > 0) {
        const [fromCandidate, surplus] = pending[0];
        surplusPending.delete(fromCandidate);

        const pile = live.filter((ballot) => ballot.holder === fromCandidate);
        const pileTotal = pile.reduce((sum, ballot) => sum + ballot.weightScaled, 0);
        let exhaustedThisStage = 0;

        if (pileTotal > 0) {
          for (const ballot of pile) {
            // Every ballot in the pile moves, at a value scaled by the surplus.
            // Moving a selected subset whole would reorder the eliminations
            // underneath, which changes who is elected.
            const before = ballot.weightScaled;
            ballot.weightScaled = Math.floor((before * surplus) / pileTotal);
            this.advance(ballot, available);
            if (!ballot.holder) exhaustedThisStage += ballot.weightScaled;
          }
        }

        const stage = pushStage(
          "SURPLUS_TRANSFER",
          {
            transferredFrom: fromCandidate,
            transferValueScaled:
              pileTotal > 0 ? Math.floor((surplus * WEIGHT_SCALE) / pileTotal) : 0,
            note: `Surplus of ${fromCandidate} distributed at a fraction of each ballot's value.`,
          },
          exhaustedThisStage,
        );
        electReachers(stage);
        continue;
      }

      const totals = totalsFor();
      const lowestValue = Math.min(...[...continuing].map((id) => totals[id] ?? 0));
      const lowestSet = [...continuing].filter((id) => (totals[id] ?? 0) === lowestValue).sort();

      let tieBreak: TieBreakRecord | null = null;
      let toEliminate = lowestSet[0];
      if (lowestSet.length > 1) {
        tieBreak = this.breakTie(lowestSet, stages, true);
        toEliminate = tieBreak.chosen;
      }

      continuing.delete(toEliminate);
      eliminated.add(toEliminate);

      let exhaustedThisStage = 0;
      for (const ballot of live) {
        if (ballot.holder !== toEliminate) continue;
        // Eliminated ballots move at their current value; only a surplus is
        // fractional.
        this.advance(ballot, available);
        if (!ballot.holder) exhaustedThisStage += ballot.weightScaled;
      }

      const stage = pushStage(
        "ELIMINATION",
        {
          eliminatedAtThisStage: toEliminate,
          tieBreak,
          note: tieBreak
            ? `Eliminated ${toEliminate}; tie resolved by ${tieBreak.rule.toLowerCase().replace("_", " ")}.`
            : `Eliminated ${toEliminate}, lowest of the continuing candidates.`,
        },
        exhaustedThisStage,
      );
      electReachers(stage);
    }

    const reopened = elected.filter(
      (candidateId) => this.candidates.get(candidateId)?.isReopenNominations,
    ).length;

    return {
      electionId: this.election.electionId,
      seats: this.election.seats,
      quotaScaled,
      quota: quotaScaled / WEIGHT_SCALE,
      ballotsCast: this.ballots.length,
      validPoll,
      rejected,
      excludedCandidates,
      stages,
      elected,
      seatsFilled: elected.length - reopened,
      seatsReopened: reopened,
      seatsUnfilled: Math.max(0, this.election.seats - elected.length),
      exhaustedScaled: cumulativeExhaustedScaled,
    };
  }
}
