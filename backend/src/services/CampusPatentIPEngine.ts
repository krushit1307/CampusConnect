import CampusPatentIP, { ICampusPatentIP } from '../models/CampusPatentIPModel';

export interface PatentIPFilterQuery {
  patentType?: string;
  patentStatus?: string;
  search?: string;
}

export class CampusPatentIPEngine {
  public static async filePatentDisclosure(payload: {
    inventionTitle: string;
    inventorNames: string[];
    department: string;
    campusName: string;
    patentType: 'UTILITY_PATENT' | 'DESIGN_PATENT' | 'SOFTWARE_COPYRIGHT' | 'BIOTECH_GENOME' | 'HARDWARE_CIRCUIT';
    filingNumber: string;
    jurisdiction?: string;
    commercialLicensingFeeUsd?: number;
    royaltySharePercentage?: number;
  }): Promise<ICampusPatentIP> {
    const patent = new CampusPatentIP({
      ...payload,
      patentStatus: 'DISCLOSURE_REVIEW',
      commercialEntityLicensee: '',
    });
    return await patent.save();
  }

  public static async getPatents(filters: PatentIPFilterQuery): Promise<ICampusPatentIP[]> {
    const query: any = {};
    if (filters.patentType && filters.patentType !== 'All') {
      query.patentType = filters.patentType;
    }
    if (filters.patentStatus && filters.patentStatus !== 'All') {
      query.patentStatus = filters.patentStatus;
    }
    if (filters.search && filters.search.trim() !== '') {
      query.$or = [
        { inventionTitle: { $regex: filters.search, $options: 'i' } },
        { filingNumber: { $regex: filters.search, $options: 'i' } },
        { department: { $regex: filters.search, $options: 'i' } },
        { campusName: { $regex: filters.search, $options: 'i' } },
      ];
    }
    return await CampusPatentIP.find(query).sort({ createdAt: -1 });
  }

  public static async updatePatentStatus(
    patentId: string,
    nextStatus: 'PROVISIONAL_FILED' | 'PATENT_GRANTED' | 'LICENSED_ENTERPRISE'
  ): Promise<ICampusPatentIP | null> {
    return await CampusPatentIP.findByIdAndUpdate(
      patentId,
      { patentStatus: nextStatus },
      { new: true }
    );
  }

  public static async licensePatentToEnterprise(
    patentId: string,
    licenseeName: string,
    licenseFeeUsd: number
  ): Promise<ICampusPatentIP | null> {
    return await CampusPatentIP.findByIdAndUpdate(
      patentId,
      {
        commercialEntityLicensee: licenseeName,
        commercialLicensingFeeUsd: licenseFeeUsd,
        patentStatus: 'LICENSED_ENTERPRISE',
      },
      { new: true }
    );
  }
}
