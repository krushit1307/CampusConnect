import CampusVentureSyndicate, { ICampusVentureSyndicate } from '../models/CampusVentureSyndicateModel';

export interface VentureSyndicateFilterQuery {
  investmentFocus?: string;
  syndicateStatus?: string;
  search?: string;
}

export class CampusVentureSyndicateEngine {
  public static async createSyndicate(payload: {
    syndicateName: string;
    leadAngelName: string;
    leadAngelAlumniClass: number;
    campusAffiliation: string;
    investmentFocus: 'PRE_SEED_DEEPTECH' | 'SEED_SAAS' | 'SERIES_A_BIOTECH' | 'WEB3_INFRASTRUCTURE' | 'CLIMATE_TECH';
    targetFundSizeUsd: number;
    minimumCheckSizeUsd?: number;
    carryingFeePercentage?: number;
  }): Promise<ICampusVentureSyndicate> {
    const syndicate = new CampusVentureSyndicate({
      ...payload,
      capitalCommittedUsd: 0,
      capitalDeployedUsd: 0,
      portfolioStartupsCount: 0,
      syndicateMembersCount: 1,
      syndicateStatus: 'RAISING_CAPITAL',
    });
    return await syndicate.save();
  }

  public static async getSyndicates(filters: VentureSyndicateFilterQuery): Promise<ICampusVentureSyndicate[]> {
    const query: any = {};
    if (filters.investmentFocus && filters.investmentFocus !== 'All') {
      query.investmentFocus = filters.investmentFocus;
    }
    if (filters.syndicateStatus && filters.syndicateStatus !== 'All') {
      query.syndicateStatus = filters.syndicateStatus;
    }
    if (filters.search && filters.search.trim() !== '') {
      query.$or = [
        { syndicateName: { $regex: filters.search, $options: 'i' } },
        { leadAngelName: { $regex: filters.search, $options: 'i' } },
        { campusAffiliation: { $regex: filters.search, $options: 'i' } },
      ];
    }
    return await CampusVentureSyndicate.find(query).sort({ createdAt: -1 });
  }

  public static async commitCapital(
    syndicateId: string,
    checkSizeUsd: number
  ): Promise<ICampusVentureSyndicate | null> {
    const syndicate = await CampusVentureSyndicate.findById(syndicateId);
    if (!syndicate) return null;

    const newCommitted = syndicate.capitalCommittedUsd + checkSizeUsd;
    const newMembers = syndicate.syndicateMembersCount + 1;
    const newStatus = newCommitted >= syndicate.targetFundSizeUsd ? 'ACTIVE_INVESTING' : 'RAISING_CAPITAL';

    return await CampusVentureSyndicate.findByIdAndUpdate(
      syndicateId,
      {
        capitalCommittedUsd: newCommitted,
        syndicateMembersCount: newMembers,
        syndicateStatus: newStatus,
      },
      { new: true }
    );
  }

  public static async deployCheckToStartup(
    syndicateId: string,
    checkUsd: number
  ): Promise<ICampusVentureSyndicate | null> {
    const syndicate = await CampusVentureSyndicate.findById(syndicateId);
    if (!syndicate) return null;

    const newDeployed = syndicate.capitalDeployedUsd + checkUsd;
    const newStartups = syndicate.portfolioStartupsCount + 1;
    const isFullyDeployed = newDeployed >= syndicate.capitalCommittedUsd;

    return await CampusVentureSyndicate.findByIdAndUpdate(
      syndicateId,
      {
        capitalDeployedUsd: newDeployed,
        portfolioStartupsCount: newStartups,
        syndicateStatus: isFullyDeployed ? 'FULLY_DEPLOYED' : 'ACTIVE_INVESTING',
      },
      { new: true }
    );
  }
}
