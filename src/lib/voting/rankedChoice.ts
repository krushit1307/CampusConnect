import { RankedBallot, RCVRoundResult, Candidate } from '@/types/election';

/**
 * Calculates Instant-Runoff Voting (Ranked-Choice Voting) rounds.
 * Continues eliminating lowest-voted candidates and transferring ballots until a candidate exceeds 50% majority.
 */
export function calculateRankedChoiceRounds(
  candidates: Candidate[],
  ballots: RankedBallot[]
): {
  rounds: RCVRoundResult[];
  winner: Candidate | null;
} {
  if (candidates.length === 0 || ballots.length === 0) {
    return { rounds: [], winner: null };
  }

  const rounds: RCVRoundResult[] = [];
  const candidateIds = new Set(candidates.map((c) => c.id));
  const activeCandidates = new Set(candidateIds);
  let roundNum = 1;

  while (activeCandidates.size > 1) {
    const counts: Record<string, number> = {};
    activeCandidates.forEach((id) => (counts[id] = 0));
    let exhausted = 0;

    // Distribute each ballot to its highest active preference
    ballots.forEach((ballot) => {
      const topActiveChoice = ballot.rankings.find((cId) => activeCandidates.has(cId));
      if (topActiveChoice) {
        counts[topActiveChoice] = (counts[topActiveChoice] || 0) + 1;
      } else {
        exhausted++;
      }
    });

    const totalActiveVotes = Object.values(counts).reduce((a, b) => a + b, 0);
    const majorityThreshold = totalActiveVotes / 2;

    // Check if anyone has strict majority (>50%)
    let currentWinnerId: string | undefined;
    for (const [id, count] of Object.entries(counts)) {
      if (count > majorityThreshold) {
        currentWinnerId = id;
        break;
      }
    }

    if (currentWinnerId) {
      rounds.push({
        roundNumber: roundNum,
        voteCounts: counts,
        winnerCandidateId: currentWinnerId,
        transferredVotes: 0,
        exhaustedVotes: exhausted,
      });
      const winner = candidates.find((c) => c.id === currentWinnerId) || null;
      return { rounds, winner };
    }

    // Find candidate with lowest votes to eliminate
    let minVotes = Infinity;
    let eliminatedId: string | undefined;
    for (const [id, count] of Object.entries(counts)) {
      if (count < minVotes) {
        minVotes = count;
        eliminatedId = id;
      }
    }

    if (eliminatedId) {
      activeCandidates.delete(eliminatedId);
      rounds.push({
        roundNumber: roundNum,
        voteCounts: counts,
        eliminatedCandidateId: eliminatedId,
        transferredVotes: minVotes,
        exhaustedVotes: exhausted,
      });
    } else {
      break;
    }

    roundNum++;
  }

  // If only 1 candidate left
  const lastRemainingId = Array.from(activeCandidates)[0];
  const winner = candidates.find((c) => c.id === lastRemainingId) || null;

  return { rounds, winner };
}

/**
 * Generates a mock cryptographic blinded signature receipt for verifiable voting.
 */
export function generateCryptographicReceipt(voterId: string, rankings: string[]): {
  voterHash: string;
  signature: string;
} {
  const hash = Array.from(voterId + rankings.join('-'))
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    .toString(16);

  const signature = `0x${Math.abs(Number(hash)).toString(16).padStart(8, '0')}${Date.now().toString(16)}`;
  const voterHash = `anon-${Math.abs(Number(hash) * 31).toString(16).slice(0, 8)}`;

  return { voterHash, signature };
}
