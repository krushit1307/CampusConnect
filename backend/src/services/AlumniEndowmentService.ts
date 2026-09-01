import { AlumniDonationRecord, EndowmentAllocation, EndowmentFilterState } from '../types/alumniEndowment';

/**
 * Enterprise Service Engine for Alumni Endowment & Philanthropic Capital Analytics
 */
export class AlumniEndowmentService {
  private donations: AlumniDonationRecord[];
  private allocations: EndowmentAllocation[];

  constructor(
    initialDonations: AlumniDonationRecord[] = [],
    initialAllocations: EndowmentAllocation[] = []
  ) {
    this.donations = initialDonations;
    this.allocations = initialAllocations;
  }

  /**
   * Calculates total valuation of endowment fund capital contributions in USD
   */
  public calculateTotalEndowmentValuation(): number {
    return this.donations.reduce((sum, record) => sum + record.donationAmountUSD, 0);
  }

  /**
   * Evaluates average institutional impact score across all benefactors
   */
  public calculateAverageImpactScore(): number {
    if (this.donations.length === 0) return 0;
    const totalImpact = this.donations.reduce((sum, record) => sum + record.impactScore, 0);
    return Math.round(totalImpact / this.donations.length);
  }

  /**
   * Filters donation records according to filter parameters
   */
  public filterDonations(filters: EndowmentFilterState): AlumniDonationRecord[] {
    return this.donations.filter((record) => {
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = record.donorName.toLowerCase().includes(query);
        const matchesDept = record.targetDepartment.toLowerCase().includes(query);
        const matchesDegree = record.degreeProgram.toLowerCase().includes(query);
        if (!matchesName && !matchesDept && !matchesDegree) return false;
      }

      if (filters.categoryFilter !== 'ALL' && record.fundCategory !== filters.categoryFilter) {
        return false;
      }

      if (filters.anonymityFilter !== 'ALL' && record.anonymityLevel !== filters.anonymityFilter) {
        return false;
      }

      if (record.donationAmountUSD < filters.minAmountUSD) {
        return false;
      }

      return true;
    });
  }

  /**
   * Computes capital disbursement percentage across endowment allocations
   */
  public computeDisbursementRatio(allocationCategory: string): number {
    const alloc = this.allocations.find((a) => a.category === allocationCategory);
    if (!alloc || alloc.allocatedUSD === 0) return 0;
    return parseFloat(((alloc.disbursedUSD / alloc.allocatedUSD) * 100).toFixed(1));
  }
}
