import { ResearchGrantRecord, GrantMilestone, GrantFilterState } from '../types/researchGrant';

/**
 * Enterprise Service Engine for Research Grant & Sponsored Projects Telemetry
 */
export class ResearchGrantService {
  private grants: ResearchGrantRecord[];
  private milestones: GrantMilestone[];

  constructor(
    initialGrants: ResearchGrantRecord[] = [],
    initialMilestones: GrantMilestone[] = []
  ) {
    this.grants = initialGrants;
    this.milestones = initialMilestones;
  }

  /**
   * Calculates total research funding capital in USD
   */
  public calculateTotalResearchFunding(): number {
    return this.grants.reduce((sum, record) => sum + record.totalGrantAmountUSD, 0);
  }

  /**
   * Evaluates average compliance rating across all active research grants
   */
  public calculateAverageComplianceRating(): number {
    if (this.grants.length === 0) return 0;
    const totalRating = this.grants.reduce((sum, record) => sum + record.complianceRating, 0);
    return Math.round(totalRating / this.grants.length);
  }

  /**
   * Filters research grant records according to filter parameters
   */
  public filterGrants(filters: GrantFilterState): ResearchGrantRecord[] {
    return this.grants.filter((grant) => {
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = grant.projectTitle.toLowerCase().includes(query);
        const matchesPI = grant.principalInvestigator.toLowerCase().includes(query);
        const matchesAgency = grant.fundingAgency.toLowerCase().includes(query);
        if (!matchesTitle && !matchesPI && !matchesAgency) return false;
      }

      if (filters.categoryFilter !== 'ALL' && grant.grantCategory !== filters.categoryFilter) {
        return false;
      }

      if (filters.statusFilter !== 'ALL' && grant.grantStatus !== filters.statusFilter) {
        return false;
      }

      if (grant.totalGrantAmountUSD < filters.minGrantAmountUSD) {
        return false;
      }

      return true;
    });
  }

  /**
   * Computes fund disbursement ratio for a specific research grant
   */
  public computeDisbursementRatio(grantId: string): number {
    const grant = this.grants.find((g) => g.id === grantId);
    if (!grant || grant.totalGrantAmountUSD === 0) return 0;
    return parseFloat(((grant.disbursedFundsUSD / grant.totalGrantAmountUSD) * 100).toFixed(1));
  }
}
