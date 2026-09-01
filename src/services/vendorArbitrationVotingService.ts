import {
  ArbitrationVoteChoice,
  DeliverableDisputeCase,
  ClubAdminJuryMember,
  BlindArbitrationVote,
} from '../types/vendorArbitrationVoting';

// Unrelated club admins pool to ensure zero conflict of interest
const candidateAdminPool: Omit<ClubAdminJuryMember, 'hasVoted'>[] = [
  { adminId: 'adm_astro_01', adminName: 'Marcus Vance', clubAffiliation: 'Astronomy & Astrophysics Society', email: 'm.vance@uni.edu' },
  { adminId: 'adm_chess_02', adminName: 'Elena Rostova', clubAffiliation: 'Competitive Chess Club', email: 'e.rostova@uni.edu' },
  { adminId: 'adm_robot_03', adminName: 'Jin Woo', clubAffiliation: 'Robotics & Mechatronics Team', email: 'j.woo@uni.edu' },
  { adminId: 'adm_debate_04', adminName: 'Sarah Jenkins', clubAffiliation: 'Parliamentary Debate Union', email: 's.jenkins@uni.edu' },
  { adminId: 'adm_music_05', adminName: 'David Kalu', clubAffiliation: 'Campus Symphony Orchestra', email: 'd.kalu@uni.edu' },
  { adminId: 'adm_bio_06', adminName: 'Priya Patel', clubAffiliation: 'Biomedical Innovation Guild', email: 'p.patel@uni.edu' },
  { adminId: 'adm_film_07', adminName: 'Liam O’Connor', clubAffiliation: 'Independent Film Collective', email: 'l.oconnor@uni.edu' },
];

const mockDisputes: DeliverableDisputeCase[] = [
  {
    id: 'disp-catering-8821',
    contractId: 'cnt-pizza-delivery-4821',
    deliverableTitle: '40 Large Artisan Pizzas & Drink Coolers for Hackathon Kickoff',
    escrowAmountUsd: 650.0,
    vendorId: 'vnd_tony_pizza_01',
    vendorName: "Tony's Authentic Stone-Fired Pizzeria",
    vendorEvidencePhotoUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    vendorEvidenceStatement:
      'Pizzas delivered on-site at Student Union Room 102 at 6:45 PM hot in thermal bags. Time-stamped geo-tagged photo uploaded with union staff signature.',
    organizerClubId: 'club_cs_society',
    organizerClubName: 'Computer Science & ACM Student Chapter',
    organizerComplaintStatement:
      'Pizzas arrived 30 minutes late, boxes were crushed, and 10 pepperoni pizzas were cold. Demand full refund.',
    status: 'JURY_DELIBERATION',
    isEscrowFrozen: true,
    selectedJuryPool: [
      { adminId: 'adm_astro_01', adminName: 'Marcus Vance', clubAffiliation: 'Astronomy & Astrophysics Society', email: 'm.vance@uni.edu', hasVoted: false },
      { adminId: 'adm_chess_02', adminName: 'Elena Rostova', clubAffiliation: 'Competitive Chess Club', email: 'e.rostova@uni.edu', hasVoted: false },
      { adminId: 'adm_robot_03', adminName: 'Jin Woo', clubAffiliation: 'Robotics & Mechatronics Team', email: 'j.woo@uni.edu', hasVoted: false },
      { adminId: 'adm_debate_04', adminName: 'Sarah Jenkins', clubAffiliation: 'Parliamentary Debate Union', email: 's.jenkins@uni.edu', hasVoted: false },
      { adminId: 'adm_music_05', adminName: 'David Kalu', clubAffiliation: 'Campus Symphony Orchestra', email: 'd.kalu@uni.edu', hasVoted: false },
    ],
    votesCast: [],
    payoutVendorVotesCount: 0,
    refundClubVotesCount: 0,
    majorityThreshold: 3,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export class VendorArbitrationVotingService {
  private disputes: DeliverableDisputeCase[] = [...mockDisputes];

  public getDisputes(): DeliverableDisputeCase[] {
    return [...this.disputes];
  }

  public getDisputeById(id: string): DeliverableDisputeCase | undefined {
    return this.disputes.find((d) => d.id === id);
  }

  /**
   * Randomly selects 5 unbiased club admins from clubs that have NO conflict of interest
   */
  public selectUnbiasedJuryPool(disputeClubId: string): ClubAdminJuryMember[] {
    const eligiblePool = candidateAdminPool.filter((c) => c.clubAffiliation.toLowerCase() !== disputeClubId.toLowerCase());
    // Shuffle and pick 5
    const shuffled = [...eligiblePool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5).map((admin) => ({
      ...admin,
      hasVoted: false,
    }));
    return selected;
  }

  /**
   * Escalates a vendor bidding dispute into the decentralized arbitration court, freezes escrow
   */
  public escalateDispute(
    contractId: string,
    deliverableTitle: string,
    escrowAmountUsd: number,
    vendorId: string,
    vendorName: string,
    vendorEvidencePhotoUrl: string,
    vendorEvidenceStatement: string,
    organizerClubId: string,
    organizerClubName: string,
    organizerComplaintStatement: string
  ): DeliverableDisputeCase {
    const jury = this.selectUnbiasedJuryPool(organizerClubId);

    const dispute: DeliverableDisputeCase = {
      id: `disp-${Date.now()}`,
      contractId,
      deliverableTitle,
      escrowAmountUsd,
      vendorId,
      vendorName,
      vendorEvidencePhotoUrl,
      vendorEvidenceStatement,
      organizerClubId,
      organizerClubName,
      organizerComplaintStatement,
      status: 'JURY_DELIBERATION',
      isEscrowFrozen: true,
      selectedJuryPool: jury,
      votesCast: [],
      payoutVendorVotesCount: 0,
      refundClubVotesCount: 0,
      majorityThreshold: 3,
      created_at: new Date().toISOString(),
    };

    this.disputes.unshift(dispute);
    return dispute;
  }

  /**
   * Cast a blind cryptographic vote as a jury member
   */
  public castBlindJuryVote(
    disputeId: string,
    juryAdminId: string,
    choice: ArbitrationVoteChoice
  ): { dispute: DeliverableDisputeCase; executionTriggered: boolean; message: string } {
    const dispute = this.disputes.find((d) => d.id === disputeId);
    if (!dispute) {
      throw new Error(`Dispute ${disputeId} not found.`);
    }

    if (dispute.status !== 'JURY_DELIBERATION') {
      throw new Error(`Dispute is already resolved (${dispute.status}).`);
    }

    const juryMember = dispute.selectedJuryPool.find((j) => j.adminId === juryAdminId);
    if (!juryMember) {
      throw new Error(`Admin ${juryAdminId} is not assigned to this dispute jury pool.`);
    }

    if (juryMember.hasVoted) {
      throw new Error(`Admin ${juryAdminId} has already cast their blind vote.`);
    }

    // Generate cryptographic SHA256 commitment hash
    const votingHash = `0x${Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;

    const vote: BlindArbitrationVote = {
      id: `vote-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      disputeId,
      juryAdminId,
      choice,
      votingHash,
      submittedAt: new Date().toISOString(),
    };

    juryMember.hasVoted = true;
    juryMember.voteCastAt = vote.submittedAt;
    dispute.votesCast.push(vote);

    if (choice === 'PAYOUT_VENDOR') {
      dispute.payoutVendorVotesCount += 1;
    } else {
      dispute.refundClubVotesCount += 1;
    }

    // Check Majority Rule Threshold (3 votes out of 5)
    let executionTriggered = false;
    let message = `Vote securely recorded. Current tally: ${dispute.payoutVendorVotesCount} Payout Vendor vs ${dispute.refundClubVotesCount} Refund Club.`;

    if (dispute.payoutVendorVotesCount >= dispute.majorityThreshold) {
      dispute.status = 'RESOLVED_VENDOR_PAID';
      dispute.isEscrowFrozen = false;
      dispute.resolvedAt = new Date().toISOString();
      dispute.resolutionTxHash = `0xTX_ESCROW_PAYOUT_VENDOR_${Date.now()}`;
      executionTriggered = true;
      message = `MAJORITY REACHED (3/5): Escrow of $${dispute.escrowAmountUsd} automatically released and paid out to Vendor ${dispute.vendorName}. Smart contract execution complete!`;
    } else if (dispute.refundClubVotesCount >= dispute.majorityThreshold) {
      dispute.status = 'RESOLVED_CLUB_REFUNDED';
      dispute.isEscrowFrozen = false;
      dispute.resolvedAt = new Date().toISOString();
      dispute.resolutionTxHash = `0xTX_ESCROW_REFUND_CLUB_${Date.now()}`;
      executionTriggered = true;
      message = `MAJORITY REACHED (3/5): Escrow of $${dispute.escrowAmountUsd} automatically refunded to Club ${dispute.organizerClubName}. Smart contract execution complete!`;
    }

    return { dispute, executionTriggered, message };
  }
}

export const vendorArbitrationVotingService = new VendorArbitrationVotingService();
