import CampusResearchLabGrant, { ICampusResearchLabGrant } from '../models/CampusResearchLabGrantModel';

export interface LabGrantFilterQuery {
  department?: string;
  grantCategory?: string;
  search?: string;
}

export class CampusResearchLabGrantEngine {
  public static async createLabGrant(payload: {
    labTitle: string;
    department: string;
    principalInvestigator: string;
    campusName: string;
    grantCategory: 'ARTIFICIAL_INTELLIGENCE' | 'QUANTUM_COMPUTING' | 'BIOMEDICAL' | 'RENEWABLE_ENERGY';
    fundingTargetUsd: number;
    openRAPositionsCount?: number;
  }): Promise<ICampusResearchLabGrant> {
    const lab = new CampusResearchLabGrant({
      ...payload,
      fundingSecuredUsd: 0,
      grantStatus: 'PROPOSAL_OPEN',
    });
    return await lab.save();
  }

  public static async getLabGrants(filters: LabGrantFilterQuery): Promise<ICampusResearchLabGrant[]> {
    const query: any = {};
    if (filters.department && filters.department !== 'All') {
      query.department = filters.department;
    }
    if (filters.grantCategory && filters.grantCategory !== 'All') {
      query.grantCategory = filters.grantCategory;
    }
    if (filters.search && filters.search.trim() !== '') {
      query.$or = [
        { labTitle: { $regex: filters.search, $options: 'i' } },
        { principalInvestigator: { $regex: filters.search, $options: 'i' } },
        { campusName: { $regex: filters.search, $options: 'i' } },
      ];
    }
    return await CampusResearchLabGrant.find(query).sort({ createdAt: -1 });
  }

  public static async awardFunding(
    labId: string,
    fundingUsd: number
  ): Promise<ICampusResearchLabGrant | null> {
    const lab = await CampusResearchLabGrant.findById(labId);
    if (!lab) return null;

    const newSecured = lab.fundingSecuredUsd + fundingUsd;
    const newStatus = newSecured >= lab.fundingTargetUsd ? 'GRANT_AWARDED' : 'PROPOSAL_OPEN';

    return await CampusResearchLabGrant.findByIdAndUpdate(
      labId,
      {
        fundingSecuredUsd: newSecured,
        grantStatus: newStatus,
      },
      { new: true }
    );
  }
}
