import CampusAlumniEndowment, { ICampusAlumniEndowment } from '../models/CampusAlumniEndowmentModel';

export interface EndowmentFilterQuery {
  campusName?: string;
  fundCategory?: string;
  search?: string;
}

export class CampusAlumniEndowmentEngine {
  public static async createEndowment(payload: {
    fundName: string;
    campusName: string;
    donorAlumniName: string;
    donorGraduationYear: number;
    fundCategory: 'RESEARCH_GRANT' | 'STUDENT_EMERGENCY' | 'SCHOLARSHIP' | 'STARTUP_SEED';
    targetAmountUsd: number;
    donorMatchingRatio?: number;
  }): Promise<ICampusAlumniEndowment> {
    const endowment = new CampusAlumniEndowment({
      ...payload,
      raisedAmountUsd: 0,
      disbursedAmountUsd: 0,
      disbursalStatus: 'ACTIVE',
    });
    return await endowment.save();
  }

  public static async getEndowments(filters: EndowmentFilterQuery): Promise<ICampusAlumniEndowment[]> {
    const query: any = {};
    if (filters.campusName && filters.campusName !== 'All') {
      query.campusName = filters.campusName;
    }
    if (filters.fundCategory && filters.fundCategory !== 'All') {
      query.fundCategory = filters.fundCategory;
    }
    if (filters.search && filters.search.trim() !== '') {
      query.$or = [
        { fundName: { $regex: filters.search, $options: 'i' } },
        { donorAlumniName: { $regex: filters.search, $options: 'i' } },
        { campusName: { $regex: filters.search, $options: 'i' } },
      ];
    }
    return await CampusAlumniEndowment.find(query).sort({ createdAt: -1 });
  }

  public static async contributeToFund(
    endowmentId: string,
    contributionUsd: number
  ): Promise<ICampusAlumniEndowment | null> {
    const fund = await CampusAlumniEndowment.findById(endowmentId);
    if (!fund) return null;

    const matchedContribution = contributionUsd * fund.donorMatchingRatio;
    const newRaised = fund.raisedAmountUsd + matchedContribution;
    const newStatus = newRaised >= fund.targetAmountUsd ? 'FULLY_FUNDED' : 'ACTIVE';

    return await CampusAlumniEndowment.findByIdAndUpdate(
      endowmentId,
      {
        raisedAmountUsd: newRaised,
        disbursalStatus: newStatus,
      },
      { new: true }
    );
  }

  public static async disburseGrant(
    endowmentId: string,
    disbursalUsd: number
  ): Promise<ICampusAlumniEndowment | null> {
    const fund = await CampusAlumniEndowment.findById(endowmentId);
    if (!fund) return null;

    const newDisbursed = fund.disbursedAmountUsd + disbursalUsd;

    return await CampusAlumniEndowment.findByIdAndUpdate(
      endowmentId,
      {
        disbursedAmountUsd: newDisbursed,
      },
      { new: true }
    );
  }
}
