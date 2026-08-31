export type ArbitrationVoteChoice = 'PAYOUT_VENDOR' | 'REFUND_CLUB';
export type DisputeStatus = 'ESCALATED' | 'JURY_DELIBERATION' | 'RESOLVED_VENDOR_PAID' | 'RESOLVED_CLUB_REFUNDED';

export interface ClubAdminJuryMember {
  adminId: string;
  adminName: string;
  clubAffiliation: string; // Must not be involved in the dispute
  email: string;
  hasVoted: boolean;
  voteCastAt?: string;
}

export interface BlindArbitrationVote {
  id: string;
  disputeId: string;
  juryAdminId: string;
  choice: ArbitrationVoteChoice;
  votingHash: string; // Cryptographic zero-knowledge vote commitment
  submittedAt: string;
}

export interface DeliverableDisputeCase {
  id: string;
  contractId: string;
  deliverableTitle: string;
  escrowAmountUsd: number;
  vendorId: string;
  vendorName: string;
  vendorEvidencePhotoUrl: string;
  vendorEvidenceStatement: string;
  organizerClubId: string;
  organizerClubName: string;
  organizerComplaintStatement: string;
  status: DisputeStatus;
  isEscrowFrozen: boolean;
  selectedJuryPool: ClubAdminJuryMember[];
  votesCast: BlindArbitrationVote[];
  payoutVendorVotesCount: number;
  refundClubVotesCount: number;
  majorityThreshold: number; // 3 out of 5
  resolutionTxHash?: string;
  resolvedAt?: string;
  created_at: string;
}
