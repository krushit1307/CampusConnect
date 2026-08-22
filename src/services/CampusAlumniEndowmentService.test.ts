import { describe, it, expect } from 'vitest';
import { CampusAlumniEndowmentService } from '../../backend/src/services/CampusAlumniEndowmentService';

describe('CampusAlumniEndowmentService', () => {
  it('should return active campaigns', () => {
    const campaigns = CampusAlumniEndowmentService.getActiveCampaigns();
    expect(campaigns.length).toBeGreaterThan(0);
    expect(campaigns[0]).toHaveProperty('targetAmount');
  });

  it('should process donation with corporate matching', () => {
    const campaignId = 'CAMP-ENDOW-01';
    const initialCampaign = CampusAlumniEndowmentService.getCampaignById(campaignId);
    const initialRaised = initialCampaign?.raisedAmount || 0;

    const { transaction, campaign } = CampusAlumniEndowmentService.processDonation(
      campaignId,
      'Test Donor',
      2020,
      1000,
      false,
      'CREDIT_CARD'
    );

    expect(transaction.amount).toBe(1000);
    expect(transaction.matchedAmount).toBe(2000); // 2.0x ratio for CAMP-ENDOW-01
    expect(campaign.raisedAmount).toBe(initialRaised + 3000);
  });

  it('should calculate total impact metrics correctly', () => {
    const metrics = CampusAlumniEndowmentService.calculateTotalImpactMetrics();
    expect(metrics.totalRaised).toBeGreaterThan(0);
    expect(metrics.totalDonors).toBeGreaterThan(0);
  });
});
