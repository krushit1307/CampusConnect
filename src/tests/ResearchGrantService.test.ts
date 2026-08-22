import { ResearchGrantService } from '../../backend/src/services/ResearchGrantService';
import { ResearchGrantRecord, GrantMilestone } from '../../src/types/researchGrant';

describe('ResearchGrantService Unit Test Suite', () => {
  let service: ResearchGrantService;

  const mockGrants: ResearchGrantRecord[] = [
    {
      id: 'GRANT-01',
      projectTitle: 'AI Swarm GIS',
      principalInvestigator: 'Dr. Thorne',
      academicDepartment: 'Robotics',
      fundingAgency: 'NSF',
      totalGrantAmountUSD: 3000000,
      disbursedFundsUSD: 1500000,
      grantCategory: 'FEDERAL_FUNDED',
      grantStatus: 'ACTIVE_DISBURSEMENT',
      awardDate: '2025-01-01',
      complianceRating: 98
    },
    {
      id: 'GRANT-02',
      projectTitle: 'Quantum Crypto',
      principalInvestigator: 'Dr. Mansoor',
      academicDepartment: 'Cybersecurity',
      fundingAgency: 'DARPA',
      totalGrantAmountUSD: 5000000,
      disbursedFundsUSD: 5000000,
      grantCategory: 'DEFENSE_CONTRACT',
      grantStatus: 'COMPLETED_SUCCESSFUL',
      awardDate: '2024-05-01',
      complianceRating: 92
    }
  ];

  const mockMilestones: GrantMilestone[] = [
    {
      milestoneId: 'M-01',
      grantId: 'GRANT-01',
      title: 'Simulation Baseline',
      targetDate: '2026-05-01',
      status: 'VERIFIED',
      trancheAmountUSD: 500000
    }
  ];

  beforeEach(() => {
    service = new ResearchGrantService(mockGrants, mockMilestones);
  });

  test('should calculate total research funding correctly', () => {
    expect(service.calculateTotalResearchFunding()).toBe(8000000);
  });

  test('should evaluate average compliance rating correctly', () => {
    expect(service.calculateAverageComplianceRating()).toBe(95);
  });

  test('should filter grant records by searchQuery accurately', () => {
    const results = service.filterGrants({
      searchQuery: 'swarm',
      categoryFilter: 'ALL',
      statusFilter: 'ALL',
      minGrantAmountUSD: 0
    });
    expect(results.length).toBe(1);
    expect(results[0].projectTitle).toBe('AI Swarm GIS');
  });

  test('should filter grant records by minGrantAmountUSD accurately', () => {
    const results = service.filterGrants({
      searchQuery: '',
      categoryFilter: 'ALL',
      statusFilter: 'ALL',
      minGrantAmountUSD: 4000000
    });
    expect(results.length).toBe(1);
    expect(results[0].projectTitle).toBe('Quantum Crypto');
  });

  test('should compute disbursement ratio accurately', () => {
    expect(service.computeDisbursementRatio('GRANT-01')).toBe(50);
    expect(service.computeDisbursementRatio('INVALID-GRANT')).toBe(0);
  });
});
