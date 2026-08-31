import { describe, it, expect, beforeEach } from 'vitest';
import { VendorArbitrationVotingService } from './vendorArbitrationVotingService';

describe('VendorArbitrationVotingService', () => {
  let service: VendorArbitrationVotingService;

  beforeEach(() => {
    service = new VendorArbitrationVotingService();
  });

  it('should initialize dispute with 5 unbiased jury members and frozen escrow', () => {
    const disputes = service.getDisputes();
    expect(disputes.length).toBeGreaterThan(0);
    const dispute = disputes[0];
    expect(dispute.isEscrowFrozen).toBe(true);
    expect(dispute.selectedJuryPool.length).toBe(5);
    expect(dispute.status).toBe('JURY_DELIBERATION');
  });

  it('should resolve and release escrow to vendor upon 3 PAYOUT_VENDOR votes', () => {
    const dispute = service.getDisputes()[0];
    const jurors = dispute.selectedJuryPool;

    // Juror 1 votes Payout
    service.castBlindJuryVote(dispute.id, jurors[0].adminId, 'PAYOUT_VENDOR');
    // Juror 2 votes Refund
    service.castBlindJuryVote(dispute.id, jurors[1].adminId, 'REFUND_CLUB');
    // Juror 3 votes Payout
    service.castBlindJuryVote(dispute.id, jurors[2].adminId, 'PAYOUT_VENDOR');
    // Juror 4 votes Payout -> Majority 3 reached!
    const result = service.castBlindJuryVote(dispute.id, jurors[3].adminId, 'PAYOUT_VENDOR');

    expect(result.executionTriggered).toBe(true);
    expect(result.dispute.status).toBe('RESOLVED_VENDOR_PAID');
    expect(result.dispute.isEscrowFrozen).toBe(false);
    expect(result.dispute.resolutionTxHash).toBeDefined();
  });

  it('should prevent double voting by the same juror', () => {
    const dispute = service.getDisputes()[0];
    const juror = dispute.selectedJuryPool[0];

    service.castBlindJuryVote(dispute.id, juror.adminId, 'PAYOUT_VENDOR');

    expect(() => {
      service.castBlindJuryVote(dispute.id, juror.adminId, 'REFUND_CLUB');
    }).toThrowError(/already cast/);
  });
});
