/**
 * TypeScript Data Models & Interfaces for Enterprise Innovation Incubator Module
 */

export type DomainSector =
  | 'HEALTH_TECH'
  | 'CLEAN_ENERGY'
  | 'AGRI_TECH'
  | 'CYBERSECURITY'
  | 'ED_TECH';

export type IncubationStage =
  | 'SEED_MVP_PROTOTYPE'
  | 'EARLY_TRACTION'
  | 'SERIES_A_READY'
  | 'SCALE_UP_GROWTH';

export interface IncubatorStartupRecord {
  id: string;
  startupName: string;
  founderName: string;
  domainSector: DomainSector;
  incubatorCohort: string;
  ventureCapitalRaisedUSD: number;
  incubationGrantUSD: number;
  incubationStage: IncubationStage;
  patentFiledCount: number;
  valuationRatingUSD: number;
  tractionScore: number;
}

export interface IncubatorMilestone {
  milestoneId: string;
  startupId: string;
  title: string;
  targetDate: string;
  status: 'VERIFIED' | 'IN_PROGRESS' | 'PENDING_REVIEW';
  trancheReleaseUSD: number;
}

export interface IncubatorFilterState {
  searchQuery: string;
  sectorFilter: DomainSector | 'ALL';
  stageFilter: IncubationStage | 'ALL';
  minValuationUSD: number;
}

export interface IncubatorTelemetryManifest {
  timestamp: string;
  totalVCRaisedUSD: number;
  totalIncubatedStartups: number;
  filteredCount: number;
  records: IncubatorStartupRecord[];
}
