import { AlumniEndowmentService } from '../../backend/src/services/AlumniEndowmentService';
import { AlumniDonationRecord, EndowmentAllocation } from '../../src/types/alumniEndowment';

describe('AlumniEndowmentService Unit Test Suite', () => {
  let service: AlumniEndowmentService;

  const mockDonations: AlumniDonationRecord[] = [
    {
      id: 'DON-01',
      donorName: 'John Doe',
      graduationYear: 2000,
      degreeProgram: 'B.S. CS',
      donationAmountUSD: 1000000,
      fundCategory: 'RESEARCH_CHAIR',
      targetDepartment: 'CS',
      contributionDate: '2026-01-01',
      anonymityLevel: 'PUBLIC_RECOGNITION',
      impactScore: 90
    },
    {
      id: 'DON-02',
      donorName: 'Jane Smith',
      graduationYear: 2010,
      degreeProgram: 'MBA',
      donationAmountUSD: 500000,
      fundCategory: 'NEED_SCHOLARSHIP',
      targetDepartment: 'Business',
      contributionDate: '2026-02-01',
      anonymityLevel: 'ANONYMOUS',
      impactScore: 95
    }
  ];

  const mockAllocations: EndowmentAllocation[] = [
    {
      category: 'Research',
      allocatedUSD: 1000000,
      disbursedUSD: 800000,
      beneficiaryCount: 10,
      fiscalYear: 2026
    }
  ];

  beforeEach(() => {
    service = new AlumniEndowmentService(mockDonations, mockAllocations);
  });

  test('should calculate total endowment valuation correctly', () => {
    expect(service.calculateTotalEndowmentValuation()).toBe(1500000);
  });

  test('should evaluate average impact score correctly', () => {
    expect(service.calculateAverageImpactScore()).toBe(93);
  });

  test('should filter donation records by searchQuery accurately', () => {
    const results = service.filterDonations({
      searchQuery: 'john',
      categoryFilter: 'ALL',
      anonymityFilter: 'ALL',
      minAmountUSD: 0
    });
    expect(results.length).toBe(1);
    expect(results[0].donorName).toBe('John Doe');
  });

  test('should filter donation records by minAmountUSD accurately', () => {
    const results = service.filterDonations({
      searchQuery: '',
      categoryFilter: 'ALL',
      anonymityFilter: 'ALL',
      minAmountUSD: 750000
    });
    expect(results.length).toBe(1);
    expect(results[0].donorName).toBe('John Doe');
  });

  test('should compute disbursement ratio accurately', () => {
    expect(service.computeDisbursementRatio('Research')).toBe(80);
    expect(service.computeDisbursementRatio('NonExistent')).toBe(0);
  });
});
