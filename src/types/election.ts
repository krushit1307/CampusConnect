export interface Candidate {
  id: string;
  name: string;
  major: string;
  avatarUrl?: string;
  platformSummary: string;
  statement: string;
  endorsements: string[];
}

export interface RankedBallot {
  ballotId: string;
  voterHash: string; // Anonymous cryptographic blinded identifier
  timestamp: string;
  rankings: string[]; // Ordered list of Candidate IDs (1st choice, 2nd, 3rd...)
  signature: string; // Verifiable cryptographic receipt
}

export interface RCVRoundResult {
  roundNumber: number;
  voteCounts: Record<string, number>;
  eliminatedCandidateId?: string;
  winnerCandidateId?: string;
  transferredVotes: number;
  exhaustedVotes: number;
}

export interface Election {
  id: string;
  title: string;
  description: string;
  organization: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'closed';
  candidates: Candidate[];
  ballots: RankedBallot[];
  totalEligibleVoters: number;
}
