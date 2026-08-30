import { IncubatorStartupRecord, IncubatorMilestone, IncubatorFilterState } from '../types/campusIncubator';

/**
 * Enterprise Service Engine for Campus Innovation & Startup Incubator Studio
 */
export class IncubatorStudioService {
  private startups: IncubatorStartupRecord[];
  private milestones: IncubatorMilestone[];

  constructor(
    initialStartups: IncubatorStartupRecord[] = [],
    initialMilestones: IncubatorMilestone[] = []
  ) {
    this.startups = initialStartups;
    this.milestones = initialMilestones;
  }

  /**
   * Calculates total venture capital raised by incubated startups in USD
   */
  public calculateTotalVentureCapital(): number {
    return this.startups.reduce((sum, record) => sum + record.ventureCapitalRaisedUSD, 0);
  }

  /**
   * Evaluates average traction score across all incubated ventures
   */
  public calculateAverageTractionScore(): number {
    if (this.startups.length === 0) return 0;
    const totalScore = this.startups.reduce((sum, record) => sum + record.tractionScore, 0);
    return Math.round(totalScore / this.startups.length);
  }

  /**
   * Filters startup records according to filter parameters
   */
  public filterStartups(filters: IncubatorFilterState): IncubatorStartupRecord[] {
    return this.startups.filter((startup) => {
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = startup.startupName.toLowerCase().includes(query);
        const matchesFounder = startup.founderName.toLowerCase().includes(query);
        const matchesCohort = startup.incubatorCohort.toLowerCase().includes(query);
        if (!matchesName && !matchesFounder && !matchesCohort) return false;
      }

      if (filters.sectorFilter !== 'ALL' && startup.domainSector !== filters.sectorFilter) {
        return false;
      }

      if (filters.stageFilter !== 'ALL' && startup.incubationStage !== filters.stageFilter) {
        return false;
      }

      if (startup.valuationRatingUSD < filters.minValuationUSD) {
        return false;
      }

      return true;
    });
  }

  /**
   * Computes patent-to-capital efficiency metric
   */
  public computePatentEfficiency(startupId: string): number {
    const startup = this.startups.find((s) => s.id === startupId);
    if (!startup || startup.ventureCapitalRaisedUSD === 0) return 0;
    return parseFloat(((startup.patentFiledCount / (startup.ventureCapitalRaisedUSD / 1000000))).toFixed(2));
  }
}
