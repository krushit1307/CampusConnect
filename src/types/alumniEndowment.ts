/**
 * TypeScript Data Models & Interfaces for Enterprise Alumni Endowment Analytics Module
 */

export type EndowmentFundCategory =
  | 'RESEARCH_CHAIR'
  | 'NEED_SCHOLARSHIP'
  | 'MERIT_SCHOLARSHIP'
  | 'CAPITAL_EXPANSION'
  | 'ATHLETICS_COMPLEX';

export type DonorAnonymityLevel = 'PUBLIC_RECOGNITION' | 'ANONYMOUS';

export interface AlumniDonationRecord {
  id: string;
  donorName: string;
  graduationYear: number;
  degreeProgram: string;
  donationAmountUSD: number;
  fundCategory: EndowmentFundCategory;
  targetDepartment: string;
  contributionDate: string;
  anonymityLevel: DonorAnonymityLevel;
  impactScore: number;
}

export interface EndowmentAllocation {
  category: string;
  allocatedUSD: number;
  disbursedUSD: number;
  beneficiaryCount: number;
  fiscalYear: number;
}

export interface EndowmentFilterState {
  searchQuery: string;
  categoryFilter: EndowmentFundCategory | 'ALL';
  anonymityFilter: DonorAnonymityLevel | 'ALL';
  minAmountUSD: number;
}

export interface EndowmentTelemetryManifest {
  timestamp: string;
  totalValuationUSD: number;
  totalDonors: number;
  filteredCount: number;
  records: AlumniDonationRecord[];
}
