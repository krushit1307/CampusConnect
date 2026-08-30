import { describe, test, expect, beforeEach } from 'vitest';
import { IncubatorStudioService } from '../../backend/src/services/IncubatorStudioService';
import { IncubatorStartupRecord, IncubatorMilestone } from '../../src/types/campusIncubator';

describe('IncubatorStudioService Unit Test Suite', () => {
  let service: IncubatorStudioService;

  const mockStartups: IncubatorStartupRecord[] = [
    {
      id: 'STARTUP-01',
      startupName: 'NeuroPulse Health AI',
      founderName: 'Aarav Sharma',
      domainSector: 'HEALTH_TECH',
      incubatorCohort: 'Cohort 2025-A',
      ventureCapitalRaisedUSD: 1000000,
      incubationGrantUSD: 200000,
      incubationStage: 'SERIES_A_READY',
      patentFiledCount: 2,
      valuationRatingUSD: 5000000,
      tractionScore: 95
    },
    {
      id: 'STARTUP-02',
      startupName: 'EcoVolt Solid-State',
      founderName: 'Rohan Deshmukh',
      domainSector: 'CLEAN_ENERGY',
      incubatorCohort: 'Cohort 2024-B',
      ventureCapitalRaisedUSD: 3000000,
      incubationGrantUSD: 500000,
      incubationStage: 'SCALE_UP_GROWTH',
      patentFiledCount: 6,
      valuationRatingUSD: 12000000,
      tractionScore: 98
    }
  ];

  const mockMilestones: IncubatorMilestone[] = [
    {
      milestoneId: 'INC-M-01',
      startupId: 'STARTUP-01',
      title: 'FDA Software Pre-Submission',
      targetDate: '2026-05-15',
      status: 'VERIFIED',
      trancheReleaseUSD: 100000
    }
  ];

  beforeEach(() => {
    service = new IncubatorStudioService(mockStartups, mockMilestones);
  });

  test('should calculate total venture capital correctly', () => {
    expect(service.calculateTotalVentureCapital()).toBe(4000000);
  });

  test('should evaluate average traction score correctly', () => {
    expect(service.calculateAverageTractionScore()).toBe(97);
  });

  test('should filter startup records by searchQuery accurately', () => {
    const results = service.filterStartups({
      searchQuery: 'neuropulse',
      sectorFilter: 'ALL',
      stageFilter: 'ALL',
      minValuationUSD: 0
    });
    expect(results.length).toBe(1);
    expect(results[0].startupName).toBe('NeuroPulse Health AI');
  });

  test('should filter startup records by minValuationUSD accurately', () => {
    const results = service.filterStartups({
      searchQuery: '',
      sectorFilter: 'ALL',
      stageFilter: 'ALL',
      minValuationUSD: 10000000
    });
    expect(results.length).toBe(1);
    expect(results[0].startupName).toBe('EcoVolt Solid-State');
  });

  test('should compute patent efficiency accurately', () => {
    expect(service.computePatentEfficiency('STARTUP-01')).toBe(2);
    expect(service.computePatentEfficiency('INVALID-STARTUP')).toBe(0);
  });
});
